import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CoreExtensionService } from '../services/coreExtensionService';
import type { ApexLog } from '@salesforce/types/tooling';
import { Lifecycle, SfError, SfProject } from '@salesforce/core';
import type { ChannelService } from '../types/ChannelService';
import {
  readTraceHistoryEntries,
  type TraceHistoryEntry,
  writeTraceEntryToFile
} from '../utils/traceHistory';
import { EOL } from 'os';
import {
  Agent,
  AgentSource,
  findAuthoringBundle,
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
  command?: string;
  type?: string;
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
  private agentInstance?: ScriptAgent | ProductionAgent;
  private sessionId: string = '';
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
    if (this.agentInstance) {
      this.agentInstance.preview.setApexDebugging(newDebugMode);
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

    if (this.agentInstance && this.sessionId) {
      // AgentSimulate.end() doesn't take parameters, but AgentPreview.end() does
      // Both extend AgentPreviewBase, so we need to handle this carefully
      const isAgentSimulate = this.currentAgentSource === AgentSource.SCRIPT;
      if (isAgentSimulate) {
        await (this.agentInstance.preview as any).end();
      } else {
        await this.agentInstance.preview.end(this.sessionId, 'UserRequest');
      }
      // Restore connection before clearing agent references
        try {
          await this.agentInstance.restoreConnection();
        } catch (error) {
          console.warn('Error restoring connection:', error);
        }
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
   * This provides a lightweight restart by reusing the existing agentInstance
   */
  public async restartWithoutCompilation(): Promise<void> {
    if (!this.agentInstance || !this.webviewView) {
      return;
    }

    try {
      // Set sessionStarting to show loading state
      await this.setSessionStarting(true);

      // End the current session but keep the agentInstance
      const isAgentSimulate = this.currentAgentSource === AgentSource.SCRIPT;
      if (isAgentSimulate) {
        await (this.agentInstance.preview as any).end();
      } else {
        await this.agentInstance.preview.end(this.sessionId, 'UserRequest');
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

      // Start a new session on the existing agentInstance (should skip compilation)
      const session = await this.agentInstance.preview.start();
      this.sessionId = session.sessionId;

      // Load trace history if available
      if (this.currentAgentId && this.currentAgentSource) {
      // Library automatically saves traces/conversation - just load and display
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
   * Starts a preview session for an agent directly (bypassing webview message passing)
   * This can be called from commands or other extension code
   * @param agentId The agent identifier (file path for script agents, Bot ID for published agents)
   * @param agentSource Optional agent source. If not provided, will be determined automatically
   * @param isLiveMode Optional live mode setting. Defaults to false for script agents, true for published agents
   */
  public async startPreviewSession(agentId: string, agentSource: AgentSource, isLiveMode?: boolean): Promise<void> {
    if (!this.webviewView) {
      throw new Error('Webview is not ready. Please ensure the view is visible.');
    }

    const sessionStartId = this.beginSessionStart();
    const { ensureActive, isActive } = this.createSessionStartGuards(sessionStartId);

    try {
      await this.setSessionStarting(true);
      ensureActive();

      // Clear any previous error messages before starting a new session
      this.webviewView.webview.postMessage({
        command: 'clearMessages'
      });

      this.webviewView.webview.postMessage({
        command: 'sessionStarting',
        data: { message: 'Starting session...' }
      });

      // End existing session if one exists
      if (this.agentInstance && this.sessionId) {
        try {
          const isAgentSimulate = this.currentAgentSource === AgentSource.SCRIPT;
          if (isAgentSimulate) {
            await (this.agentInstance.preview as any).end();
          } else {
            await this.agentInstance.preview.end(this.sessionId, 'UserRequest');
          }
          // Restore connection after ending session
          try {
            await this.agentInstance.restoreConnection();
          } catch (error) {
            console.warn('Error restoring connection:', error);
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

      // Update currentAgentId
      this.currentAgentId = agentId;

      // Get project instance - needed for both script and published agents
      const project = SfProject.getInstance();

      this.pendingStartAgentId = agentId;
      this.pendingStartAgentSource = agentSource;

      if (agentSource === AgentSource.SCRIPT) {
        // Handle script agent (.agent file)
        const filePath = agentId;

        if (!filePath) {
          throw new Error('No file path found for script agent.');
        }

        // Determine mode - default to false (simulation) if not specified
        const determinedLiveMode = isLiveMode ?? false;
        await this.setLiveMode(determinedLiveMode);
        ensureActive();

        // Set up lifecycle event listeners for compilation progress
        const lifecycle = Lifecycle.getInstance();
        lifecycle.removeAllListeners?.('agents:compiling');
        lifecycle.removeAllListeners?.('agents:simulation-starting');

        // Listen for compilation events
        lifecycle.on('agents:compiling', async (data: { message?: string; error?: string }) => {
          if (!isActive() || !this.webviewView) {
            return;
          }
          if (data.error) {
            this.webviewView.webview.postMessage({
              command: 'compilationError',
              data: { message: data.error }
            });
          } else {
            this.channelService.appendLine(`SF_TEST_API = ${process.env.SF_TEST_API ?? 'false'}`);
            this.channelService.appendLine(`Compilation end point called.`);

            this.webviewView.webview.postMessage({
              command: 'compilationStarting',
              data: { message: data.message || 'Compiling agent...' }
            });
          }
        });

        // Listen for simulation starting event
        lifecycle.on('agents:simulation-starting', async (data: { message?: string }) => {
          if (!isActive() || !this.webviewView) {
            return;
          }

          this.channelService.appendLine(`Simulation session started.`);

          const modeMessage = determinedLiveMode ? 'Starting live test...' : 'Starting simulation...';
          this.webviewView.webview.postMessage({
            command: 'simulationStarting',
            data: { message: data.message || modeMessage }
          });
        });

        // Create AgentSimulate with just the file path
        const mockActions = !determinedLiveMode; // Simulate = true, Live Test = false
        const aabDirectory = path.resolve(findAuthoringBundle(project.getPath(), agentId)!);
        this.agentInstance = await Agent.init({
          connection: conn,
          aabDirectory,
          project: project
        } as any);
        this.currentAgentName = this.agentInstance.name;
        this.currentAgentId = agentId;

        // Enable debug mode from apex debugging setting
        if (this.isApexDebuggingEnabled) {
          this.agentInstance.preview.setApexDebugging(this.isApexDebuggingEnabled);
        }
      } else {
        // Handle published agent (org agent)
        this.validatePublishedAgentId(agentId);

        // Published agents are always in live mode
        await this.setLiveMode(true);
        ensureActive();

        const agent = await Agent.init({ connection: conn, project: project as any, apiNameOrId: agentId });

        this.agentInstance = agent;

        // Get agent name for notifications
        const remoteAgents = await Agent.listRemote(conn as any);
        ensureActive();
        this.currentAgentName = agent.name;
        this.currentAgentId = agentId;

        // Enable debug mode from apex debugging setting
        if (this.isApexDebuggingEnabled) {
          this.agentInstance.preview.setApexDebugging(this.isApexDebuggingEnabled);
        }
      }

      if (!this.agentInstance) {
        throw new Error('Failed to initialize agent instance.');
      }

      // Start the session - this will trigger compilation for local agents
      const session = await this.agentInstance.preview.start();
      ensureActive();
      this.sessionId = session.sessionId;

      // Library automatically saves traces/conversation - just load and display
      await this.loadAndSendTraceHistory(agentId, agentSource, this.webviewView);
      await this.setSessionActive(true);
      ensureActive();
      await this.setSessionStarting(false);
      ensureActive();

      // Find the agent's welcome message or create a default one
      const agentMessage = session.messages.find((msg: any) => msg.type === 'Inform');
      this.webviewView.webview.postMessage({
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
      if (
        this.currentAgentSource === AgentSource.SCRIPT &&
        err instanceof SfError &&
        err.message.includes('Failed to compile agent script')
      ) {
        const sfError = err as SfError;
        const detailedError = `Failed to compile agent script${EOL}${sfError.name}`;
        this.channelService.appendLine(detailedError);
        if (this.webviewView) {
          this.webviewView.webview.postMessage({
            command: 'compilationError',
            data: { message: detailedError }
          });
        }
        // Don't re-throw, the error has been handled and shown to the user
        return;
      }

      this.channelService.appendLine(`Error starting session: ${err}`);
      this.channelService.appendLine('---------------------');

      throw err;
    }
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
        // If agentId looks like a file path, default to SCRIPT; otherwise PUBLISHED
        if (agentId.includes(path.sep) || agentId.endsWith('.agent')) {
          return AgentSource.SCRIPT;
        }
        return AgentSource.PUBLISHED;
      }
    }
    
    // First, try exact match by ID
    const agent = agentList.find(a => a.id === agentId);
    if (agent) {
      return agent.source;
    }

    // If not found, check if agentId is a file path that exists
    // File paths contain path separators or end with .agent extension
    if (agentId.includes(path.sep) || agentId.endsWith('.agent')) {
      // Verify the file actually exists to confirm it's a script agent
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(agentId));
        return AgentSource.SCRIPT;
      } catch {
        // File doesn't exist, but still looks like a path - treat as script
        return AgentSource.SCRIPT;
      }
    }

    // Check if agentId matches an agent name in the list (for script agents)
    // Script agents might use just the agent name as the ID
    const agentByName = agentList.find(a => a.name === agentId || path.basename(a.id || '') === agentId);
    if (agentByName) {
      return agentByName.source;
    }

    // Check if it's a valid Bot ID format (starts with 0X and is 15 or 18 chars)
    // If it matches Bot ID format, it's definitely a published agent
    if (agentId.startsWith('0X') && (agentId.length === 15 || agentId.length === 18)) {
    return AgentSource.PUBLISHED;
    }

    // Default to SCRIPT for unknown formats (more likely to be a script agent name/path)
    // This is safer than defaulting to PUBLISHED which would trigger Bot ID validation
    return AgentSource.SCRIPT;
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
   * Note: The agents library automatically saves conversation history to ~/.sfdx/agents
   */
  private async loadAndSendConversationHistory(
    agentId: string,
    agentSource: AgentSource,
    webviewView: vscode.WebviewView
  ): Promise<boolean> {
    try {
      const agentName = this.getAgentStorageKey(agentId, agentSource);

      // Use readTranscriptEntries from @salesforce/agents library
      // This reads conversation history that was automatically saved by the library
      // Reads from ~/.sfdx/agents/conversations/<agentName>/history.json
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

  /**
   * Load trace history for an agent and send it to the webview
   * Note: The agents library automatically saves traces to ~/.sfdx/agents
   * This method reads the trace history that was saved by the library
   */
  private async loadAndSendTraceHistory(
    agentId: string,
    agentSource: AgentSource,
    webviewView: vscode.WebviewView
  ): Promise<void> {
    try {
      const agentStorageKey = this.getAgentStorageKey(agentId, agentSource);
      // Read trace history that was automatically saved by the agents library
      const entries = await readTraceHistoryEntries(agentStorageKey);
      
      // Send trace history to populate the history list
      webviewView.webview.postMessage({
        command: 'traceHistory',
        data: { agentId, entries }
      });

      // If we have entries and a current planId, also send the current trace data
      // This ensures the tracer shows the latest trace immediately
      if (entries.length > 0 && this.currentPlanId) {
        const currentEntry = entries.find(entry => entry.planId === this.currentPlanId);
        if (currentEntry) {
          webviewView.webview.postMessage({
            command: 'traceData',
            data: currentEntry.trace
          });
        } else {
          // If no exact match, send the latest entry
          const latestEntry = entries[entries.length - 1];
          webviewView.webview.postMessage({
            command: 'traceData',
            data: latestEntry.trace
          });
        }
      } else if (entries.length > 0) {
        // If no current planId but we have entries, send the latest
        const latestEntry = entries[entries.length - 1];
        webviewView.webview.postMessage({
          command: 'traceData',
          data: latestEntry.trace
        });
      }
    } catch (error) {
      console.error('Could not load trace history:', error);
      webviewView.webview.postMessage({
        command: 'traceHistory',
        data: { agentId, entries: [] }
      });
    }
  }

  // Note: Trace history is now automatically saved by the agents library
  // when using agentPreview.send() and agentPreview.start()
  // No need for manual persistence

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

    const agentSource = this.pendingStartAgentSource ?? (await this.getAgentSource(agentId));
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

  // ============================================================================
  // Webview Message Handlers
  // ============================================================================

  /**
   * Handles the startSession command from the webview
   */
  private async handleStartSession(message: AgentMessage, _webviewView: vscode.WebviewView): Promise<void> {
    const data = message.data as { agentId?: string; isLiveMode?: boolean } | undefined;
    const agentId = data?.agentId || this.currentAgentId;

            if (!agentId || typeof agentId !== 'string') {
              throw new Error(`Invalid agent ID: ${agentId}. Expected a string.`);
            }

    const isLiveMode = data?.isLiveMode ?? false;
    await this.startPreviewSession(agentId, this.currentAgentSource ?? AgentSource.SCRIPT, isLiveMode);
  }

  /**
   * Handles the setApexDebugging command from the webview
   */
  private async handleSetApexDebugging(message: AgentMessage): Promise<void> {
    const enabled = message.data as boolean | undefined;
    await this.setDebugMode(enabled ?? false);
    if (this.agentInstance) {
      this.agentInstance.preview.setApexDebugging(this.isApexDebuggingEnabled);
    }
  }

  /**
   * Handles the sendChatMessage command from the webview
   */
  private async handleSendChatMessage(message: AgentMessage, webviewView: vscode.WebviewView): Promise<void> {
    if (!this.agentInstance || !this.sessionId) {
            throw new Error('Session has not been started.');
          }

          webviewView.webview.postMessage({
            command: 'messageStarting',
            data: { message: 'Sending message...' }
          });

    const data = message.data as { message?: string } | undefined;
    const userMessage = data?.message;
    if (!userMessage || typeof userMessage !== 'string') {
      throw new Error('Invalid message: expected a string.');
    }
          this.channelService.appendLine(`Simulation message sent - "${userMessage}"`);

    const response = await this.agentInstance.preview.send(userMessage);

          const lastMessage = response.messages?.at(-1);
          this.currentPlanId = lastMessage?.planId;
          this.currentUserMessage = userMessage;

          webviewView.webview.postMessage({
            command: 'messageSent',
            data: { content: lastMessage?.message }
          });

          this.channelService.appendLine(`Simulation message received - "${lastMessage?.message}"`);

          // Load and send trace data after sending message
          // The library automatically saves traces, so we read from saved data
          // Use retry logic since the library saves asynchronously
          if (this.currentAgentId && this.currentAgentSource) {
            const loadTraceWithRetry = async (retries = 5, delay = 200) => {
              for (let i = 0; i < retries; i++) {
                try {
                  const agentStorageKey = this.getAgentStorageKey(this.currentAgentId!, this.currentAgentSource!);
                  const entries = await readTraceHistoryEntries(agentStorageKey);
                  
                  // Check if we have a new entry with the current planId
                  if (entries.length > 0) {
                    const matchingEntry = entries.find(entry => entry.planId === this.currentPlanId);
                    if (matchingEntry || entries.length > 0) {
                      // Found trace data, send it
                      await this.loadAndSendTraceHistory(this.currentAgentId!, this.currentAgentSource!, webviewView);
                      return;
                    }
                  }
                  
                  // If not found yet and we have retries left, wait and try again
                  if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                  }
                } catch (err) {
                  console.error(`Error loading trace after message (attempt ${i + 1}):`, err);
                  if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                  }
                }
              }
            };
            
            // Start loading trace data (don't await, let it run in background)
            loadTraceWithRetry().catch(err => {
              console.error('Error in trace loading retry:', err);
            });
          }

          if (this.isApexDebuggingEnabled && response.apexDebugLog) {
            try {
              const logPath = await this.saveApexDebugLog(response.apexDebugLog);
              if (logPath) {
                try {
                  this.setupAutoDebugListeners();
                  await vscode.commands.executeCommand('sf.launch.replay.debugger.logfile.path', logPath);
                } catch (commandErr) {
                  console.warn('Could not launch Apex Replay Debugger:', commandErr);
                }
              }
            } catch (err) {
              console.error('Error handling apex debug log:', err);
              const errorMessage = err instanceof Error ? err.message : 'Unknown error';
              vscode.window.showErrorMessage(`Error processing debug log: ${errorMessage}`);

              webviewView.webview.postMessage({
                command: 'debugLogError',
                data: {
                  message: `Error processing debug log: ${errorMessage}`
                }
              });
            }
          } else if (this.isApexDebuggingEnabled && !response.apexDebugLog) {
            vscode.window.showInformationMessage('Debug mode is enabled but no Apex was executed.');
          }
  }

  /**
   * Handles the endSession command from the webview
   */
  private async handleEndSession(): Promise<void> {
          await this.endSession();
  }

  /**
   * Handles the loadAgentHistory command from the webview
   */
  private async handleLoadAgentHistory(message: AgentMessage, webviewView: vscode.WebviewView): Promise<void> {
    const data = message.data as { agentId?: string } | undefined;
    const agentId = data?.agentId;
          if (agentId && typeof agentId === 'string') {
          const agentSource = await this.getAgentSource(agentId);
            await this.showHistoryOrPlaceholder(agentId, agentSource, webviewView);
          }
  }

  /**
   * Handles the getAvailableAgents command from the webview
   */
  private async handleGetAvailableAgents(webviewView: vscode.WebviewView): Promise<void> {
          try {
            const conn = await CoreExtensionService.getDefaultConnection();
            const project = SfProject.getInstance();

            const allAgents = await Agent.listPreviewable(conn, project);

            // Map PreviewableAgent to the format expected by webview
      // Pass agent.source directly (it's already the AgentSource enum value)
            const mappedAgents = allAgents.map(agent => ({
              name: agent.name,
              id: agent.id,
        type: agent.source
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
  }

  /**
   * Handles the getTraceData command from the webview
   * Uses the agents library's automatically saved trace history
   */
  private async handleGetTraceData(webviewView: vscode.WebviewView): Promise<void> {
    try {
      // Always load trace history from the library's saved data
      // The library automatically saves traces when messages are sent
      if (this.currentAgentId && this.currentAgentSource) {
        await this.loadAndSendTraceHistory(this.currentAgentId, this.currentAgentSource, webviewView);
              return;
            }

      // If no agent is selected, send empty trace data
      const emptyTraceData = { plan: [], planId: '', sessionId: '' };
                webviewView.webview.postMessage({
                  command: 'traceData',
                  data: emptyTraceData
                });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.postErrorMessage(webviewView, errorMessage);
    }
  }

  /**
   * Handles the openTraceJson command from the webview
   */
  private async handleOpenTraceJson(message: AgentMessage): Promise<void> {
    const data = message.data as { entry?: TraceHistoryEntry } | undefined;
    await this.openTraceJsonEntry(data?.entry);
  }

  /**
   * Handles the getConfiguration command from the webview
   */
  private async handleGetConfiguration(message: AgentMessage, webviewView: vscode.WebviewView): Promise<void> {
          const config = vscode.workspace.getConfiguration();
    const data = message.data as { section?: string } | undefined;
    const section = data?.section;
          if (section) {
            const value = config.get(section);
            webviewView.webview.postMessage({
              command: 'configuration',
              data: { section, value }
            });
          }
  }

  /**
   * Handles the executeCommand command from the webview
   */
  private async handleExecuteCommand(message: AgentMessage): Promise<void> {
    const data = message.data as { commandId?: string } | undefined;
    const commandId = data?.commandId;
          if (commandId && typeof commandId === 'string') {
            await vscode.commands.executeCommand(commandId);
          }
  }

  /**
   * Handles the setSelectedAgentId command from the webview
   */
  private async handleSetSelectedAgentId(message: AgentMessage): Promise<void> {
    const data = message.data as { agentId?: string } | undefined;
    const agentId = data?.agentId;
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
  }

  /**
   * Handles the setLiveMode command from the webview
   */
  private async handleSetLiveMode(message: AgentMessage): Promise<void> {
    const data = message.data as { isLiveMode?: boolean } | undefined;
    const isLiveMode = data?.isLiveMode;
          if (typeof isLiveMode === 'boolean') {
            await this.setLiveMode(isLiveMode);
          }
  }

  /**
   * Handles the getInitialLiveMode command from the webview
   */
  private async handleGetInitialLiveMode(webviewView: vscode.WebviewView): Promise<void> {
          webviewView.webview.postMessage({
            command: 'setLiveMode',
            data: { isLiveMode: this.isLiveMode }
          });
  }

  /**
   * Handles the conversationExportReady command from the webview
   */
  private async handleConversationExportReady(message: AgentMessage): Promise<void> {
    const data = message.data as { content?: string; fileName?: string } | undefined;
    const markdown = data?.content;
    const fileName = data?.fileName;
          if (typeof markdown === 'string' && markdown.trim() !== '') {
            await this.saveConversationExport(markdown, fileName);
          } else {
            vscode.window.showWarningMessage("Conversation couldn't be exported.");
          }
        }

  /**
   * Routes webview messages to the appropriate handler method
   */
  private async handleWebviewMessage(message: AgentMessage, webviewView: vscode.WebviewView): Promise<void> {
    const command = message.command || message.type;
    if (!command) {
      console.warn('Received message without command or type:', message);
      return;
    }

    const commandHandlers: Record<string, (message: AgentMessage, webviewView: vscode.WebviewView) => Promise<void>> = {
      startSession: async (msg, view) => await this.handleStartSession(msg, view),
      setApexDebugging: async msg => await this.handleSetApexDebugging(msg),
      sendChatMessage: async (msg, view) => await this.handleSendChatMessage(msg, view),
      endSession: async () => await this.handleEndSession(),
      loadAgentHistory: async (msg, view) => await this.handleLoadAgentHistory(msg, view),
      getAvailableAgents: async (_, view) => await this.handleGetAvailableAgents(view),
      getTraceData: async (_, view) => await this.handleGetTraceData(view),
      openTraceJson: async msg => await this.handleOpenTraceJson(msg),
      getConfiguration: async (msg, view) => await this.handleGetConfiguration(msg, view),
      executeCommand: async msg => await this.handleExecuteCommand(msg),
      setSelectedAgentId: async msg => await this.handleSetSelectedAgentId(msg),
      setLiveMode: async msg => await this.handleSetLiveMode(msg),
      getInitialLiveMode: async (_, view) => await this.handleGetInitialLiveMode(view),
      conversationExportReady: async msg => await this.handleConversationExportReady(msg)
    };

    const handler = commandHandlers[command];
    if (handler) {
      await handler(message, webviewView);
    } else {
      console.warn(`Unknown webview command: ${command}`);
    }
  }

  /**
   * Handles errors from webview message processing
   */
  private async handleWebviewError(err: unknown, webviewView: vscode.WebviewView): Promise<void> {
        console.error('AgentCombinedViewProvider Error:', err);
        let errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        this.channelService.appendLine(`Error: ${errorMessage}`);
        this.channelService.appendLine('---------------------');

        this.pendingStartAgentId = undefined;
        this.pendingStartAgentSource = undefined;

    if (this.agentInstance || this.isSessionActive) {
      this.agentInstance = undefined;
          this.sessionId = Date.now().toString();
          this.currentAgentName = undefined;
          this.currentPlanId = undefined;
          await this.setSessionActive(false);
          await this.setSessionStarting(false);
        }

        // Check for specific agent deactivation error
        if (
          errorMessage.includes('404') &&
          errorMessage.includes('NOT_FOUND') &&
          errorMessage.includes('No valid version available')
        ) {
          errorMessage =
            'This agent is currently deactivated, so you can\'t converse with it.  Activate the agent using either the "AFDX: Activate Agent" VS Code command or your org\'s Agentforce UI.';
    } else if (errorMessage.includes('NOT_FOUND') && errorMessage.includes('404')) {
      errorMessage = "The selected agent couldn't be found. Either it's been deleted or you don't have access to it.";
    } else if (errorMessage.includes('403') || errorMessage.includes('FORBIDDEN')) {
          errorMessage = "You don't have permission to use this agent. Consult your Salesforce administrator.";
        }

        await this.postErrorMessage(webviewView, errorMessage);
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
        await this.handleWebviewMessage(message, webviewView);
      } catch (err) {
        await this.handleWebviewError(err, webviewView);
      }
    });

    webviewView.webview.html = this.getHtmlForWebview();
  }

  private getHtmlForWebview(): string {
    // Read the built HTML file which contains everything inlined
    const htmlPath = path.join(this.context.extensionPath, 'webview', 'dist', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Add VSCode webview API script injection and AgentSource enum values
    const vscodeScript = `
      <script>
        const vscode = acquireVsCodeApi();
        window.vscode = vscode;
        // AgentSource enum values from @salesforce/agents - injected from extension
        // Note: The enum values are lowercase strings: 'script' and 'published'
        window.AgentSource = ${JSON.stringify({
          SCRIPT: AgentSource.SCRIPT,
          PUBLISHED: AgentSource.PUBLISHED
        })};
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
