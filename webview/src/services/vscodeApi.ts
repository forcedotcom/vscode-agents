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
  systemType?: 'session' | 'debug' | 'error' | 'warning';
  timestamp?: string;
}

export interface AgentInfo {
  name: string;
  id: string;
  type: 'published' | 'script';
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

type MessageHandler = (data: any) => void;

class VSCodeApiService {
  private vscode = window.vscode;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();

  constructor() {
    // Listen for messages from VS Code
    window.addEventListener('message', event => {
      const message = event.data;
      const handlers = this.messageHandlers.get(message.command);
      if (handlers) {
        handlers.forEach(handler => handler(message.data));
      }
    });
  }

  // Register a handler for specific message types
  onMessage(command: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(command)) {
      this.messageHandlers.set(command, new Set());
    }
    const handlers = this.messageHandlers.get(command)!;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.messageHandlers.delete(command);
      }
    };
  }

  // Send messages to VS Code
  private postMessage(command: string, data?: any) {
    this.vscode?.postMessage({ command, data });
  }

  // Agent session management
  startSession(agentId: string, options?: { isLiveMode?: boolean }) {
    this.postMessage('startSession', { agentId, ...options });
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
  getTraceData() {
    this.postMessage('getTraceData');
  }

  // Clear chat
  clearChat() {
    this.postMessage('clearChat');
  }

  // Clear messages in the panel
  clearMessages() {
    this.postMessage('clearMessages');
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
  onClientAppReady(handler: () => void): () => void {
    return this.onMessage('clientAppReady', handler);
  }

  // Execute a VSCode command
  executeCommand(commandId: string) {
    this.postMessage('executeCommand', { commandId });
  }

  // Notify the extension about the selected agent ID
  setSelectedAgentId(agentId: string) {
    this.postMessage('setSelectedAgentId', { agentId });
  }

  // Load conversation history for an agent without starting a session
  loadAgentHistory(agentId: string) {
    this.postMessage('loadAgentHistory', { agentId });
  }

  // Set live mode preference
  setLiveMode(isLiveMode: boolean) {
    this.postMessage('setLiveMode', { isLiveMode });
  }

  // Request initial live mode state
  getInitialLiveMode() {
    this.postMessage('getInitialLiveMode');
  }

  sendConversationExport(content: string, fileName: string) {
    this.postMessage('conversationExportReady', { content, fileName });
  }
}

export const vscodeApi = new VSCodeApiService();
