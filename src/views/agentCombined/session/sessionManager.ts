import { AgentSource, ScriptAgent, ProductionAgent } from '@salesforce/agents';
import { SfError } from '@salesforce/core';
import { EOL } from 'os';
import { CoreExtensionService } from '../../../services/coreExtensionService';
import type { AgentViewState } from '../state/agentViewState';
import type { WebviewMessageSender } from '../handlers/webviewMessageSender';
import type { AgentInitializer } from '../agent/agentInitializer';
import type { HistoryManager } from '../history/historyManager';
import type { ChannelService } from '../../../types/ChannelService';
import { createSessionStartGuards } from './sessionStartGuards';
import { SessionStartCancelledError } from '../types';
import { validatePublishedAgentId } from '../agent/agentUtils';
import { SfProject } from '@salesforce/core';

/**
 * Manages agent session lifecycle (start, end, restart)
 */
export class SessionManager {
  constructor(
    private readonly state: AgentViewState,
    private readonly messageSender: WebviewMessageSender,
    private readonly agentInitializer: AgentInitializer,
    private readonly historyManager: HistoryManager,
    private readonly channelService: ChannelService
  ) {}

  /**
   * Starts a preview session for an agent
   */
  async startSession(
    agentId: string,
    agentSource: AgentSource,
    isLiveMode?: boolean,
    webviewView?: any
  ): Promise<void> {
    if (!webviewView) {
      throw new Error('Webview is not ready. Please ensure the view is visible.');
    }

    const sessionStartId = this.state.beginSessionStart();
    const { ensureActive, isActive } = createSessionStartGuards(this.state, sessionStartId);

    try {
      await this.state.setSessionStarting(true);
      ensureActive();

      // Clear any previous error messages
      this.messageSender.sendClearMessages();
      this.messageSender.sendSessionStarting();

      // Reset planId when starting a new session
      this.state.currentPlanId = undefined;

      // Get connection and project
      const conn = await CoreExtensionService.getDefaultConnection();
      ensureActive();

      // Update currentAgentId
      this.state.currentAgentId = agentId;
      const project = SfProject.getInstance();

      this.state.pendingStartAgentId = agentId;
      this.state.pendingStartAgentSource = agentSource;

      // Initialize agent based on source
      if (agentSource === AgentSource.SCRIPT) {
        await this.initializeScriptAgent(agentId, conn, project, isLiveMode, isActive, ensureActive);
      } else {
        await this.initializePublishedAgent(agentId, conn, project, ensureActive);
      }

      if (!this.state.agentInstance) {
        throw new Error('Failed to initialize agent instance.');
      }

      // Start the session
      const session = await this.state.agentInstance.preview.start();
      ensureActive();
      this.state.sessionId = session.sessionId;

      // Load history
      await this.historyManager.loadAndSendTraceHistory(agentId, agentSource);
      await this.state.setSessionActive(true);
      ensureActive();
      await this.state.setSessionStarting(false);
      ensureActive();

      // Send session started message
      const agentMessage = session.messages.find((msg: any) => msg.type === 'Inform');
      this.messageSender.sendSessionStarted(agentMessage?.message);
      this.state.pendingStartAgentId = undefined;
      this.state.pendingStartAgentSource = undefined;
      await this.state.setConversationDataAvailable(true);
    } catch (err) {
      if (err instanceof SessionStartCancelledError || !isActive()) {
        return;
      }

      // Handle compilation errors
      if (
        this.state.currentAgentSource === AgentSource.SCRIPT &&
        err instanceof SfError &&
        err.message.includes('Failed to compile agent script')
      ) {
        const sfError = err as SfError;
        const detailedError = `Failed to compile agent script${EOL}${sfError.name}`;
        this.channelService.appendLine(detailedError);
        this.messageSender.sendCompilationError(detailedError);
        await this.state.setSessionStarting(false);
        await this.state.setResetAgentViewAvailable(true);
        await this.state.setSessionErrorState(true);
        return;
      }

      this.channelService.appendLine(`Error starting session: ${err}`);
      this.channelService.appendLine('---------------------');
      throw err;
    }
  }

