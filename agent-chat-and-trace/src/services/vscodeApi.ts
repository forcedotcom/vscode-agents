// VS Code API integration for the React app
declare global {
  interface Window {
    vscode: any;
  }
}

export interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  systemType?: 'session' | 'debug' | 'error';
  timestamp?: string;
}

export interface AgentInfo {
  name: string;
  id: string;
}

export interface TraceData {
  sessionId: string;
  planId: string;
  steps: TraceStep[];
  startTime: string;
  endTime?: string;
}

export interface TraceStep {
  type:
    | 'userMessage'
    | 'topicSelection'
    | 'topic'
    | 'actionSelection'
    | 'action'
    | 'responseValidation'
    | 'agentResponse';
  timing: string;
  data: any;
}

class VSCodeApiService {
  private vscode = window.vscode;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  constructor() {
    // Listen for messages from VS Code
    window.addEventListener('message', event => {
      const message = event.data;
      const handler = this.messageHandlers.get(message.command);
      if (handler) {
        handler(message.data);
      }
    });
  }

  // Register a handler for specific message types
  onMessage(command: string, handler: (data: any) => void) {
    this.messageHandlers.set(command, handler);
  }

  // Send messages to VS Code
  private postMessage(command: string, data?: any) {
    this.vscode?.postMessage({ command, data });
  }

  // Agent session management
  startSession(agentId: string) {
    this.postMessage('startSession', { agentId });
  }

  endSession() {
    this.postMessage('endSession');
  }

  sendChatMessage(message: string) {
    this.postMessage('sendChatMessage', { message });
  }

  // Debug mode
  setApexDebugging(enabled: boolean) {
    this.postMessage('setApexDebugging', enabled);
  }

  // Agent management
  getAvailableAgents() {
    this.postMessage('getAvailableAgents');
  }

  // Trace data
  getTraceData(traceId?: string) {
    this.postMessage('getTraceData', traceId ? { traceId } : undefined);
  }

  // Clear chat
  clearChat() {
    this.postMessage('clearChat');
  }

  // Get configuration values
  getConfiguration(section: string) {
    this.postMessage('getConfiguration', { section });
  }

  // Client app selection
  selectClientApp(clientAppName: string) {
    this.postMessage('clientAppSelected', { clientAppName });
  }

  // Informational message when client app is ready
  onClientAppReady(handler: () => void) {
    this.onMessage('clientAppReady', handler);
  }

  // Reset entire preview state
  reset() {
    this.postMessage('reset');
  }
}

export const vscodeApi = new VSCodeApiService();
