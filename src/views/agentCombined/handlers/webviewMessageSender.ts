import * as vscode from 'vscode';
import type { AgentViewState } from '../state/agentViewState';
import type { TraceHistoryEntry } from '../../../utils/traceHistory';

/**
 * Handles all outgoing messages to the webview
 */
export class WebviewMessageSender {
  private webviewView?: vscode.WebviewView;

  constructor(private readonly state: AgentViewState) {}

  setWebview(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
  }

  private postMessage(command: string, data?: unknown): void {
    if (!this.webviewView) {
      return;
    }
    this.webviewView.webview.postMessage({ command, data });
  }

  // Session messages
  sendSessionStarting(message?: string): void {
    this.postMessage('sessionStarting', { message: message || 'Starting session...' });
  }

  sendSessionStarted(welcomeMessage?: string): void {
    this.postMessage('sessionStarted', welcomeMessage);
  }

  sendSessionEnded(): void {
    this.postMessage('sessionEnded', {});
  }

  // Compilation messages
  sendCompilationStarting(message?: string): void {
    this.postMessage('compilationStarting', { message: message || 'Compiling agent...' });
  }

  sendCompilationError(message: string): void {
    this.postMessage('compilationError', { message });
  }

  sendSimulationStarting(message?: string): void {
    this.postMessage('simulationStarting', { message });
  }

  // Chat messages
  sendMessageStarting(): void {
    this.postMessage('messageStarting', { message: 'Sending message...' });
  }

  sendMessageSent(content?: string): void {
    this.postMessage('messageSent', { content });
  }

  // Agent selection
  sendSelectAgent(agentId: string, forceRestart?: boolean, agentSource?: string): void {
    this.postMessage('selectAgent', { agentId, forceRestart, agentSource });
  }

  sendAvailableAgents(agents: Array<{ name: string; id: string; type: string }>, selectedAgentId?: string): void {
    this.postMessage('availableAgents', {
      agents,
      selectedAgentId: selectedAgentId || this.state.currentAgentId
    });
  }

  // History messages
  sendConversationHistory(messages: Array<{ id: string; type: string; content: string; timestamp: number }>): void {
    this.postMessage('conversationHistory', { messages });
  }

  sendSetConversation(
    messages: Array<{ id: string; type: string; content: string; timestamp: number }>,
    showPlaceholder: boolean
  ): void {
    this.postMessage('setConversation', { messages, showPlaceholder });
  }

  sendTraceHistory(agentId: string, entries: TraceHistoryEntry[]): void {
    this.postMessage('traceHistory', { agentId, entries });
  }

  sendTraceData(trace: unknown): void {
    this.postMessage('traceData', trace);
  }

  sendNoHistoryFound(agentId: string): void {
    this.postMessage('noHistoryFound', { agentId });
  }

  // Error messages
  async sendError(message: string): Promise<void> {
    const sanitizedMessage = this.stripHtmlTags(message);
    this.postMessage('error', { message: sanitizedMessage });
  }

  sendDebugLogError(message: string): void {
    this.postMessage('debugLogError', { message });
  }

  // Configuration messages
  sendConfiguration(section: string, value: unknown): void {
    this.postMessage('configuration', { section, value });
  }

  // Live mode messages
  sendLiveMode(isLiveMode: boolean): void {
    this.postMessage('setLiveMode', { isLiveMode });
  }

  // Utility messages
  sendClearMessages(): void {
    this.postMessage('clearMessages');
  }

  sendRefreshAgents(): void {
    this.postMessage('refreshAgents');
  }


  // Helper method to strip HTML tags
  private stripHtmlTags(text: string): string {
    return text
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
