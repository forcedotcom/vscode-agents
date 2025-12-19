import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CoreExtensionService } from '../services/coreExtensionService';
import type { ApexLog } from '@salesforce/types/tooling';
import { Lifecycle, SfError, SfProject } from '@salesforce/core';
import type { ChannelService } from '../types/ChannelService';
import {
  appendTraceHistoryEntry,
  clearTraceHistory,
  readTraceHistoryEntries,
  type TraceHistoryEntry,
  writeTraceEntryToFile
} from '../utils/traceHistory';
import { EOL } from 'os';
import {
  Agent,
  AgentSource,
  PreviewableAgent,
  ProductionAgent,
  readTranscriptEntries,
  ScriptAgent
} from '@salesforce/agents';

// AgentSimulate may not be directly exported, import it dynamically if needed
let AgentSimulate: any;
try {
  const agentsModule = require('@salesforce/agents');
  AgentSimulate = agentsModule.AgentSimulate;
} catch {
  AgentSimulate = class {};
}

interface AgentMessage {
  type: string;
  message?: string;
  data?: unknown;
  body?: string;
}

class SessionStartCancelledError extends Error {
  constructor() {
    super('Agent session start was cancelled');
    this.name = 'SessionStartCancelledError';
  }
}

export class AgentCombinedViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sf.agent.combined.view';
  public webviewView?: vscode.WebviewView;

  private static instance: AgentCombinedViewProvider;
  private agentPreview?: ScriptAgent['preview'] | ProductionAgent['preview'];
  private agentInstance?: ScriptAgent | ProductionAgent;
  private sessionId = Date.now().toString();
  private isApexDebuggingEnabled = false;
  private isSessionActive = false;
  private isSessionStarting = false;
  private currentAgentName?: string;
  private currentAgentId?: string;
  private currentAgentSource?: AgentSource;
  private currentPlanId?: string;
  private currentUserMessage?: string;
  private isLiveMode = false;
  private sessionStartOperationId = 0;
  private pendingStartAgentId?: string;
  private pendingStartAgentSource?: AgentSource;
  private readonly channelService: ChannelService;

  private static readonly LIVE_MODE_KEY = 'agentforceDX.lastLiveMode';
  private static readonly DEBUG_MODE_KEY = 'agentforceDX.lastDebugMode';

  constructor(private readonly context: vscode.ExtensionContext) {
    AgentCombinedViewProvider.instance = this;
    // Load the last selected mode from storage
    this.isLiveMode = this.context.globalState.get<boolean>(AgentCombinedViewProvider.LIVE_MODE_KEY, false);
    this.isApexDebuggingEnabled = this.context.globalState.get<boolean>(
      AgentCombinedViewProvider.DEBUG_MODE_KEY,
      false
    );
    this.channelService = CoreExtensionService.getChannelService();

    void this.setResetAgentViewAvailable(false);
    void this.setSessionErrorState(false);
    void this.setConversationDataAvailable(false);
    // Set initial debug mode context without persisting again
    void vscode.commands.executeCommand('setContext', 'agentforceDX:debugMode', this.isApexDebuggingEnabled);
  }

  public static getInstance(): AgentCombinedViewProvider {
    return AgentCombinedViewProvider.instance;
  }

  /**
   * Updates the session active state and context
   */
  private async setSessionActive(active: boolean): Promise<void> {
    this.isSessionActive = active;
    await vscode.commands.executeCommand('setContext', 'agentforceDX:sessionActive', active);
  }

  private async setSessionStarting(starting: boolean): Promise<void> {
    this.isSessionStarting = starting;
    await vscode.commands.executeCommand('setContext', 'agentforceDX:sessionStarting', starting);
  }

  private beginSessionStart(): number {
    return ++this.sessionStartOperationId;
  }

  private createSessionStartGuards(startId: number): {
    ensureActive: () => void;
    isActive: () => boolean;
  } {
    return {
      ensureActive: () => this.ensureSessionStartNotCancelled(startId),
      isActive: () => this.isSessionStartActive(startId)
    };
  }

  private isSessionStartActive(startId: number): boolean {
    return this.sessionStartOperationId === startId;
  }

  private ensureSessionStartNotCancelled(startId: number): void {
    if (this.sessionStartOperationId !== startId) {
      throw new SessionStartCancelledError();
    }
  }

  private cancelPendingSessionStart(): void {
    this.sessionStartOperationId += 1;
  }

  /**
   * Updates the agent selected state and context
   */
  private async setAgentSelected(selected: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'agentforceDX:agentSelected', selected);
    if (!selected) {
      await this.setResetAgentViewAvailable(false);
      await this.setSessionErrorState(false);
      await this.setConversationDataAvailable(false);
    }
  }

  /**
   * Updates the debug mode state and context
   */
  private async setDebugMode(enabled: boolean): Promise<void> {
    this.isApexDebuggingEnabled = enabled;
    await vscode.commands.executeCommand('setContext', 'agentforceDX:debugMode', enabled);
    // Persist the debug mode selection for next session
    await this.context.globalState.update(AgentCombinedViewProvider.DEBUG_MODE_KEY, enabled);
  }

  /**
   * Updates the live mode state and context
   */
  private async setLiveMode(isLive: boolean): Promise<void> {
    this.isLiveMode = isLive;
    await vscode.commands.executeCommand('setContext', 'agentforceDX:isLiveMode', isLive);
    // Persist the mode selection for next session
    await this.context.globalState.update(AgentCombinedViewProvider.LIVE_MODE_KEY, isLive);
  }

  private async setResetAgentViewAvailable(available: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'agentforceDX:canResetAgentView', available);
  }

  private async setSessionErrorState(hasError: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'agentforceDX:sessionError', hasError);
  }

  private async setConversationDataAvailable(available: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'agentforceDX:hasConversationData', available);
  }

  /**
   * Toggles debug mode on/off
   */
  public async toggleDebugMode(): Promise<void> {
    const newDebugMode = !this.isApexDebuggingEnabled;
    await this.setDebugMode(newDebugMode);

    // If we have an active agent preview, update its debug mode
    if (this.agentPreview) {
      this.agentPreview.setApexDebugging(newDebugMode);
    }

    const statusMessage = newDebugMode ? 'Debug mode activated.' : 'Debug mode deactivated.';
    vscode.window.showInformationMessage(statusMessage);
  }

  /**
   * Gets the currently selected agent ID
   * @returns The current agent's Bot ID, or undefined if no agent is selected
   */
  public getCurrentAgentId(): string | undefined {
    return this.currentAgentId;
  }

  /**
   * Selects an agent and starts a session
   * @param agentId The agent's Bot ID
   */
  public selectAndStartAgent(agentId: string): void {
    if (this.webviewView) {
      this.webviewView.webview.postMessage({
        command: 'selectAgent',
        data: { agentId, forceRestart: true }
      });
    }
  }

  /**
   * Ends the current agent session
   */
  public async endSession(): Promise<void> {
    this.cancelPendingSessionStart();
    const sessionWasStarting = this.isSessionStarting;

    if (this.agentPreview && this.sessionId) {
      // AgentSimulate.end() doesn't take parameters, but AgentPreview.end() does
      // Both extend AgentPreviewBase, so we need to handle this carefully
      const isAgentSimulate = (this.currentAgentSource = AgentSource.SCRIPT);
      if (isAgentSimulate) {
        await (this.agentPreview as any).end();
      } else {
        await this.agentPreview.end(this.sessionId, 'UserRequest');
      }
      // Restore connection before clearing agent references
      if (this.agentInstance) {
        try {
          await this.agentInstance.restoreConnection();
        } catch (error) {
          console.warn('Error restoring connection:', error);
        }
      }
      this.agentPreview = undefined;
      this.agentInstance = undefined;
      this.sessionId = Date.now().toString();
      this.currentAgentName = undefined;
      this.currentPlanId = undefined;
      // Note: Don't clear currentAgentId here - it tracks the dropdown selection, not session state
      await this.setSessionActive(false);
      await this.setSessionStarting(false);
      // Note: Don't reset debug mode here - it should persist across sessions like live mode

      if (this.webviewView) {
        this.webviewView.webview.postMessage({
          command: 'sessionEnded',
          data: {}
        });
      }
    } else if (sessionWasStarting) {
      await this.setSessionActive(false);
      await this.setSessionStarting(false);

      if (this.webviewView) {
        this.webviewView.webview.postMessage({
          command: 'sessionEnded',
          data: {}
        });
      }
    }

    if (sessionWasStarting) {
      await this.restoreViewAfterCancelledStart();
    }

    this.pendingStartAgentId = undefined;
    this.pendingStartAgentSource = undefined;

    this.channelService.appendLine(`Simulation ended.`);
    this.channelService.appendLine('---------------------');
  }

  /**
   * Restarts the agent session without recompilation
   * This provides a lightweight restart by reusing the existing agentPreview instance
   */
  public async restartWithoutCompilation(): Promise<void> {
    if (!this.agentPreview || !this.webviewView) {
      return;
    }

    try {
      // Set sessionStarting to show loading state
      await this.setSessionStarting(true);

      // End the current session but keep the agentPreview instance
      const isAgentSimulate = this.agentPreview && this.currentAgentSource === AgentSource.SCRIPT;
      if (isAgentSimulate) {
        await (this.agentPreview as any).end();
      } else {
        await this.agentPreview.end(this.sessionId, 'UserRequest');
      }
      // Restore connection after ending session (but keep agent instance for restart)
      if (this.agentInstance) {
        try {
          await this.agentInstance.restoreConnection();
        } catch (error) {
          console.warn('Error restoring connection:', error);
        }
      }

      // Clear conversation state
      this.currentPlanId = undefined;
      this.currentUserMessage = undefined;
      await this.setConversationDataAvailable(false);

      // Clear the UI
      this.webviewView.webview.postMessage({
        command: 'clearMessages'
      });

      // Show "Starting live test..." message
      const isLiveMode = this.isLiveMode;
      const modeMessage = isLiveMode ? 'Starting live test...' : 'Starting simulation...';
      this.webviewView.webview.postMessage({
        command: 'simulationStarting',
        data: { message: modeMessage }
      });

      this.channelService.appendLine('Restarting agent session...');

      // Start a new session on the existing agentPreview (should skip compilation)
      const session = await this.agentPreview.start();
      this.sessionId = session.sessionId;

      // Load trace history if available
      if (this.currentAgentId && this.currentAgentSource) {
        const storageKey = this.getAgentStorageKey(this.currentAgentId, this.currentAgentSource);
        await clearTraceHistory(storageKey);
        await this.loadAndSendTraceHistory(this.currentAgentId, this.currentAgentSource, this.webviewView);
      }

      await this.setSessionActive(true);
      await this.setSessionStarting(false);

      // Send session started message with welcome message
      const agentMessage = session.messages.find((msg: any) => msg.type === 'Inform');
      this.webviewView.webview.postMessage({
        command: 'sessionStarted',
        data: agentMessage?.message
      });

      await this.setConversationDataAvailable(true);

      this.channelService.appendLine('Agent session restarted.');
      this.channelService.appendLine('---------------------');
    } catch (error) {
      await this.setSessionStarting(false);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.channelService.appendLine(`Failed to restart session: ${errorMessage}`);

      if (this.webviewView) {
        this.webviewView.webview.postMessage({
          command: 'error',
          data: { message: `Failed to restart: ${errorMessage}` }
        });
      }
    }
  }

  public setAgentId(agentId: string) {
    this.currentAgentId = agentId;
  }

  /**
   * Refreshes the available agents list by posting a message to the webview
   * This will trigger the webview to request agents again and clear the current selection
   */
  public async refreshAvailableAgents(): Promise<void> {
    await this.endSession();
    this.currentAgentId = undefined;

    if (this.webviewView) {
      // Clear the current agent selection
      this.currentAgentId = undefined;
      this.currentAgentName = undefined;
      await this.setAgentSelected(false);
      await this.setSessionActive(false);
      await this.setSessionStarting(false);
      // Note: Don't reset debug mode here - it should persist like live mode
      await this.setResetAgentViewAvailable(false);
      this.pendingStartAgentId = undefined;
      this.pendingStartAgentSource = undefined;

      // Reset the webview state to the default placeholder
      this.webviewView.webview.postMessage({
        command: 'selectAgent',
        data: { agentId: '' }
      });
      this.webviewView.webview.postMessage({
        command: 'clearMessages'
      });
      this.webviewView.webview.postMessage({
        command: 'noHistoryFound',
        data: { agentId: 'refresh-placeholder' }
      });

      // Send a message to the webview to trigger getAvailableAgents
      this.webviewView.webview.postMessage({
        command: 'refreshAgents'
      });
    }
  }

  private async postErrorMessage(webviewView: vscode.WebviewView, message: string): Promise<void> {
    await this.setResetAgentViewAvailable(true);
    await this.setSessionErrorState(true);
    // Strip any remaining HTML tags as a safety measure
    const sanitizedMessage = this.stripHtmlTags(message);
    await webviewView.webview.postMessage({
      command: 'error',
      data: { message: sanitizedMessage }
    });
  }

  private stripHtmlTags(text: string): string {
    // Remove HTML tags from text and normalize whitespace
    return text
      .replace(/<[^>]*>/g, ' ') // Replace tags with space to preserve word boundaries
      .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
      .trim();
  }

  private sanitizeFileName(name: string): string {
    return name
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async saveConversationExport(content: string, suggestedFileName?: string): Promise<void> {
    if (!content || content.trim() === '') {
      vscode.window.showWarningMessage('No conversation data available to export.');
      return;
    }

    const fallbackBase = this.sanitizeFileName(this.currentAgentName || 'agent') || 'agent';
    const timestamp = new Date().toISOString().replace(/[:]/g, '-');
    const suggestedBase =
      suggestedFileName && suggestedFileName.trim() !== ''
        ? this.sanitizeFileName(suggestedFileName.replace(/\.md$/i, ''))
        : undefined;
    const defaultNameBase =
      suggestedBase && suggestedBase.length > 0 ? suggestedBase : `${fallbackBase}-conversation-${timestamp}`;
    const defaultName = defaultNameBase.endsWith('.md') ? defaultNameBase : `${defaultNameBase}.md`;

    const defaultFolder = vscode.workspace.workspaceFolders?.[0]?.uri ?? this.context.globalStorageUri;
    const defaultUri = defaultFolder ? vscode.Uri.joinPath(defaultFolder, defaultName) : undefined;

    const targetUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: {
        Markdown: ['md'],
        Text: ['txt']
      },
      saveLabel: 'Save Conversation'
    });

    if (!targetUri) {
      return;
    }

    const encoder = new TextEncoder();
    try {
      await vscode.workspace.fs.writeFile(targetUri, encoder.encode(content));
      vscode.window.showInformationMessage(`Conversation was saved to ${targetUri.fsPath}.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to save conversation: ${errorMessage}`);
    }
  }

  /**
   * Determines the agent source type based on the agent ID
   * Looks up the agent in the PreviewableAgent list
   * @param agentId The agent identifier (file path for script agents or Bot ID for org agents)
   * @param agents Optional list of agents to search. If not provided, will fetch from org.
   * @returns AgentSource.SCRIPT for script agents, AgentSource.PUBLISHED for org agents
   */
  private async getAgentSource(agentId: string, agents?: PreviewableAgent[]): Promise<AgentSource> {
    let agentList = agents;
    if (!agentList) {
      try {
        const conn = await CoreExtensionService.getDefaultConnection();
        const project = SfProject.getInstance();
        agentList = await Agent.listPreviewable(conn, project);
      } catch (err) {
        console.error('Error loading agents for source lookup:', err);
        // Default to PUBLISHED if we can't determine
        return AgentSource.PUBLISHED;
      }
    }
    
    const agent = agentList.find(a => a.id === agentId);
    if (agent) {
      return agent.source === 'script' ? AgentSource.SCRIPT : AgentSource.PUBLISHED;
    }
    
    // Default to PUBLISHED if not found
    return AgentSource.PUBLISHED;
  }

  /**
   * Validates that an agent ID is a valid Salesforce Bot ID format
   * @param agentId The agent ID to validate
   * @throws Error if the agent ID is not a valid Bot ID format
   */
  private validatePublishedAgentId(agentId: string): void {
    if (!agentId.startsWith('0X') || (agentId.length !== 15 && agentId.length !== 18)) {
      throw new Error(`The Bot ID provided must begin with "0X" and be either 15 or 18 characters. Found: ${agentId}`);
    }
  }

  private getAgentStorageKey(agentId: string, agentSource: AgentSource): string {
    if (agentSource === AgentSource.SCRIPT) {
      // For script agents, agentId is the file path
      return path.basename(agentId);
    }
    // For org agents, agentId is the Bot ID
    return agentId;
  }

  /**
   * Load conversation history for an agent and send it to the webview
   * Uses readTranscriptEntries from @salesforce/agents library
   */
  private async loadAndSendConversationHistory(
    agentId: string,
    agentSource: AgentSource,
    webviewView: vscode.WebviewView
  ): Promise<boolean> {
    try {
      const agentName = this.getAgentStorageKey(agentId, agentSource);

      // Use readTranscriptEntries from @salesforce/agents library
      // This reads from .sfdx/agents/conversations/<agentName>/history.json
      // For script agents: <name>.agent
      // For published agents: <agentId> (Bot ID)
      const transcriptEntries = await readTranscriptEntries(agentName);

      if (transcriptEntries && transcriptEntries.length > 0) {
        // Convert transcript entries to messages format for the webview
        const historyMessages = transcriptEntries
          .filter(entry => entry.text) // Only include entries with text content
          .map(entry => ({
            id: `${entry.timestamp}-${entry.sessionId}`,
            type: entry.role === 'user' ? 'user' : 'agent',
            content: entry.text || '',
            timestamp: entry.timestamp
          }));

        if (historyMessages.length > 0) {
          webviewView.webview.postMessage({
            command: 'conversationHistory',
            data: { messages: historyMessages }
          });
          await this.setConversationDataAvailable(true);
          return true;
        }
      }
    } catch (err) {
      // Log error details for debugging
      console.error('Could not load conversation history:', err);
      if (err instanceof Error) {
        console.error('Error stack:', err.stack);
      }
    }

    await this.setConversationDataAvailable(false);
    return false;
  }

  private async loadAndSendTraceHistory(
    agentId: string,
    agentSource: AgentSource,
    webviewView: vscode.WebviewView
  ): Promise<void> {
    try {
      const agentStorageKey = this.getAgentStorageKey(agentId, agentSource);
      const entries = await readTraceHistoryEntries(agentStorageKey);
      webviewView.webview.postMessage({
        command: 'traceHistory',
        data: { agentId, entries }
      });
    } catch (error) {
      console.error('Could not load trace history:', error);
      webviewView.webview.postMessage({
        command: 'traceHistory',
        data: { agentId, entries: [] }
      });
    }
  }

  private async persistTraceHistory(traceData: unknown): Promise<void> {
    if (!this.currentAgentId || !this.currentAgentSource) {
      return;
    }

    const agentStorageKey = this.getAgentStorageKey(this.currentAgentId, this.currentAgentSource);
    const entry: TraceHistoryEntry = {
      storageKey: agentStorageKey,
      agentId: this.currentAgentId,
      sessionId: (traceData as { sessionId?: string })?.sessionId ?? this.sessionId ?? '',
      planId: (traceData as { planId?: string })?.planId ?? this.currentPlanId ?? '',
      messageId: this.currentPlanId,
      userMessage: this.currentUserMessage,
      timestamp: new Date().toISOString(),
      trace: traceData
    };

    try {
      await appendTraceHistoryEntry(agentStorageKey, entry);
    } catch (error) {
      console.error('Could not persist trace history:', error);
    }
  }

  private async sendLastStoredTraceData(webviewView: vscode.WebviewView): Promise<boolean> {
    if (!this.currentAgentId || !this.currentAgentSource) {
      return false;
    }

    const agentStorageKey = this.getAgentStorageKey(this.currentAgentId, this.currentAgentSource);
    const entries = await readTraceHistoryEntries(agentStorageKey);
    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : undefined;
    if (lastEntry) {
      webviewView.webview.postMessage({
        command: 'traceData',
        data: lastEntry.trace
      });
      return true;
    }
    return false;
  }

  private async openTraceJsonEntry(entryData: TraceHistoryEntry | undefined): Promise<void> {
    if (!entryData || typeof entryData !== 'object' || !entryData.storageKey) {
      vscode.window.showErrorMessage('Unable to open trace JSON: Missing trace details.');
      return;
    }

    try {
      const filePath = await writeTraceEntryToFile(entryData);
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      await vscode.window.showTextDocument(document, { preview: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Unable to open trace JSON: ${errorMessage}`);
      console.error('Unable to open trace JSON file:', error);
    }
  }

  private async restoreViewAfterCancelledStart(): Promise<void> {
    if (!this.webviewView) {
      return;
    }

    const agentId = this.pendingStartAgentId ?? this.currentAgentId;
    if (!agentId) {
      return;
    }

    const agentSource = this.pendingStartAgentSource ?? await this.getAgentSource(agentId);
    await this.showHistoryOrPlaceholder(agentId, agentSource, this.webviewView);
  }

  private async showHistoryOrPlaceholder(
    agentId: string,
    agentSource: AgentSource,
    webviewView: vscode.WebviewView
  ): Promise<void> {
    webviewView.webview.postMessage({
      command: 'clearMessages'
    });

    try {
      await this.loadAndSendTraceHistory(agentId, agentSource, webviewView);
      const hasHistory = await this.loadAndSendConversationHistory(agentId, agentSource, webviewView);

      if (!hasHistory) {
        webviewView.webview.postMessage({
          command: 'noHistoryFound',
          data: { agentId }
        });
      }
    } catch (err) {
      console.error('Error loading history:', err);
      await this.setConversationDataAvailable(false);
      webviewView.webview.postMessage({
        command: 'noHistoryFound',
        data: { agentId }
      });
    }
  }

  /**
   * Builds the agent list used by the command palette quick pick
   */
  public async getAgentsForCommandPalette(): Promise<PreviewableAgent[]> {
    try {
      const conn = await CoreExtensionService.getDefaultConnection();
      const project = SfProject.getInstance();

      return await Agent.listPreviewable(conn, project);
    } catch (error) {
      console.error('Error getting agents for command palette:', error);
      return [];
    }
  }

  /**
   * Resets the current agent view back to the most recent history or placeholder
   */
  public async resetCurrentAgentView(): Promise<void> {
    if (!this.webviewView) {
      throw new Error('Agent view is not ready to reset.');
    }

    if (!this.currentAgentId) {
      throw new Error('No agent selected to reset.');
    }

    const agentSource = await this.getAgentSource(this.currentAgentId);
    await this.showHistoryOrPlaceholder(this.currentAgentId, agentSource, this.webviewView);
    await this.setResetAgentViewAvailable(false);
    await this.setSessionErrorState(false);
  }

  /**
   * Requests the webview to gather the current conversation data for export.
   */
  public async exportConversation(): Promise<void> {
    if (!this.webviewView) {
      throw new Error('Agent view is not ready.');
    }

    if (!this.currentAgentId) {
      throw new Error('No agent selected to export.');
    }

    this.webviewView.webview.postMessage({
      command: 'requestConversationExport',
      data: {
        agentId: this.currentAgentId,
        agentName: this.currentAgentName ?? this.currentAgentId
      }
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist')]
    };
    webviewView.webview.onDidReceiveMessage(async message => {
      try {
        if (message.command === 'startSession') {
          const sessionStartId = this.beginSessionStart();
          const { ensureActive, isActive } = this.createSessionStartGuards(sessionStartId);

          try {
            await this.setSessionStarting(true);
            ensureActive();

            // Clear any previous error messages before starting a new session
            webviewView.webview.postMessage({
              command: 'clearMessages'
            });

            webviewView.webview.postMessage({
              command: 'sessionStarting',
              data: { message: 'Starting session...' }
            });

            // End existing session if one exists
            if (this.agentPreview && this.sessionId) {
              try {
                // AgentSimulate.end() doesn't take parameters, but AgentPreview.end() does
                const isAgentSimulate = this.agentPreview && this.currentAgentSource === AgentSource.SCRIPT;
                if (isAgentSimulate) {
                  await this.agentPreview.end();
                } else {
                  await this.agentPreview.end(this.sessionId, 'UserRequest');
                }
                // Restore connection after ending session
                if (this.agentInstance) {
                  try {
                    await this.agentInstance.restoreConnection();
                  } catch (error) {
                    console.warn('Error restoring connection:', error);
                  }
                }
                ensureActive();
              } catch (err) {
                console.warn('Error ending previous session:', err);
              }
            }

            // Reset planId when starting a new session
            this.currentPlanId = undefined;

            // Get the default connection from target-org
            const conn = await CoreExtensionService.getDefaultConnection();
            ensureActive();

            // Extract agentId from the message data - prioritize message data over currentAgentId
            // This ensures the selected agent from the dropdown is used, not a stale currentAgentId
            const agentId = message.data?.agentId || this.currentAgentId;

            if (!agentId || typeof agentId !== 'string') {
              throw new Error(`Invalid agent ID: ${agentId}. Expected a string.`);
            }

            // Update currentAgentId to match the selected agent
            this.currentAgentId = agentId;

            // Get project instance - needed for both script and published agents
            const project = SfProject.getInstance();

            // Load agents list to determine source
            const allAgents = await Agent.listPreviewable(conn, project);
            
            // Determine agent source type using the library's AgentSource enum
            const agentSource = allAgents.find(a => a.name === agentId)?.source === 'script' ? AgentSource.SCRIPT : AgentSource.PUBLISHED;
            this.pendingStartAgentId = agentId;
            this.pendingStartAgentSource = agentSource;

            if (agentSource === AgentSource.SCRIPT) {
              // Handle script agent (.agent file)
              // For script agents, agentId is the file path
              const filePath = agentId;

              if (!filePath) {
                throw new Error('No file path found for script agent.');
              }

              // Verify the file exists
              const resolvedFilePath = path.resolve(filePath);
              try {
                await vscode.workspace.fs.stat(vscode.Uri.file(resolvedFilePath));
              } catch (error) {
                throw new Error(`Agent file not found: ${resolvedFilePath}. Please ensure the file exists.`);
              }

              // Determine mode before setting up listeners
              const isLiveMode = message.data?.isLiveMode ?? false;
              await this.setLiveMode(isLiveMode);
              ensureActive();

              // Set up lifecycle event listeners for compilation progress
              // Remove all existing listeners for these events to prevent duplicates
              const lifecycle = Lifecycle.getInstance();
              lifecycle.removeAllListeners?.('agents:compiling');
              lifecycle.removeAllListeners?.('agents:simulation-starting');

              // Listen for compilation events
              lifecycle.on('agents:compiling', async (data: { message?: string; error?: string }) => {
                if (!isActive()) {
                  return;
                }
                if (data.error) {
                  webviewView.webview.postMessage({
                    command: 'compilationError',
                    data: { message: data.error }
                  });
                } else {
                  this.channelService.appendLine(`SF_TEST_API = ${process.env.SF_TEST_API ?? 'false'}`);
                  this.channelService.appendLine(`Compilation end point called.`);

                  webviewView.webview.postMessage({
                    command: 'compilationStarting',
                    data: { message: data.message || 'Compiling agent...' }
                  });
                }
              });

              // Listen for simulation starting event
              lifecycle.on('agents:simulation-starting', async (data: { message?: string }) => {
                if (!isActive()) {
                  return;
                }

                this.channelService.appendLine(`Simulation session started.`);

                const modeMessage = isLiveMode ? 'Starting live test...' : 'Starting simulation...';
                webviewView.webview.postMessage({
                  command: 'simulationStarting',
                  data: { message: data.message || modeMessage }
                });
              });

              // Create AgentSimulate with just the file path
              // mockActions: true = simulate (mock actions), false = live test (real side effects)
              // The lifecycle listeners will automatically handle compilation progress messages
              const mockActions = !isLiveMode; // Simulate = true, Live Test = false
              // aabDirectory should point to the directory containing the .agent file, not the file itself
              // Ensure it's an absolute path to avoid path resolution issues
              const aabDirectory = path.resolve(path.dirname(resolvedFilePath));
              const agent = await Agent.init({
                connection: conn,
                aabDirectory,
                project: project as any
              } as any);
              this.agentInstance = agent;
              this.agentPreview = agent.preview;
              this.currentAgentName = path.basename(resolvedFilePath, '.agent');
              this.currentAgentId = agentId;

              // Enable debug mode from apex debugging setting
              if (this.isApexDebuggingEnabled) {
                this.agentPreview.setApexDebugging(this.isApexDebuggingEnabled);
              }
            } else {
              // Handle published agent (org agent)
              // Validate that the agentId follows Salesforce Bot ID format
              this.validatePublishedAgentId(agentId);

              // Published agents are always in live mode
              await this.setLiveMode(true);
              ensureActive();

              const agent = await Agent.init({ connection: conn, project: project as any, apiNameOrId: agentId });

              this.agentInstance = agent;
              this.agentPreview = agent.preview;

              // Get agent name for notifications
              const remoteAgents = await Agent.listRemote(conn as any);
              ensureActive();
              this.currentAgentName = agent.name;
              this.currentAgentId = agentId;

              // Enable debug mode from apex debugging setting
              if (this.isApexDebuggingEnabled) {
                this.agentPreview.setApexDebugging(this.isApexDebuggingEnabled);
              }
            }

            this.currentAgentSource = agentSource;

            if (!this.agentPreview) {
              throw new Error('Failed to initialize agent preview.');
            }

            // Start the session - this will trigger compilation for local agents
            const session = await this.agentPreview.start();
            ensureActive();
            this.sessionId = session.sessionId;

            const storageKey = this.getAgentStorageKey(agentId, agentSource);
            await clearTraceHistory(storageKey);
            await this.loadAndSendTraceHistory(agentId, agentSource, webviewView);
            await this.setSessionActive(true);
            ensureActive();
            await this.setSessionStarting(false);
            ensureActive();

            // Find the agent's welcome message or create a default one
            const agentMessage = session.messages.find((msg: any) => msg.type === 'Inform');
            webviewView.webview.postMessage({
              command: 'sessionStarted',
              data: agentMessage?.message
            });
            this.pendingStartAgentId = undefined;
            this.pendingStartAgentSource = undefined;
            await this.setConversationDataAvailable(true);
          } catch (err) {
            if (err instanceof SessionStartCancelledError || !isActive()) {
              return;
            }

            // Check if this is a compilation error and extract detailed information
            // Use this.currentAgentSource since agentSource may be out of scope
            if (
              this.currentAgentSource === AgentSource.SCRIPT &&
              err instanceof SfError &&
              err.message.includes('Failed to compile agent script')
            ) {
              const sfError = err as SfError;
              const detailedError = `Failed to compile agent script${EOL}${sfError.name}`;
              this.channelService.appendLine(detailedError);
              webviewView.webview.postMessage({
                command: 'compilationError',
                data: { message: detailedError }
              });
              // Don't re-throw, the error has been handled and shown to the user
              return;
            }

            this.channelService.appendLine(`Error starting session: ${err}`);
            this.channelService.appendLine('---------------------');

            throw err;
          }
        } else if (message.command === 'setApexDebugging') {
          await this.setDebugMode(message.data);
          // If we have an active agent preview, update its debug mode
          if (this.agentPreview) {
            this.agentPreview.setApexDebugging(this.isApexDebuggingEnabled);
          }
        } else if (message.command === 'sendChatMessage') {
          if (!this.agentPreview || !this.sessionId) {
            throw new Error('Session has not been started.');
          }

          webviewView.webview.postMessage({
            command: 'messageStarting',
            data: { message: 'Sending message...' }
          });

          const userMessage = message.data.message;
          this.channelService.appendLine(`Simulation message sent - "${userMessage}"`);

          const response = await this.agentPreview.send(userMessage);

          // Get the latest agent response
          const lastMessage = response.messages?.at(-1);
          this.currentPlanId = lastMessage?.planId;
          this.currentUserMessage = userMessage;

          webviewView.webview.postMessage({
            command: 'messageSent',
            data: { content: lastMessage?.message }
          });

          this.channelService.appendLine(`Simulation message received - "${lastMessage?.message}"`);

          if (this.isApexDebuggingEnabled && response.apexDebugLog) {
            try {
              const logPath = await this.saveApexDebugLog(response.apexDebugLog);
              if (logPath) {
                // Try to launch the apex replay debugger if the command is available
                try {
                  // Auto-continue the debugger to run until it hits actual Apex code with breakpoints
                  // This eliminates the need for manual user interaction (clicking "Continue" button)
                  this.setupAutoDebugListeners();
                  await vscode.commands.executeCommand('sf.launch.replay.debugger.logfile.path', logPath);
                } catch (commandErr) {
                  // If command execution fails, just log it but don't show user message
                  console.warn('Could not launch Apex Replay Debugger:', commandErr);
                }
              }
            } catch (err) {
              console.error('Error handling apex debug log:', err);
              const errorMessage = err instanceof Error ? err.message : 'Unknown error';
              vscode.window.showErrorMessage(`Error processing debug log: ${errorMessage}`);

              // Notify webview about the error
              webviewView.webview.postMessage({
                command: 'debugLogError',
                data: {
                  message: `Error processing debug log: ${errorMessage}`
                }
              });
            }
          } else if (this.isApexDebuggingEnabled && !response.apexDebugLog) {
            // Debug mode is enabled but no debug log was returned
            vscode.window.showInformationMessage('Debug mode is enabled but no Apex was executed.');
          }
        } else if (message.command === 'endSession') {
          await this.endSession();
        } else if (message.command === 'loadAgentHistory') {
          // Load conversation history for the selected agent
          // If history exists: Show it and wait for user to manually start session
          // If no history: Send noHistoryFound signal so webview can show placeholder
          const agentId = message.data?.agentId;
          if (agentId && typeof agentId === 'string') {
          const agentSource = await this.getAgentSource(agentId);
            await this.showHistoryOrPlaceholder(agentId, agentSource, webviewView);
          }
        } else if (message.command === 'getAvailableAgents') {
          try {
            const conn = await CoreExtensionService.getDefaultConnection();
            const project = SfProject.getInstance();

            const allAgents = await Agent.listPreviewable(conn, project);

            // Map PreviewableAgent to the format expected by webview
            // source: 'org' -> type: 'published', source: 'script' -> type: 'script'
            const mappedAgents = allAgents.map(agent => ({
              name: agent.name,
              id: agent.id,
              type: agent.source === 'org' ? 'published' : 'script'
            }));

            webviewView.webview.postMessage({
              command: 'availableAgents',
              data: {
                agents: mappedAgents,
                selectedAgentId: this.currentAgentId
              }
            });

            if (this.currentAgentId) {
              this.currentAgentId = undefined;
            }
          } catch (err) {
            console.error('Error getting available agents from org:', err);
            webviewView.webview.postMessage({
              command: 'availableAgents',
              data: []
            });
          }
        } else if (message.command === 'getTraceData') {
          try {
            const emptyTraceData = { plan: [], planId: '', sessionId: '' };

            // If no agent preview or session, return empty data instead of throwing error
            if (!this.agentPreview || !this.sessionId) {
              const restored = await this.sendLastStoredTraceData(webviewView);
              if (!restored) {
                webviewView.webview.postMessage({
                  command: 'traceData',
                  data: emptyTraceData
                });
              }
              return;
            }

            const isAgentSimulate = this.agentPreview && this.currentAgentSource === AgentSimulate;
            if (!isAgentSimulate || !this.currentPlanId) {
              const restored = await this.sendLastStoredTraceData(webviewView);
              if (!restored) {
                webviewView.webview.postMessage({
                  command: 'traceData',
                  data: emptyTraceData
                });
              }
              return;
            }

            if (this.currentAgentId && this.currentAgentSource) {
              await this.loadAndSendTraceHistory(this.currentAgentId, this.currentAgentSource, webviewView);
            }

            // webviewView.webview.postMessage({
            //   command: 'traceData',
            //   data
            // });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            await this.postErrorMessage(webviewView, errorMessage);
          }
        } else if (message.command === 'openTraceJson') {
          await this.openTraceJsonEntry(message.data?.entry);
        } else if (message.command === 'getConfiguration') {
          // Get configuration values
          const config = vscode.workspace.getConfiguration();
          const section = message.data?.section;
          if (section) {
            const value = config.get(section);
            webviewView.webview.postMessage({
              command: 'configuration',
              data: { section, value }
            });
          }
        } else if (message.command === 'executeCommand') {
          // Execute a VSCode command from the webview
          const commandId = message.data?.commandId;
          if (commandId && typeof commandId === 'string') {
            await vscode.commands.executeCommand(commandId);
          }
        } else if (message.command === 'setSelectedAgentId') {
          // Update the currently selected agent ID from the dropdown
          const agentId = message.data?.agentId;
          if (agentId && typeof agentId === 'string' && agentId !== '') {
          this.currentAgentId = agentId;
          this.currentAgentSource = await this.getAgentSource(agentId);
            await this.setAgentSelected(true);
            await this.setResetAgentViewAvailable(false);
            await this.setSessionErrorState(false);
            await this.setConversationDataAvailable(false);
          } else {
            this.currentAgentId = undefined;
            this.currentAgentSource = undefined;
            await this.setAgentSelected(false);
          }
        } else if (message.command === 'setLiveMode') {
          // Update and persist the live mode selection
          const isLiveMode = message.data?.isLiveMode;
          if (typeof isLiveMode === 'boolean') {
            await this.setLiveMode(isLiveMode);
          }
        } else if (message.command === 'getInitialLiveMode') {
          // Send current live mode state to webview
          webviewView.webview.postMessage({
            command: 'setLiveMode',
            data: { isLiveMode: this.isLiveMode }
          });
        } else if (message.command === 'conversationExportReady') {
          const markdown = message.data?.content;
          const fileName = message.data?.fileName;
          if (typeof markdown === 'string' && markdown.trim() !== '') {
            await this.saveConversationExport(markdown, fileName);
          } else {
            vscode.window.showWarningMessage("Conversation couldn't be exported.");
          }
        }
      } catch (err) {
        console.error('AgentCombinedViewProvider Error:', err);
        let errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        this.channelService.appendLine(`Error: ${errorMessage}`);
        this.channelService.appendLine('---------------------');

        this.pendingStartAgentId = undefined;
        this.pendingStartAgentSource = undefined;

        // Clean up session state if connection failed
        // This ensures UI doesn't show as "connected" when the session actually failed
        if (this.agentPreview || this.isSessionActive) {
          this.agentPreview = undefined;
          this.sessionId = Date.now().toString();
          this.currentAgentName = undefined;
          this.currentPlanId = undefined;
          await this.setSessionActive(false);
          await this.setSessionStarting(false);
          // Note: Don't reset debug mode here - it should persist across errors
        }

        // Check for specific agent deactivation error
        if (
          errorMessage.includes('404') &&
          errorMessage.includes('NOT_FOUND') &&
          errorMessage.includes('No valid version available')
        ) {
          errorMessage =
            'This agent is currently deactivated, so you can\'t converse with it.  Activate the agent using either the "AFDX: Activate Agent" VS Code command or your org\'s Agentforce UI.';
        }
        // Check for other common agent errors
        else if (errorMessage.includes('NOT_FOUND') && errorMessage.includes('404')) {
          errorMessage =
            "The selected agent couldn't be found. Either it's been deleted or you don't have access to it.";
        }
        // Check for permission errors
        else if (errorMessage.includes('403') || errorMessage.includes('FORBIDDEN')) {
          errorMessage = "You don't have permission to use this agent. Consult your Salesforce administrator.";
        }

        await this.postErrorMessage(webviewView, errorMessage);
      }
    });

    webviewView.webview.html = this.getHtmlForWebview();
  }

  private getHtmlForWebview(): string {
    // Read the built HTML file which contains everything inlined
    const htmlPath = path.join(this.context.extensionPath, 'webview', 'dist', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Add VSCode webview API script injection
    const vscodeScript = `
      <script>
        const vscode = acquireVsCodeApi();
        window.vscode = vscode;
      </script>
    `;

    // Insert the vscode script before the closing head tag
    html = html.replace('</head>', `${vscodeScript}</head>`);

    return html;
  }

  /**
   * Automatically continues the Apex Replay Debugger after it's launched,
   * eliminating the need for manual user interaction (clicking "Continue" button).
   *
   * The debugger initially stops at the first instruction in the log, but users
   * typically want to continue execution until they reach actual Apex code where
   * they have set breakpoints. This method automates that process.
   */
  private setupAutoDebugListeners(): void {
    let debuggerLaunched = false;
    const disposables: vscode.Disposable[] = [];

    // Clean up function
    const cleanup = (): void => {
      disposables.forEach(d => d.dispose());
    };

    // Listen for debug session start
    const startDisposable = vscode.debug.onDidStartDebugSession(session => {
      console.log(`Debug session started - Type: "${session.type}", Name: "${session.name}"`);

      // Check if this is an Apex replay debugger session
      if (
        session.type === 'apex-replay' ||
        session.type === 'apex' ||
        session.name?.toLowerCase().includes('apex') ||
        session.name?.toLowerCase().includes('replay')
      ) {
        debuggerLaunched = true;
        console.log(`Apex replay debugger session detected: ${session.name}`);

        // Set up a timer to continue the debugger once it's ready
        // We need to wait for the debugger to fully initialize and stop at the first instruction
        setTimeout(async () => {
          try {
            if (vscode.debug.activeDebugSession) {
              console.log('Auto-continuing Apex replay debugger to reach breakpoints...');
              await vscode.commands.executeCommand('workbench.action.debug.continue');
              console.log('Successfully auto-continued Apex replay debugger');
            }
          } catch (continueErr) {
            console.warn('Could not auto-continue Apex replay debugger:', continueErr);
          }

          // Clean up listeners after attempting to continue
          cleanup();
        }, 1000); // 1 second delay to ensure debugger is fully ready
      }
    });
    disposables.push(startDisposable);

    // Failsafe cleanup after 15 seconds
    const timeoutDisposable = setTimeout(() => {
      if (!debuggerLaunched) {
        console.log('No Apex debugger session detected within timeout, cleaning up auto-continue listeners');
      }
      cleanup();
    }, 15000);
    disposables.push({ dispose: () => clearTimeout(timeoutDisposable) });
  }

  private async saveApexDebugLog(apexLog: ApexLog): Promise<string | undefined> {
    try {
      const conn = await CoreExtensionService.getDefaultConnection();
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace directory found to save the Apex debug logs.');
        return undefined;
      }

      const logId = apexLog.Id;
      if (!logId) {
        vscode.window.showErrorMessage('No Apex debug log ID found.');
        return undefined;
      }

      // Get the log content from Salesforce
      // Apex debug logs are retrieved via the Tooling API
      const url = `${conn.tooling._baseUrl()}/sobjects/ApexLog/${logId}/Body`;
      const logContent = await conn.tooling.request(url);

      // Apex debug logs are written to: .sfdx/tools/debug/logs
      const apexDebugLogPath = vscode.Uri.joinPath(workspaceFolder.uri, '.sfdx', 'tools', 'debug', 'logs');
      await vscode.workspace.fs.createDirectory(apexDebugLogPath);
      const filePath = vscode.Uri.joinPath(apexDebugLogPath, `${logId}.log`);

      // Write apex debug log to file
      const logContentStr = typeof logContent === 'string' ? logContent : JSON.stringify(logContent);
      await vscode.workspace.fs.writeFile(filePath, Buffer.from(logContentStr));

      return filePath.path;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      vscode.window.showErrorMessage(`Error saving Apex debug log: ${errorMessage}`);
      return undefined;
    }
  }
}
