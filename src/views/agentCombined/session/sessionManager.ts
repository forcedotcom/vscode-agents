import { AgentSource, ScriptAgent, ProductionAgent } from '@salesforce/agents';
import { SfError } from '@salesforce/core';
import { EOL } from 'os';
import { CoreExtensionService } from '../../../services/coreExtensionService';
import type { AgentViewState } from '../state/agentViewState';
import type { WebviewMessageSender } from '../handlers/webviewMessageSender';
import type { AgentInitializer } from '../agent/agentInitializer';
import type { HistoryManager } from '../history/historyManager';
import { Logger } from '../../../utils/logger';
import { createSessionStartGuards } from './sessionStartGuards';
import { SessionStartCancelledError } from '../types';
import { validatePublishedAgentId } from '../agent/agentUtils';
import { SfProject } from '@salesforce/core';

/**
 * Manages agent session lifecycle (start, end, restart)
 */
export class SessionManager {
  private readonly logger: Logger;

  constructor(
    private readonly state: AgentViewState,
    private readonly messageSender: WebviewMessageSender,
    private readonly agentInitializer: AgentInitializer,
    private readonly historyManager: HistoryManager
  ) {
    this.logger = new Logger(CoreExtensionService.getChannelService());
  }

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
        this.logger.error(detailedError, sfError);
        this.messageSender.sendCompilationError(detailedError);
        return;
      }

      this.logger.error('Error starting session', err);
      throw err;
    }
  }

  /**
   * Ends the current agent session
   */
  async endSession(restoreViewCallback?: () => Promise<void>): Promise<void> {
    this.state.cancelPendingSessionStart();
    const sessionWasStarting = this.state.isSessionStarting;

    if (this.state.agentInstance && this.state.sessionId) {
      // Restore connection before clearing agent references
      try {
        await this.state.agentInstance.restoreConnection();
      } catch (error) {
        console.warn('Error restoring connection:', error);
      }

      this.state.clearSessionState();
      await this.state.setSessionActive(false);
      await this.state.setSessionStarting(false);

      this.messageSender.sendSessionEnded();
    } else if (sessionWasStarting) {
      await this.state.setSessionActive(false);
      await this.state.setSessionStarting(false);
      this.messageSender.sendSessionEnded();
    }

    if (sessionWasStarting && restoreViewCallback) {
      await restoreViewCallback();
    }

    this.logger.debug('Simulation ended');
  }

  /**
   * Restarts the agent session without recompilation
   */
  async restartSession(): Promise<void> {
    if (!this.state.agentInstance || !this.state.sessionId) {
      return;
    }

    try {
      await this.state.setSessionStarting(true);

      // End the current session first
      const isAgentSimulate = this.state.currentAgentSource === AgentSource.SCRIPT;
      if (isAgentSimulate) {
        await (this.state.agentInstance.preview as any).end();
      } else {
        await this.state.agentInstance.preview.end(this.state.sessionId, 'UserRequest');
      }

      // Restore connection after ending session
      if (this.state.agentInstance) {
        try {
          await this.state.agentInstance.restoreConnection();
        } catch (error) {
          console.warn('Error restoring connection:', error);
        }
      }

      // Clear conversation state
      this.state.currentPlanId = undefined;
      this.state.currentUserMessage = undefined;
      await this.state.setConversationDataAvailable(false);

      // Clear the UI
      this.messageSender.sendClearMessages();

      // Show starting message
      const modeMessage = this.state.isLiveMode ? 'Starting live test...' : 'Starting simulation...';
      this.messageSender.sendSimulationStarting(modeMessage);

      this.logger.debug('Restarting agent session');

      // Start a new session on the existing agentInstance
      const session = await this.state.agentInstance.preview.start();
      this.state.sessionId = session.sessionId;

      // Load trace history if available
      if (this.state.currentAgentId && this.state.currentAgentSource) {
        await this.historyManager.loadAndSendTraceHistory(this.state.currentAgentId, this.state.currentAgentSource);
      }

      await this.state.setSessionActive(true);
      await this.state.setSessionStarting(false);

      // Send session started message
      const agentMessage = session.messages.find((msg: any) => msg.type === 'Inform');
      this.messageSender.sendSessionStarted(agentMessage?.message);

      await this.state.setConversationDataAvailable(true);

      this.logger.debug('Agent session restarted');
    } catch (error) {
      await this.state.setSessionStarting(false);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to restart session: ${errorMessage}`, error);
      await this.messageSender.sendError(`Failed to restart: ${errorMessage}`);
    }
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
          this.logger.debug(`SF_TEST_API = ${process.env.SF_TEST_API ?? 'false'}`);
          this.logger.debug('Compilation endpoint called');
          this.messageSender.sendCompilationStarting(data.message);
        }
      },
      (data: { message?: string }) => {
        this.logger.debug('Simulation session started');
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