  /**
   * Ends the current agent session
   */
  async endSession(restoreViewCallback?: () => Promise<void>): Promise<void> {
    this.state.cancelPendingSessionStart();
    const sessionWasStarting = this.state.isSessionStarting;

    // Optimistic update: immediately update VS Code context so view/title icons change
    // This matches the webview's optimistic update for button state
    await this.state.setSessionActive(false);
    await this.state.setSessionStarting(false);

    if (this.state.agentInstance && this.state.sessionId) {
      // Restore connection before clearing agent references
      try {
        await this.state.agentInstance.restoreConnection();
      } catch (error) {
        console.warn('Error restoring connection:', error);
      }

      this.state.clearSessionState();
      this.messageSender.sendSessionEnded();
    } else if (sessionWasStarting) {
      this.messageSender.sendSessionEnded();
    }

    if (sessionWasStarting && restoreViewCallback) {
      await restoreViewCallback();
    }

    this.channelService.appendLine(`Simulation ended.`);
    this.channelService.appendLine('---------------------');
  }

  /**
   * Restarts the agent session without recompilation
   */
  async restartSession(): Promise<void> {
    if (!this.state.agentInstance || !this.state.sessionId) {
      return;
    }

    try {
      const message = this.state.isLiveMode ? 'Restarting live test...' : 'Restarting...';
      await this.beginRestart(message);

      // Start a new session directly - the SDK handles ending the previous session internally
      const session = await this.state.agentInstance.preview.start();
      this.state.sessionId = session.sessionId;

      await this.completeRestart(session, 'Agent session restarted.');
    } catch (error) {
      await this.handleRestartError(error, 'restart');
    }
  }

  /**
   * Recompiles and restarts the agent session (full restart with compilation)
   */
  async recompileAndRestartSession(): Promise<void> {
    const agentId = this.state.currentAgentId;
    const agentSource = this.state.currentAgentSource;
    const isLiveMode = this.state.isLiveMode;

    if (!agentId || !agentSource) {
      return;
    }

    const sessionStartId = this.state.beginSessionStart();
    const { ensureActive, isActive } = createSessionStartGuards(this.state, sessionStartId);

    try {
      await this.beginRestart('Recompiling and restarting...');

      // End current session and clear agent instance (to trigger recompilation)
      if (this.state.agentInstance && this.state.sessionId) {
        const isAgentSimulate = agentSource === AgentSource.SCRIPT;
        if (isAgentSimulate) {
          await (this.state.agentInstance.preview as any).end();
        } else {
          await this.state.agentInstance.preview.end(this.state.sessionId, 'UserRequest');
        }

        try {
          await this.state.agentInstance.restoreConnection();
        } catch (error) {
          console.warn('Error restoring connection:', error);
        }
      }

      // Clear session state including agent instance (forces recompilation)
      this.state.clearSessionState();
      ensureActive();

      // Get connection and project for re-initialization
      const conn = await CoreExtensionService.getDefaultConnection();
      ensureActive();

      this.state.currentAgentId = agentId;
      const project = SfProject.getInstance();

      this.state.pendingStartAgentId = agentId;
      this.state.pendingStartAgentSource = agentSource;

      // Re-initialize agent (this triggers compilation for script agents)
      if (agentSource === AgentSource.SCRIPT) {
        await this.initializeScriptAgent(agentId, conn, project, isLiveMode, isActive, ensureActive);
      } else {
        await this.initializePublishedAgent(agentId, conn, project, ensureActive);
      }

      if (!this.state.agentInstance) {
        throw new Error('Failed to initialize agent instance.');
      }

      // Start the session
      const session = await this.state.agentInstance.preview.start();
      ensureActive();
      this.state.sessionId = session.sessionId;

      await this.completeRestart(session, 'Agent session recompiled and restarted.', ensureActive);
      this.state.pendingStartAgentId = undefined;
      this.state.pendingStartAgentSource = undefined;
    } catch (error) {
      if (error instanceof SessionStartCancelledError || !isActive()) {
        return;
      }

      // Handle compilation errors specifically
      if (
        this.state.currentAgentSource === AgentSource.SCRIPT &&
        error instanceof SfError &&
        error.message.includes('Failed to compile agent script')
      ) {
        const sfError = error as SfError;
        const detailedError = `Failed to compile agent script${EOL}${sfError.name}`;
        this.channelService.appendLine(detailedError);
        this.messageSender.sendCompilationError(detailedError);
        await this.state.setSessionStarting(false);
        await this.state.setResetAgentViewAvailable(true);
        await this.state.setSessionErrorState(true);
        return;
      }

      await this.handleRestartError(error, 'recompile and restart');
    }
  }

  /**
   * Common setup for restart operations - immediate UI feedback
   */
  private async beginRestart(message: string): Promise<void> {
    await this.state.setSessionActive(false);
    await this.state.setSessionStarting(true);
    this.messageSender.sendClearMessages();
    this.messageSender.sendSessionStarting(message);
    this.channelService.appendLine(`${message.replace('...', '')} agent session...`);

    // Clear conversation state
    this.state.currentPlanId = undefined;
    this.state.currentUserMessage = undefined;
    await this.state.setConversationDataAvailable(false);
  }

