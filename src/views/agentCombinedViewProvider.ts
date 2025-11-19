import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentPreview, Agent, AgentPreviewBase, readTranscriptEntries, AgentSource } from '@salesforce/agents';
import { AgentSimulate } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { getAvailableClientApps, createConnectionWithClientApp } from '../utils/clientAppUtils';
import type { ClientAppResult, ClientApp } from '../utils/clientAppUtils';
import type { ApexLog } from '@salesforce/types/tooling';
import { Lifecycle } from '@salesforce/core';
import type { Connection } from '@salesforce/core';
import {
  appendTraceHistoryEntry,
  readTraceHistoryEntries,
  clearTraceHistory,
  type TraceHistoryEntry
} from '../utils/traceHistory';

interface AgentMessage {
  type: string;
  message?: string;
  data?: unknown;
  body?: string;
}

interface AvailableAgent {
  name: string;
  id: string;
  type: 'published' | 'script';
  filePath?: string;
}

type ClientAppConnectionResult = { status: 'ready'; conn: Connection } | { status: 'handled' };

interface ClientAppConnectionHandlers {
  onNone?: (result: ClientAppResult) => Promise<ClientAppConnectionResult>;
  onMultiple?: (result: ClientAppResult) => Promise<ClientAppConnectionResult>;
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
  private agentPreview?: AgentPreviewBase;
  private sessionId = Date.now().toString();
  private apexDebugging = false;
  private selectedClientApp?: string;
  private sessionActive = false;
  private sessionStarting = false;
  private currentAgentName?: string;
  private currentAgentId?: string;
  private currentAgentSource?: AgentSource;
  private preselectedAgentId?: string;
  private latestPlanId?: string;
  private latestMessageId?: string;
  private latestUserMessage?: string;
  private isLiveMode = false;
  private sessionStartOperationId = 0;
  private pendingStartAgentId?: string;
  private pendingStartAgentSource?: AgentSource;
  private hasConversationData = false;

  private static readonly LIVE_MODE_KEY = 'agentforceDX.lastLiveMode';

  constructor(private readonly context: vscode.ExtensionContext) {
    AgentCombinedViewProvider.instance = this;
    // Load the last selected mode from storage
    this.isLiveMode = this.context.globalState.get<boolean>(AgentCombinedViewProvider.LIVE_MODE_KEY, false);
    void this.setResetAgentViewAvailable(false);
    void this.setSessionErrorState(false);
    void this.setConversationDataAvailable(false);
  }

  public static getInstance(): AgentCombinedViewProvider {
    return AgentCombinedViewProvider.instance;
  }

  /**
   * Updates the session active state and context
   */
  private async setSessionActive(active: boolean): Promise<void> {
    this.sessionActive = active;
    await vscode.commands.executeCommand('setContext', 'agentforceDX:sessionActive', active);
  }

  private async setSessionStarting(starting: boolean): Promise<void> {
    this.sessionStarting = starting;
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
    this.apexDebugging = enabled;
    await vscode.commands.executeCommand('setContext', 'agentforceDX:debugMode', enabled);
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
    this.hasConversationData = available;
    await vscode.commands.executeCommand('setContext', 'agentforceDX:hasConversationData', available);
  }

