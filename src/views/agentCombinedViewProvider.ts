import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentSource, Agent, PreviewableAgent } from '@salesforce/agents';
import { getAllHistory, getHistoryDir } from '@salesforce/agents/lib/utils';
import { SfProject } from '@salesforce/core';
import { CoreExtensionService } from '../services/coreExtensionService';
import { AgentViewState } from './agentCombined/state';
import { WebviewMessageSender, WebviewMessageHandlers } from './agentCombined/handlers';
import { SessionManager } from './agentCombined/session';
import { AgentInitializer, getAgentStorageKey } from './agentCombined/agent';
import { HistoryManager } from './agentCombined/history';
import { ApexDebugManager } from './agentCombined/debugging';
import { getAgentSource } from './agentCombined/agent';

/**
 * Main orchestrator for the Agent Combined View Provider
 * Delegates to focused modules for specific functionality
 */
export class AgentCombinedViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sf.agent.combined.view';
  public webviewView?: vscode.WebviewView;
  private static instance: AgentCombinedViewProvider;

  // Core managers
  private readonly state: AgentViewState;
  private readonly messageSender: WebviewMessageSender;
  private readonly sessionManager: SessionManager;
  private readonly historyManager: HistoryManager;
  private readonly apexDebugManager: ApexDebugManager;
  private readonly agentInitializer: AgentInitializer;
  private messageHandlers?: WebviewMessageHandlers;

  private readonly channelService = CoreExtensionService.getChannelService();

  constructor(private readonly context: vscode.ExtensionContext) {
    AgentCombinedViewProvider.instance = this;

    // Initialize state
    this.state = new AgentViewState(context);

    // Initialize message sender
    this.messageSender = new WebviewMessageSender(this.state);

    // Initialize managers
    this.agentInitializer = new AgentInitializer(this.state);
    this.historyManager = new HistoryManager(this.state, this.messageSender);
    this.apexDebugManager = new ApexDebugManager(this.messageSender);

    // Initialize session manager (depends on other managers)
    this.sessionManager = new SessionManager(
      this.state,
      this.messageSender,
      this.agentInitializer,
      this.historyManager,
      this.channelService
    );

    // Initialize context states
    void this.state.setResetAgentViewAvailable(false);
    void this.state.setSessionErrorState(false);
    void this.state.setConversationDataAvailable(false);
  }

  public static getInstance(): AgentCombinedViewProvider {
    return AgentCombinedViewProvider.instance;
  }

  /**
   * Main entry point - sets up webview and message handling
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.webviewView = webviewView;
    this.messageSender.setWebview(webviewView);

    // Configure webview
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist')]
    };

    // Set up message handlers
    this.messageHandlers = new WebviewMessageHandlers(
      this.state,
      this.messageSender,
      this.sessionManager,
      this.historyManager,
      this.apexDebugManager,
      this.channelService,
      this.context,
      webviewView
    );

    // Main entry point - clean and simple
    this.handleEventsFromWebview();

    // Set HTML content
    webviewView.webview.html = this.getHtmlForWebview();
  }

  /**
   * Sets up event handling from webview
   */
  private handleEventsFromWebview(): void {
    if (!this.webviewView || !this.messageHandlers) {
      return;
    }

    this.webviewView.webview.onDidReceiveMessage(async message => {
      try {
        await this.messageHandlers!.handleMessage(message);
      } catch (err) {
        await this.messageHandlers!.handleError(err);
      }
    });
  }

  /**
   * Generates HTML for the webview
   */
  private getHtmlForWebview(): string {
    const htmlPath = path.join(this.context.extensionPath, 'webview', 'dist', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    const vscodeScript = `
      <script>
        const vscode = acquireVsCodeApi();
        window.vscode = vscode;
        window.AgentSource = ${JSON.stringify({
          SCRIPT: AgentSource.SCRIPT,
          PUBLISHED: AgentSource.PUBLISHED
        })};
      </script>
    `;

    html = html.replace('</head>', `${vscodeScript}</head>`);
    return html;
  }

  // ============================================================================
  // Public API Methods - delegate to appropriate managers
  // ============================================================================

  /**
   * Toggles debug mode on/off
   */
  public async toggleDebugMode(): Promise<void> {
    const newDebugMode = !this.state.isApexDebuggingEnabled;
    await this.state.setDebugMode(newDebugMode);

    if (this.state.agentInstance) {
      this.state.agentInstance.preview.setApexDebugging(newDebugMode);
    }

    const statusMessage = newDebugMode ? 'Debug mode activated.' : 'Debug mode deactivated.';
    vscode.window.showInformationMessage(statusMessage);
  }

  /**
   * Gets the currently selected agent ID
   */
  public getCurrentAgentId(): string | undefined {
    return this.state.currentAgentId;
  }

  /**
   * Gets the currently selected agent source
   */
  public getCurrentAgentSource(): string | undefined {
    return this.state.currentAgentSource;
  }

  /**
   * Selects an agent and starts a session
   */
  public selectAndStartAgent(agentId: string): void {
    if (this.webviewView) {
      this.messageSender.sendSelectAgent(agentId, true);
    }
  }

  /**
   * Ends the current agent session
   */
  public async endSession(): Promise<void> {
    await this.sessionManager.endSession(async () => {
      const agentId = this.state.pendingStartAgentId ?? this.state.currentAgentId;
      if (agentId) {
        const agentSource = this.state.pendingStartAgentSource ?? (await getAgentSource(agentId));
        await this.historyManager.showHistoryOrPlaceholder(agentId, agentSource);
      }
    });
  }

  /**
   * Restarts the agent session without recompilation
   */
  public async restartWithoutCompilation(): Promise<void> {
    await this.sessionManager.restartSession();
  }

  /**
   * Recompiles and restarts the agent session (full restart with compilation)
   */
  public async recompileAndRestart(): Promise<void> {
    await this.sessionManager.recompileAndRestartSession();
  }

  /**
   * Sets the agent ID
   */
  public setAgentId(agentId: string): void {
    this.state.currentAgentId = agentId;
  }

  /**
   * Starts a preview session for an agent
   */
  public async startPreviewSession(agentId: string, agentSource: AgentSource, isLiveMode?: boolean): Promise<void> {
    if (!this.webviewView) {
      throw new Error('Webview is not ready. Please ensure the view is visible.');
    }

    await this.sessionManager.startSession(agentId, agentSource, isLiveMode, this.webviewView);
  }

  /**
   * Refreshes the available agents list
   */
  public async refreshAvailableAgents(): Promise<void> {
    // Clear state and update UI immediately (optimistic update)
    this.state.currentAgentId = undefined;

    if (this.webviewView) {
      this.state.currentAgentName = undefined;
      await this.state.setAgentSelected(false);
      await this.state.setSessionActive(false);
      await this.state.setSessionStarting(false);
      await this.state.setResetAgentViewAvailable(false);
      this.state.pendingStartAgentId = undefined;
      this.state.pendingStartAgentSource = undefined;

      this.messageSender.sendSelectAgent('', false);
      this.messageSender.sendClearMessages();
      this.messageSender.sendNoHistoryFound('refresh-placeholder');
      this.messageSender.sendRefreshAgents();
    }

    // End session in background (non-blocking) - restoreConnection can be slow
    void this.endSession();
  }

  /**
   * Gets agents for command palette
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
   * Resets the current agent view
   */
  public async resetCurrentAgentView(): Promise<void> {
    if (!this.webviewView) {
      throw new Error('Agent view is not ready to reset.');
    }

    if (!this.state.currentAgentId) {
      throw new Error('No agent selected to reset.');
    }

    // Optimistic update: clear UI and update context immediately
    this.messageSender.sendClearMessages();
    await this.state.setResetAgentViewAvailable(false);
    await this.state.setSessionErrorState(false);

    // Load history in background (non-blocking)
    // Use stored agentSource to avoid slow getAgentSource call
    const agentId = this.state.currentAgentId;
    const agentSource = this.state.currentAgentSource ?? (await getAgentSource(agentId));
    void this.historyManager.showHistoryOrPlaceholder(agentId, agentSource);
  }

  /**
   * Saves the current conversation session using the saved export directory.
   * Prompts for folder selection only on first use.
   */
  public async exportConversation(): Promise<void> {
    await this.doExportConversation(false);
  }

  /**
   * Saves the current conversation session, always prompting for a new location.
   * Updates the saved export directory with the new selection.
   */
  public async exportConversationAs(): Promise<void> {
    await this.doExportConversation(true);
  }

  /**
   * Core export logic shared between Save and Save As
   * @param forcePrompt - If true, always show folder picker (Save As behavior)
   */
  private async doExportConversation(forcePrompt: boolean): Promise<void> {
    const agentId = this.state.currentAgentId;
    const agentSource = this.state.currentAgentSource;

    if (!agentId || !agentSource) {
      vscode.window.showWarningMessage('No agent selected to save session.');
      return;
    }

    // Check for saved export directory (skip if forcePrompt is true)
    let targetDirectory = forcePrompt ? undefined : this.state.getExportDirectory();

    // If no saved directory or forcePrompt, prompt user to select one
    if (!targetDirectory) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const savedDir = this.state.getExportDirectory();
      const defaultUri = savedDir
        ? vscode.Uri.file(savedDir)
        : workspaceFolder
          ? vscode.Uri.joinPath(workspaceFolder.uri, 'sessions')
          : undefined;

      const selectedFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Save Chat History',
        title: 'Select folder to save chat history',
        defaultUri
      });

      if (!selectedFolder || selectedFolder.length === 0) {
        return; // User cancelled
      }

      targetDirectory = selectedFolder[0].fsPath;

      // Save the selected directory for future exports
      await this.state.setExportDirectory(targetDirectory);
    }

    try {
      // If there's an active session, use the library's saveSession method
      if (this.state.isSessionActive && this.state.agentInstance) {
        await this.state.agentInstance.preview.saveSession(targetDirectory);
        vscode.window.showInformationMessage(`Conversation session saved to ${targetDirectory}.`);
        return;
      }

      // No active session - save from loaded history by copying the session directory
      const agentStorageKey = getAgentStorageKey(agentId, agentSource);

      // Get history to find the session ID (getAllHistory finds the most recent session when sessionId is undefined)
      const history = await getAllHistory(agentStorageKey, undefined);

      if (!history.metadata?.sessionId) {
        vscode.window.showWarningMessage('No conversation history found to save.');
        return;
      }

      const sessionId = history.metadata.sessionId;

      // Get the source directory path where the session is stored
      const sourceDir = await getHistoryDir(agentStorageKey, sessionId);

      // Create destination directory matching the library's format: {outputDir}/{agentId}/session_{sessionId}/
      const destDir = path.join(targetDirectory, agentStorageKey, `session_${sessionId}`);
      await fs.promises.mkdir(destDir, { recursive: true });

      // Copy the entire session directory
      await fs.promises.cp(sourceDir, destDir, { recursive: true });

      vscode.window.showInformationMessage(`Conversation session saved to ${destDir}.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to save conversation: ${errorMessage}`);
    }
  }

  /**
   * Clears conversation history for the current agent
   */
  public async clearHistory(): Promise<void> {
    if (!this.webviewView) {
      throw new Error('Agent view is not ready.');
    }

    if (!this.state.currentAgentId) {
      throw new Error('No agent selected to clear history.');
    }

    const agentSource = this.state.currentAgentSource ?? (await getAgentSource(this.state.currentAgentId));
    await this.historyManager.clearHistory(this.state.currentAgentId, agentSource);
  }
}