  /**
   * Common completion for restart operations
   */
  private async completeRestart(
    session: any,
    logMessage: string,
    ensureActive?: () => void
  ): Promise<void> {
    if (this.state.currentAgentId && this.state.currentAgentSource) {
      await this.historyManager.loadAndSendTraceHistory(this.state.currentAgentId, this.state.currentAgentSource);
    }

    await this.state.setSessionActive(true);
    ensureActive?.();
    await this.state.setSessionStarting(false);
    ensureActive?.();

    const agentMessage = session.messages.find((msg: any) => msg.type === 'Inform');
    this.messageSender.sendSessionStarted(agentMessage?.message);
    await this.state.setConversationDataAvailable(true);

    this.channelService.appendLine(logMessage);
    this.channelService.appendLine('---------------------');
  }

  /**
   * Common error handling for restart operations
   */
  private async handleRestartError(error: unknown, action: string): Promise<void> {
    await this.state.setSessionActive(false);
    await this.state.setSessionStarting(false);

    const errorMessage = error instanceof Error ? error.message : String(error);
    this.channelService.appendLine(`Failed to ${action} session: ${errorMessage}`);

    await this.messageSender.sendError(`Failed to ${action}: ${errorMessage}`);
    await this.state.setResetAgentViewAvailable(true);
    await this.state.setSessionErrorState(true);
  }

  /**
   * Initializes a script agent
   */
  private async initializeScriptAgent(
    agentId: string,
    conn: any,
    project: any,
    isLiveMode: boolean | undefined,
    isActive: () => boolean,
    ensureActive: () => void
  ): Promise<void> {
    const filePath = agentId;
    if (!filePath) {
      throw new Error('No file path found for script agent.');
    }

    const determinedLiveMode = isLiveMode ?? false;
    await this.state.setLiveMode(determinedLiveMode);
    ensureActive();

    // Initialize agent with lifecycle listeners
    await this.agentInitializer.initializeScriptAgent(
      filePath,
      conn,
      project,
      determinedLiveMode,
      isActive,
      (data: { message?: string; error?: string }) => {
        if (data.error) {
          this.messageSender.sendCompilationError(data.error);
        } else {
          this.channelService.appendLine(`SF_TEST_API = ${process.env.SF_TEST_API ?? 'false'}`);
          this.channelService.appendLine(`Compilation end point called.`);
          this.messageSender.sendCompilationStarting(data.message);
        }
      },
      (data: { message?: string }) => {
        this.channelService.appendLine(`Simulation session started.`);
        const modeMessage = determinedLiveMode ? 'Starting live test...' : 'Starting simulation...';
        this.messageSender.sendSimulationStarting(data.message || modeMessage);
      }
    );

    this.state.currentAgentName = this.state.agentInstance?.name;
    this.state.currentAgentId = agentId;

    // Enable debug mode if set
    if (this.state.isApexDebuggingEnabled && this.state.agentInstance) {
      this.state.agentInstance.preview.setApexDebugging(this.state.isApexDebuggingEnabled);
    }
  }

  /**
   * Initializes a published agent
   */
  private async initializePublishedAgent(
    agentId: string,
    conn: any,
    project: any,
    ensureActive: () => void
  ): Promise<void> {
    // Validate agent ID format - only validate if it looks like a Bot ID
    // This prevents errors when a script agent name is incorrectly passed here
    if (agentId.startsWith('0X') && (agentId.length === 15 || agentId.length === 18)) {
      validatePublishedAgentId(agentId);
    } else {
      // If it doesn't look like a Bot ID, this is likely a misrouted script agent
      // Throw a more helpful error
      throw new Error(
        `Invalid agent ID for published agent. Expected a Bot ID (starting with "0X"), but got: ${agentId}. This may be a script agent.`
      );
    }

    // Published agents are always in live mode
    await this.state.setLiveMode(true);
    ensureActive();

    // Initialize agent
    await this.agentInitializer.initializePublishedAgent(agentId, conn, project);

    this.state.currentAgentName = this.state.agentInstance?.name;
    this.state.currentAgentId = agentId;

    // Enable debug mode if set
    if (this.state.isApexDebuggingEnabled && this.state.agentInstance) {
      this.state.agentInstance.preview.setApexDebugging(this.state.isApexDebuggingEnabled);
    }
  }
}