  /**
   * Toggles debug mode on/off
   */
  public async toggleDebugMode(): Promise<void> {
    const newDebugMode = !this.apexDebugging;
    await this.setDebugMode(newDebugMode);

    // If we have an active agent preview, update its debug mode
    if (this.agentPreview) {
      this.agentPreview.setApexDebugMode(newDebugMode);
    }

    // Notify webview
    if (this.webviewView) {
      this.webviewView.webview.postMessage({
        command: 'debugModeChanged',
        data: {
          enabled: newDebugMode,
          message: newDebugMode ? 'Debug mode activated' : 'Debug mode deactivated'
        }
      });
    }

    const statusMessage = newDebugMode ? 'Debug mode activated' : 'Debug mode deactivated';
    vscode.window.showInformationMessage(`AFDX: ${statusMessage}`);
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
    const sessionWasStarting = this.sessionStarting;

    if (this.agentPreview && this.sessionId) {
      const agentName = this.currentAgentName;
      // AgentSimulate.end() doesn't take parameters, but AgentPreview.end() does
      // Both extend AgentPreviewBase, so we need to handle this carefully
      if (this.agentPreview instanceof AgentSimulate) {
        await (this.agentPreview as AgentSimulate).end();
      } else {
        await (this.agentPreview as AgentPreview).end(this.sessionId, 'UserRequest');
      }
      this.agentPreview = undefined;
      this.sessionId = Date.now().toString();
      this.currentAgentName = undefined;
      this.latestPlanId = undefined;
      // Note: Don't clear currentAgentId here - it tracks the dropdown selection, not session state
      await this.setSessionActive(false);
      await this.setSessionStarting(false);
      await this.setDebugMode(false);
      await this.setLiveMode(false);

      // Show notification
      if (agentName) {
        vscode.window.showInformationMessage(`AFDX: Session ended with ${agentName}`);
      }

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
  }

  public setPreselectedAgentId(agentId: string) {
    this.preselectedAgentId = agentId;
  }

  /**
   * Refreshes the available agents list by posting a message to the webview
   * This will trigger the webview to request agents again and clear the current selection
   */
  public async refreshAvailableAgents(): Promise<void> {
    if (this.webviewView) {
      // Clear the current agent selection
      this.currentAgentId = undefined;
      this.currentAgentName = undefined;
      await this.setAgentSelected(false);
      await this.setSessionActive(false);
      await this.setSessionStarting(false);
      await this.setDebugMode(false);
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
    await webviewView.webview.postMessage({
      command: 'error',
      data: { message }
    });
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  private async saveConversationExport(content: string, suggestedFileName?: string): Promise<void> {
    if (!content || content.trim() === '') {
      vscode.window.showWarningMessage('Agentforce DX: No conversation data available to export.');
      return;
    }

    const fallbackBase = this.sanitizeFileName(this.currentAgentName || 'agent') || 'agent';
    const timestamp = new Date().toISOString().replace(/[:]/g, '-');
    const suggestedBase =
      suggestedFileName && suggestedFileName.trim() !== ''
        ? this.sanitizeFileName(suggestedFileName.replace(/\.md$/i, ''))
        : undefined;
    const defaultNameBase =
      suggestedBase && suggestedBase.length > 0
        ? suggestedBase
        : `${fallbackBase}-conversation-${timestamp}`;
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
      vscode.window.showInformationMessage(`Agentforce DX: Conversation saved to ${targetUri.fsPath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Agentforce DX: Failed to save conversation: ${errorMessage}`);
    }
  }

  /**
   * Determines the agent source type based on the agent ID
   * @param agentId The agent identifier (either "local:<filepath>" for script agents or Bot ID for published agents)
   * @returns AgentSource.SCRIPT for local .agent files, AgentSource.PUBLISHED for org agents
   */
  private getAgentSource(agentId: string): AgentSource {
    return agentId.startsWith('local:') ? AgentSource.SCRIPT : AgentSource.PUBLISHED;
  }

  /**
   * Extracts the file path from a local agent ID
   * @param agentId The agent identifier with "local:" prefix
   * @returns The file path without the "local:" prefix
   */
  private getLocalAgentFilePath(agentId: string): string {
    return agentId.startsWith('local:') ? agentId.substring(6) : agentId;
  }

  /**
   * Validates that an agent ID is a valid Salesforce Bot ID format
   * @param agentId The agent ID to validate
   * @throws Error if the agent ID is not a valid Bot ID format
   */
  private validatePublishedAgentId(agentId: string): void {
    if (!agentId.startsWith('0X') || (agentId.length !== 15 && agentId.length !== 18)) {
      throw new Error(
        `The Bot ID provided must begin with "0X" and be either 15 or 18 characters. Found: ${agentId}`
      );
    }
  }

  private getAgentStorageKey(agentId: string, agentSource: AgentSource): string {
    if (agentSource === AgentSource.SCRIPT) {
      const filePath = this.getLocalAgentFilePath(agentId);
      return path.basename(filePath);
    }
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
      planId: (traceData as { planId?: string })?.planId ?? this.latestPlanId ?? '',
      messageId: this.latestMessageId,
      userMessage: this.latestUserMessage,
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

  private async restoreViewAfterCancelledStart(): Promise<void> {
    if (!this.webviewView) {
      return;
    }

    const agentId = this.pendingStartAgentId ?? this.currentAgentId;
    if (!agentId) {
      return;
    }

    const agentSource = this.pendingStartAgentSource ?? this.getAgentSource(agentId);
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
   * Discover local .agent files in the workspace
   * This method scans the workspace for all .agent files and returns them
   */
  private async discoverLocalAgents(): Promise<AvailableAgent[]> {
    const localAgents: AvailableAgent[] = [];

    try {
      // Find all .agent files in the workspace
      // Pass undefined for maxResults to get all files (not just the default limit)
      const agentFiles = await vscode.workspace.findFiles('**/*.agent', '**/node_modules/**', undefined);

      for (const agentFile of agentFiles) {
        // Verify the file still exists (in case it was deleted between scan and processing)
        try {
          await vscode.workspace.fs.stat(agentFile);
          const fileName = path.basename(agentFile.fsPath, '.agent');
          localAgents.push({
            name: fileName,
            id: `local:${agentFile.fsPath}`, // Use special prefix to identify local agents
            type: 'script',
            filePath: agentFile.fsPath
          });
        } catch {
          // File was deleted or is inaccessible, skip it
        }
      }
    } catch {
      // Error discovering local .agent files - return empty array
    }

    // Sort local agents alphabetically by name
      localAgents.sort((a, b) => a.name.localeCompare(b.name));

    return localAgents;
  }

  /**
   * Returns published agents that have active versions
   */
  private async getActiveRemoteAgents(conn: Connection): Promise<AvailableAgent[]> {
    const remoteAgents = await Agent.listRemote(conn as any);
    return remoteAgents
      ? remoteAgents
          .filter(bot => {
            return bot.BotVersions?.records?.some(version => version.Status === 'Active');
          })
          .map(bot => ({
            name: bot.MasterLabel || bot.DeveloperName || 'Unknown Agent',
            id: bot.Id,
            type: 'published' as const
          }))
          .filter(agent => agent.id)
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];
  }

  /**
   * Attempts to resolve a connection using a selected client app
   */
  private async resolveClientAppConnection(handlers?: ClientAppConnectionHandlers): Promise<ClientAppConnectionResult> {
    if (this.selectedClientApp) {
      const conn = await createConnectionWithClientApp(this.selectedClientApp);
      return { status: 'ready', conn };
    }

    const clientAppResult = await getAvailableClientApps();

    if (clientAppResult.type === 'none') {
      if (handlers?.onNone) {
        return handlers.onNone(clientAppResult);
      }
      return { status: 'handled' };
    }

    if (clientAppResult.type === 'multiple') {
      if (handlers?.onMultiple) {
        return handlers.onMultiple(clientAppResult);
      }
      return { status: 'handled' };
    }

    if (clientAppResult.type === 'single') {
      this.selectedClientApp = clientAppResult.clientApps[0].name;
      const conn = await createConnectionWithClientApp(this.selectedClientApp);
      return { status: 'ready', conn };
    }

    const conn = await CoreExtensionService.getDefaultConnection();
    return { status: 'ready', conn };
  }

  /**
   * Builds the agent list used by the command palette quick pick
   */
  public async getAgentsForCommandPalette(): Promise<AvailableAgent[]> {
    const localAgents = await this.discoverLocalAgents();

    const connectionResult = await this.resolveClientAppConnection({
      onNone: async () => {
        // Mirror the dropdown behavior: silently fall back to local agents only.
        return { status: 'handled' };
      },
      onMultiple: async result => {
        type ClientAppPick = { label: string; description: string; app: ClientApp };
        const picks: ClientAppPick[] = result.clientApps.map(app => ({
          label: app.name,
          description: app.clientId,
          app
        }));

        const selection = await vscode.window.showQuickPick(picks, {
          placeHolder: 'Select a client app to access published agents'
        });

        if (!selection) {
          vscode.window.showInformationMessage(
            'Agentforce DX: Client app selection cancelled. Showing Agent Script files only.'
          );
          return { status: 'handled' };
        }

        this.selectedClientApp = selection.app.name;
        const conn = await createConnectionWithClientApp(this.selectedClientApp);
        return { status: 'ready', conn };
      }
    });

    if (connectionResult.status !== 'ready') {
      return localAgents;
    }

    const remoteAgents = await this.getActiveRemoteAgents(connectionResult.conn);
    return [...localAgents, ...remoteAgents];
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

    const agentSource = this.getAgentSource(this.currentAgentId);
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: vscode.WebviewViewResolveContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
              if (this.agentPreview instanceof AgentSimulate) {
                await (this.agentPreview as AgentSimulate).end();
              } else {
                await (this.agentPreview as AgentPreview).end(this.sessionId, 'UserRequest');
              }
              ensureActive();
            } catch (err) {
              console.warn('Error ending previous session:', err);
            }
          }

          // Reset planId when starting a new session
          this.latestPlanId = undefined;

          // If a client app was previously selected, reuse it to avoid re-prompt loops
          const conn = this.selectedClientApp
            ? await createConnectionWithClientApp(this.selectedClientApp)
            : await CoreExtensionService.getDefaultConnection();
          ensureActive();

          // Extract agentId from the message data and pass it as botId
          const agentId = this.preselectedAgentId || message.data?.agentId;

          if (!agentId || typeof agentId !== 'string') {
            throw new Error(`Invalid agent ID: ${agentId}. Expected a string.`);
          }

          // Determine agent source type using the library's AgentSource enum
          const agentSource = this.getAgentSource(agentId);
          this.pendingStartAgentId = agentId;
          this.pendingStartAgentSource = agentSource;

          if (agentSource === AgentSource.SCRIPT) {
            // Handle script agent (.agent file)
            const filePath = this.getLocalAgentFilePath(agentId);

            if (!filePath) {
              throw new Error('No file path found for local agent.');
            }

            // Determine mode before setting up listeners
            const isLiveMode = message.data?.isLiveMode ?? false;
            await this.setLiveMode(isLiveMode);
            ensureActive();

            // Set up lifecycle event listeners for compilation progress
            // Remove all existing listeners for these events to prevent duplicates
            const lifecycle = Lifecycle.getInstance();
            (lifecycle).removeAllListeners?.('agents:compiling');
            (lifecycle).removeAllListeners?.('agents:simulation-starting');

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
              const modeMessage = isLiveMode ? 'Starting live test...' : 'Starting simulation...';
              webviewView.webview.postMessage({
                command: 'simulationStarting',
                data: { message: data.message || modeMessage }
              });

              // Show disclaimer for agent preview (script agents only)
              if (!isActive()) {
                return;
              }
              webviewView.webview.postMessage({
                command: 'previewDisclaimer',
                data: {
                  message: 'Agent preview does not provide strict adherence to connection endpoint configuration and escalation is not supported. To test escalation, publish your agent then use the desired connection endpoint (e.g., Web Page, SMS, etc).'
                }
              });
            });

            // Create AgentSimulate with just the file path
            // Type cast needed due to local dependency setup with separate @salesforce/core instances
            // mockActions: true = simulate (mock actions), false = live test (real side effects)
            // The lifecycle listeners will automatically handle compilation progress messages
            const mockActions = !isLiveMode; // Simulate = true, Live Test = false
            this.agentPreview = new AgentSimulate(conn as any, filePath, mockActions);
            this.currentAgentName = path.basename(filePath, '.agent');
            this.currentAgentId = agentId;

            // Enable debug mode from apex debugging setting
            if (this.apexDebugging) {
              this.agentPreview.setApexDebugMode(this.apexDebugging);
            }
          } else {
            // Handle published agent (org agent)
            // Validate that the agentId follows Salesforce Bot ID format
            this.validatePublishedAgentId(agentId);

            // Published agents are always in live mode
            await this.setLiveMode(true);
            ensureActive();

            // Type cast needed due to local dependency setup with separate @salesforce/core instances
            this.agentPreview = new AgentPreview(conn as any, agentId);

            // Get agent name for notifications
            const remoteAgents = await Agent.listRemote(conn as any);
            ensureActive();
            const agent = remoteAgents?.find(bot => bot.Id === agentId);
            this.currentAgentName = agent?.MasterLabel || agent?.DeveloperName || 'Unknown Agent';
            this.currentAgentId = agentId;

            // Enable debug mode from apex debugging setting
            if (this.apexDebugging) {
            this.agentPreview.setApexDebugMode(this.apexDebugging);
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

          // Show notification
          vscode.window.showInformationMessage(`AFDX: Session started with ${this.currentAgentName}`);

          // History loading is now exclusively handled by loadAgentHistory flow
          // Don't load history here to avoid duplicate messages

          // Find the agent's welcome message or create a default one
          const agentMessage = session.messages.find(msg => msg.type === 'Inform') as AgentMessage;
            webviewView.webview.postMessage({
              command: 'sessionStarted',
              data: agentMessage
                ? {
                    content:
                      (agentMessage as { message?: string }).message ||
                      (agentMessage as { data?: string }).data ||
                      (agentMessage as { body?: string }).body ||
                      "Hi! I'm ready to help. What can I do for you?"
                  }
                : { content: "Hi! I'm ready to help. What can I do for you?" }
            });
            this.pendingStartAgentId = undefined;
            this.pendingStartAgentSource = undefined;
            await this.setConversationDataAvailable(true);
          } catch (err) {
            if (err instanceof SessionStartCancelledError || !isActive()) {
              return;
            }
            throw err;
          }
        } else if (message.command === 'setApexDebugging') {
          await this.setDebugMode(message.data);
          // If we have an active agent preview, update its debug mode
          if (this.agentPreview) {
            this.agentPreview.setApexDebugMode(this.apexDebugging);
          }

          webviewView.webview.postMessage({
            command: 'debugModeChanged',
            data: { enabled: this.apexDebugging }
          });
        } else if (message.command === 'sendChatMessage') {
          if (!this.agentPreview || !this.sessionId) {
            throw new Error('Session has not been started.');
          }

          webviewView.webview.postMessage({
            command: 'messageStarting',
            data: { message: 'Sending message...' }
          });

          const userMessage = message.data.message;
          const response = await this.agentPreview.send(this.sessionId, userMessage);

          // Get the latest agent response
          const lastMessage = response.messages?.at(-1);
          this.latestPlanId = lastMessage?.planId;
          this.latestMessageId = lastMessage?.id;
          this.latestUserMessage = userMessage;

          webviewView.webview.postMessage({
            command: 'messageSent',
            data: { content: lastMessage?.message }
          });


          if (this.apexDebugging && response.apexDebugLog) {
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
          } else if (this.apexDebugging && !response.apexDebugLog) {
            // Debug mode is enabled but no debug log was returned
            webviewView.webview.postMessage({
              command: 'debugLogInfo',
              data: {
                message: 'Debug mode is enabled, but no Apex was executed.'
              }
            });
          }
        } else if (message.command === 'endSession') {
             await this.endSession()
        } else if (message.command === 'loadAgentHistory') {
          // Load conversation history for the selected agent
          // If history exists: Show it and wait for user to manually start session
          // If no history: Send noHistoryFound signal so webview can show placeholder
          const agentId = message.data?.agentId;
          if (agentId && typeof agentId === 'string') {
            const agentSource = this.getAgentSource(agentId);
            await this.showHistoryOrPlaceholder(agentId, agentSource, webviewView);
          }
        } else if (message.command === 'getAvailableAgents') {
          try {
            const localAgents = await this.discoverLocalAgents();

            const connectionResult = await this.resolveClientAppConnection({
            onNone: async result => {
              webviewView.webview.postMessage({
                command: 'availableAgents',
                data: {
                  agents: localAgents,
                  selectedAgentId: this.preselectedAgentId
                }
              });
              webviewView.webview.postMessage({
                command: 'clientAppRequired',
                data: {
                  message:
                    'See "Preview an Agent" in the "Agentforce Developer Guide" for complete documentation: https://developer.salesforce.com/docs/einstein/genai/guide/agent-dx-preview.html.',
                  username: result.username,
                  error: result.error
                }
              });
              if (this.preselectedAgentId) {
                this.preselectedAgentId = undefined;
              }
              return { status: 'handled' };
            },
            onMultiple: async result => {
              webviewView.webview.postMessage({
                command: 'availableAgents',
                data: {
                  agents: localAgents,
                  selectedAgentId: this.preselectedAgentId
                }
              });
              webviewView.webview.postMessage({
                command: 'selectClientApp',
                data: {
                  clientApps: result.clientApps,
                  username: result.username
                }
              });
              if (this.preselectedAgentId) {
                this.preselectedAgentId = undefined;
              }
              return { status: 'handled' };
            }
          });

            if (connectionResult.status !== 'ready') {
              return;
            }

            const remoteAgents = await this.getActiveRemoteAgents(connectionResult.conn);
            const allAgents = [...localAgents, ...remoteAgents];

            webviewView.webview.postMessage({
              command: 'availableAgents',
              data: {
                agents: allAgents,
                selectedAgentId: this.preselectedAgentId
              }
            });

            if (this.preselectedAgentId) {
              this.preselectedAgentId = undefined;
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
            // Check for mock payload URI setting first
            const config = vscode.workspace.getConfiguration('salesforce.agentforceDX');
            const mockPayloadUri = config.get<string>('tracerPayload')?.trim();

            if (mockPayloadUri) {
              try {
                // Parse the URI and load the file
                const fileUri = vscode.Uri.file(mockPayloadUri);
                const fileContent = await vscode.workspace.fs.readFile(fileUri);
                const parsedMockData = JSON.parse(fileContent.toString());

                await this.persistTraceHistory(parsedMockData);

                // Send the mock data to the webview
                webviewView.webview.postMessage({
                  command: 'traceData',
                  data: parsedMockData
                });
              } catch (fileError) {
                // If mock file can't be loaded, log error and surface to user
                console.error('Error loading mock payload from URI:', fileError);
                await this.postErrorMessage(
                  webviewView,
                  `Error loading mock payload: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`
                );
              }
              return;
            }

            // Normal flow: If no agent preview or session, return empty data instead of throwing error
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

            if (!(this.agentPreview instanceof AgentSimulate) || !this.latestPlanId) {
              const restored = await this.sendLastStoredTraceData(webviewView);
              if (!restored) {
                webviewView.webview.postMessage({
                  command: 'traceData',
                  data: emptyTraceData
                });
              }
              return;
            }

            const data = await this.agentPreview.trace(this.sessionId, this.latestPlanId);
            await this.persistTraceHistory(data);
            if (this.currentAgentId && this.currentAgentSource) {
              await this.loadAndSendTraceHistory(this.currentAgentId, this.currentAgentSource, webviewView);
            }

            webviewView.webview.postMessage({
              command: 'traceData',
              data
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.postErrorMessage(webviewView, errorMessage);
          }
        } else if (message.command === 'clientAppSelected') {
          // Handle client app selection (Case 3)
          try {
            const clientAppName = message.data?.clientAppName;
            if (!clientAppName) {
              throw new Error('No client app name provided');
            }

            this.selectedClientApp = clientAppName;

            if (!this.selectedClientApp) {
              throw new Error('Client app not set');
            }

            const conn = await createConnectionWithClientApp(clientAppName);
            const localAgents = await this.discoverLocalAgents();
            const remoteAgents = await this.getActiveRemoteAgents(conn);
            const allAgents = [...localAgents, ...remoteAgents];

            // Notify the UI that client app is ready so it can clear selection UI
            webviewView.webview.postMessage({ command: 'clientAppReady' });

            // Provide updated agent list with preselected agent if we have one
            webviewView.webview.postMessage({
              command: 'availableAgents',
              data: {
                agents: allAgents,
                selectedAgentId: this.preselectedAgentId
              }
            });

            // Clear the preselected agent ID after sending it
            if (this.preselectedAgentId) {
              this.preselectedAgentId = undefined;
            }
          } catch (err) {
            console.error('Error selecting client app:', err);
            await this.postErrorMessage(
              webviewView,
              `Error selecting client app: ${err instanceof Error ? err.message : 'Unknown error'}`
            );
          }
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
          this.currentAgentSource = this.getAgentSource(agentId);
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
            vscode.window.showWarningMessage('Agentforce DX: Conversation could not be exported.');
          }
        }
      } catch (err) {
        console.error('AgentCombinedViewProvider Error:', err);
        let errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        this.pendingStartAgentId = undefined;
        this.pendingStartAgentSource = undefined;

        // Clean up session state if connection failed
        // This ensures UI doesn't show as "connected" when the session actually failed
        if (this.agentPreview || this.sessionActive) {
          this.agentPreview = undefined;
          this.sessionId = Date.now().toString();
          this.currentAgentName = undefined;
          this.latestPlanId = undefined;
          await this.setSessionActive(false);
          await this.setSessionStarting(false);
          await this.setDebugMode(false);
        }

        // Check for specific agent deactivation error
        if (
          errorMessage.includes('404') &&
          errorMessage.includes('NOT_FOUND') &&
          errorMessage.includes('No valid version available')
        ) {
          errorMessage =
            'This agent is currently deactivated and cannot be used for conversations. Please activate the agent first using the "Activate Agent" right click menu option or through the Salesforce Setup.';
        }
        // Check for other common agent errors
        else if (errorMessage.includes('NOT_FOUND') && errorMessage.includes('404')) {
          errorMessage =
            'The selected agent could not be found. It may have been deleted or you may not have access to it.';
        }
        // Check for permission errors
        else if (errorMessage.includes('403') || errorMessage.includes('FORBIDDEN')) {
          errorMessage = "You don't have permission to use this agent. Please check with your administrator.";
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
      const conn = this.selectedClientApp
        ? await createConnectionWithClientApp(this.selectedClientApp)
        : await CoreExtensionService.getDefaultConnection();
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found to save apex debug logs.');
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
