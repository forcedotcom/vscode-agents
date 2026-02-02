import * as vscode from 'vscode';
import { AgentSource, Agent } from '@salesforce/agents';
import { SfProject, SfError } from '@salesforce/core';
import { CoreExtensionService } from '../../../services/coreExtensionService';
import type { TraceHistoryEntry } from '../../../utils/traceHistory';
import type { AgentMessage } from '../types';
import type { AgentViewState } from '../state';
import type { WebviewMessageSender } from './webviewMessageSender';
import type { SessionManager } from '../session';
import type { HistoryManager } from '../history';
import type { ApexDebugManager } from '../debugging';
import { Logger } from '../../../utils/logger';
import { getAgentSource } from '../agent';

/**
 * Handles all incoming messages from the webview
 */
export class WebviewMessageHandlers {
  private readonly logger: Logger;

  constructor(
    private readonly state: AgentViewState,
    private readonly messageSender: WebviewMessageSender,
    private readonly sessionManager: SessionManager,
    private readonly historyManager: HistoryManager,
    private readonly apexDebugManager: ApexDebugManager,
    private readonly context: vscode.ExtensionContext,
    private readonly webviewView: vscode.WebviewView
  ) {
    this.logger = new Logger(CoreExtensionService.getChannelService());
  }

  /**
   * Routes webview messages to the appropriate handler method
   */
  async handleMessage(message: AgentMessage): Promise<void> {
    const command = message.command || message.type;
    if (!command) {
      console.warn('Received message without command or type:', message);
      return;
    }

    const commandHandlers: Record<string, (message: AgentMessage) => Promise<void>> = {
      startSession: async msg => await this.handleStartSession(msg),
      setApexDebugging: async msg => await this.handleSetApexDebugging(msg),
      sendChatMessage: async msg => await this.handleSendChatMessage(msg),
      endSession: async () => await this.handleEndSession(),
      loadAgentHistory: async msg => await this.handleLoadAgentHistory(msg),
      getAvailableAgents: async () => await this.handleGetAvailableAgents(),
      getTraceData: async () => await this.handleGetTraceData(),
      openTraceJson: async msg => await this.handleOpenTraceJson(msg),
      getConfiguration: async msg => await this.handleGetConfiguration(msg),
      executeCommand: async msg => await this.handleExecuteCommand(msg),
      setSelectedAgentId: async msg => await this.handleSetSelectedAgentId(msg),
      setLiveMode: async msg => await this.handleSetLiveMode(msg),
      getInitialLiveMode: async () => await this.handleGetInitialLiveMode(),
      // Test-specific commands for integration tests
      clearMessages: async () => {
        // Clear messages in the webview - no-op on extension side
        this.messageSender.sendClearMessages();
      },
      testTraceDataReceived: async () => {
        // Test command - no-op
      },
      testTraceHistoryReceived: async () => {
        // Test command - no-op
      }
    };

    const handler = commandHandlers[command];
    if (handler) {
      await handler(message);
    } else {
      console.warn(`Unknown webview command: ${command}`);
    }
  }

