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
  details?: string;
  timestamp?: string;
}

// AgentSource enum values - injected from the extension (from @salesforce/agents)
// This ensures we use the exact same values as the library
declare global {
  interface Window {
    AgentSource: {
      SCRIPT: string;
      PUBLISHED: string;
    };
  }
}

// AgentSource enum values are lowercase: 'script' and 'published'
export const AgentSource = window.AgentSource || {
  SCRIPT: 'script',
  PUBLISHED: 'published'
};

export type AgentSource = typeof AgentSource.SCRIPT | typeof AgentSource.PUBLISHED;

export interface AgentInfo {
  name: string;
  id: string;
  type: AgentSource;
  versionNumber?: number;
}

export interface TraceHistoryMessageEntry {
  storageKey: string;
  agentId: string;
  sessionId: string;
  planId: string;
  messageId?: string;
  userMessage?: string;
  timestamp?: string;
  trace: unknown;
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
  startSession(agentId: string, options?: { isLiveMode?: boolean; agentSource?: string }) {
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

  // Execute a VSCode command
  executeCommand(commandId: string) {
    this.postMessage('executeCommand', { commandId });
  }

  // Notify the extension about the selected agent ID
  setSelectedAgentId(agentId: string, agentSource?: AgentSource) {
    this.postMessage('setSelectedAgentId', { agentId, agentSource });
  }

  // Load conversation history for an agent without starting a session
  loadAgentHistory(agentId: string, agentSource?: AgentSource) {
    this.postMessage('loadAgentHistory', { agentId, agentSource });
  }

  // Set live mode preference
  setLiveMode(isLiveMode: boolean) {
    this.postMessage('setLiveMode', { isLiveMode });
  }

  // Request initial live mode state
  getInitialLiveMode() {
    this.postMessage('getInitialLiveMode');
  }


  openTraceJson(entry: TraceHistoryMessageEntry) {
    this.postMessage('openTraceJson', { entry });
  }

  // Test support - send test response messages
  postTestMessage(command: string, data?: any) {
    this.postMessage(command, data);
  }
}

export const vscodeApi = new VSCodeApiService();