  /**
   * Handles errors from webview message processing
   */
  async handleError(err: unknown): Promise<void> {
    console.error('AgentCombinedViewProvider Error:', err);
    const sfError = SfError.wrap(err);
    let errorMessage = sfError.message;
    this.logger.error('AgentCombinedViewProvider error', sfError);

    this.state.pendingStartAgentId = undefined;
    this.state.pendingStartAgentSource = undefined;

    if (this.state.agentInstance || this.state.isSessionActive) {
      this.state.clearSessionState();
      await this.state.setSessionActive(false);
      await this.state.setSessionStarting(false);
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

    await this.messageSender.sendError(errorMessage);
    await this.state.setResetAgentViewAvailable(true);
    await this.state.setSessionErrorState(true);
  }

  private async handleStartSession(message: AgentMessage): Promise<void> {
    const data = message.data as { agentId?: string; isLiveMode?: boolean; agentSource?: string } | undefined;
    const agentId = data?.agentId || this.state.currentAgentId;

    if (!agentId || typeof agentId !== 'string') {
      throw new Error(`Invalid agent ID: ${agentId}. Expected a string.`);
    }

    // Determine agent source - prefer passed value, then state, then fetch
    let agentSource = (data?.agentSource as AgentSource) ?? this.state.currentAgentSource;
    if (!agentSource) {
      agentSource = await getAgentSource(agentId);
    }
    this.state.currentAgentSource = agentSource;

    const isLiveMode = data?.isLiveMode ?? false;
    await this.sessionManager.startSession(agentId, agentSource, isLiveMode, this.webviewView);
  }

  private async handleSetApexDebugging(message: AgentMessage): Promise<void> {
    const enabled = message.data as boolean | undefined;
    await this.state.setDebugMode(enabled ?? false);
    if (this.state.agentInstance) {
      this.state.agentInstance.preview.setApexDebugging(this.state.isApexDebuggingEnabled);
    }
  }

  private async handleSendChatMessage(message: AgentMessage): Promise<void> {
    if (!this.state.agentInstance || !this.state.sessionId) {
      throw new Error('Session has not been started.');
    }

    this.messageSender.sendMessageStarting();

    const data = message.data as { message?: string } | undefined;
    const userMessage = data?.message;
    if (!userMessage || typeof userMessage !== 'string') {
      throw new Error('Invalid message: expected a string.');
    }

    this.logger.debug('Sending message to agent preview');

    const response = await this.state.agentInstance.preview.send(userMessage);

    const lastMessage = response.messages?.at(-1);
    this.state.currentPlanId = lastMessage?.planId;
    this.state.currentUserMessage = userMessage;

    this.messageSender.sendMessageSent(lastMessage?.message);
    this.logger.debug('Received response from agent preview');

    // Load and send trace data after sending message
    if (this.state.currentAgentId && this.state.currentAgentSource) {
      const loadTraceWithRetry = async (retries = 5, delay = 200) => {
        for (let i = 0; i < retries; i++) {
          try {
            // Use agent instance method to get history
            if (this.state.agentInstance && this.state.sessionId) {
              await this.historyManager.loadAndSendTraceHistory(
                this.state.currentAgentId!,
                this.state.currentAgentSource!
              );
              return;
            }

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

      loadTraceWithRetry().catch(err => {
        console.error('Error in trace loading retry:', err);
      });
    }

    // Handle Apex debug log
    if (this.state.isApexDebuggingEnabled && response.apexDebugLog) {
      await this.apexDebugManager.handleApexDebugLog(response.apexDebugLog, this.context);
    } else if (this.state.isApexDebuggingEnabled && !response.apexDebugLog) {
      vscode.window.showInformationMessage('Debug mode is enabled but no Apex was executed.');
    }
  }

  private async handleEndSession(): Promise<void> {
    await this.sessionManager.endSession(async () => {
      const agentId = this.state.pendingStartAgentId ?? this.state.currentAgentId;
      if (agentId) {
        const agentSource = this.state.pendingStartAgentSource ?? (await getAgentSource(agentId));
        await this.historyManager.showHistoryOrPlaceholder(agentId, agentSource);
      }
    });
  }

  private async handleLoadAgentHistory(message: AgentMessage): Promise<void> {
    const data = message.data as { agentId?: string; agentSource?: string } | undefined;
    const agentId = data?.agentId;
    if (agentId && typeof agentId === 'string') {
      // Use passed agentSource if available to avoid expensive listPreviewable call
      const agentSource = (data?.agentSource as AgentSource) ?? (await getAgentSource(agentId));
      await this.historyManager.showHistoryOrPlaceholder(agentId, agentSource);
    }
  }

  private async handleGetAvailableAgents(): Promise<void> {
    try {
      const conn = await CoreExtensionService.getDefaultConnection();
      const project = SfProject.getInstance();
      const allAgents = await Agent.listPreviewable(conn, project);

      // Map agents - script agents use aabName as id, published agents use id
      const mappedAgents = allAgents
        .filter(agent => agent.id || agent.aabName) // Must have either id (published) or aabName (script)
        .map(agent => {
          const agentId = agent.id || agent.aabName;
          if (!agentId) {
            throw new Error(`Agent ${agent.name} is missing both id and aabName`);
          }
          return {
            name: agent.name,
            id: agentId,
            type: agent.source
          };
        });

      this.messageSender.sendAvailableAgents(mappedAgents, this.state.currentAgentId);

      if (this.state.currentAgentId) {
        this.state.currentAgentId = undefined;
      }
    } catch (err) {
      console.error('Error getting available agents from org:', err);
      this.messageSender.sendAvailableAgents([], undefined);
    }
  }

  private async handleGetTraceData(): Promise<void> {
    try {
      if (this.state.currentAgentId && this.state.currentAgentSource) {
        await this.historyManager.loadAndSendTraceHistory(this.state.currentAgentId, this.state.currentAgentSource);
        return;
      }

      // If no agent is selected, send empty trace data
      const emptyTraceData = { plan: [], planId: '', sessionId: '' };
      this.messageSender.sendTraceData(emptyTraceData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.messageSender.sendError(errorMessage);
    }
  }

  private async handleOpenTraceJson(message: AgentMessage): Promise<void> {
    const data = message.data as { entry?: TraceHistoryEntry } | undefined;
    await this.historyManager.openTraceJsonEntry(data?.entry);
  }

  private async handleGetConfiguration(message: AgentMessage): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    const data = message.data as { section?: string } | undefined;
    const section = data?.section;
    if (section) {
      const value = config.get(section);
      this.messageSender.sendConfiguration(section, value);
    }
  }

  private async handleExecuteCommand(message: AgentMessage): Promise<void> {
    const data = message.data as { commandId?: string } | undefined;
    const commandId = data?.commandId;
    if (commandId && typeof commandId === 'string') {
      await vscode.commands.executeCommand(commandId);
    }
  }

  private async handleSetSelectedAgentId(message: AgentMessage): Promise<void> {
    const data = message.data as { agentId?: string; agentSource?: string } | undefined;
    const agentId = data?.agentId;
    if (agentId && typeof agentId === 'string' && agentId !== '') {
      this.state.currentAgentId = agentId;
      // Use passed agentSource if available to avoid expensive listPreviewable call
      this.state.currentAgentSource = (data?.agentSource as AgentSource) ?? (await getAgentSource(agentId));
      await this.state.setAgentSelected(true);
      await this.state.setResetAgentViewAvailable(false);
      await this.state.setSessionErrorState(false);
      // Load history atomically with agent selection to avoid download button delay
      await this.historyManager.showHistoryOrPlaceholder(agentId, this.state.currentAgentSource);
    } else {
      this.state.currentAgentId = undefined;
      this.state.currentAgentSource = undefined;
      await this.state.setAgentSelected(false);
      await this.state.setConversationDataAvailable(false);
    }
  }

  private async handleSetLiveMode(message: AgentMessage): Promise<void> {
    const data = message.data as { isLiveMode?: boolean } | undefined;
    const isLiveMode = data?.isLiveMode;
    if (typeof isLiveMode === 'boolean') {
      await this.state.setLiveMode(isLiveMode);
    }
  }

  private async handleGetInitialLiveMode(): Promise<void> {
    this.messageSender.sendLiveMode(this.state.isLiveMode);
  }
}
