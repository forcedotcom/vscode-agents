import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import ChatContainer from './ChatContainer.js';
import FormContainer from './FormContainer.js';
import PlaceholderContent from './PlaceholderContent.js';
import AgentPreviewPlaceholder from './AgentPreviewPlaceholder.js';
import { vscodeApi, Message, AgentInfo } from '../../services/vscodeApi.js';
import { ChatInputRef } from './ChatInput.js';
import './AgentPreview.css';

interface ClientApp {
  name: string;
  clientId: string;
}

interface AgentPreviewProps {
  clientAppState: 'none' | 'required' | 'selecting' | 'ready';
  availableClientApps: ClientApp[];
  onClientAppStateChange: (state: 'none' | 'required' | 'selecting' | 'ready') => void;
  onAvailableClientAppsChange: (apps: ClientApp[]) => void;
  isSessionTransitioning: boolean;
  onSessionTransitionSettled: () => void;
  pendingAgentId: string | null;
  selectedAgentId: string;
  onHasSessionError?: (hasError: boolean) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  isLiveMode?: boolean;
  selectedAgentInfo?: AgentInfo | null;
  onLiveModeChange?: (isLive: boolean) => void;
}

export interface AgentPreviewRef {
  focusInput: () => void;
}


export const normalizeHistoryMessage = (msg: any): Message => ({
  id: msg?.id || `${msg?.timestamp ?? 'history'}-${Date.now()}`,
  type: msg?.type as 'user' | 'agent',
  content: msg?.content || '',
  timestamp: msg?.timestamp || new Date().toISOString()
});

export const pruneStartingSessionMessages = (messages: Message[]): Message[] =>
  messages.filter(message => !(message.type === 'system' && message.content === 'Starting session...'));

export const createSystemMessage = (message?: string, systemType: Message['systemType'] = 'debug'): Message | null => {
  if (!message) {
    return null;
  }

  return {
    id: Date.now().toString(),
    type: 'system',
    content: message,
    systemType,
    timestamp: new Date().toISOString()
  };
};

export const shouldShowTransitionLoader = (pendingAgentId?: string | null, selectedAgentId?: string): boolean => {
  return !pendingAgentId || pendingAgentId === selectedAgentId || selectedAgentId === '';
};

export const hasAgentSelection = (selectedAgentId?: string): boolean => Boolean(selectedAgentId);

export const sanitizeConversationFileName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const buildConversationMarkdown = (
  agentLabel: string,
  exportMessages: Message[],
  disclaimer?: string
): string => {
  const exportedAt = new Date();
  const exportedTimestamp = `${exportedAt.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
  const lines: string[] = [
    '# Agentforce DX (AFDX) Log',
    '',
    '## Details',
    '',
    `- **Agent:** \`${agentLabel}\``,
    `- **Exported:** ${exportedTimestamp}`,
    '',
    '## Conversation',
    ''
  ];

  if (disclaimer) {
    lines.push(`> ${disclaimer}`);
    lines.push('');
  }

  if (!exportMessages || exportMessages.length === 0) {
    lines.push('_No conversation messages available._');
    return lines.join('\n');
  }

  exportMessages.forEach(message => {
    const role = message.type === 'user' ? 'User' : message.type === 'agent' ? 'Agent' : 'System';
    const timestamp = message.timestamp ? new Date(message.timestamp) : null;
    const timeFragment = timestamp
      ? `${timestamp.getUTCHours().toString().padStart(2, '0')}:${timestamp
          .getUTCMinutes()
          .toString()
          .padStart(2, '0')}:${timestamp.getUTCSeconds().toString().padStart(2, '0')}`
      : 'Unknown time';
    lines.push(`### ${timeFragment} | ${role}`);
    lines.push('');
    lines.push(message.content || '');
    lines.push('');
  });

  return lines.join('\n');
};

const AgentPreview = forwardRef<AgentPreviewRef, AgentPreviewProps>(
  (
    {
      clientAppState,
      availableClientApps,
      onClientAppStateChange,
      onAvailableClientAppsChange: _onAvailableClientAppsChange,
      isSessionTransitioning,
      onSessionTransitionSettled,
      pendingAgentId,
      selectedAgentId,
      onHasSessionError,
      onLoadingChange,
      isLiveMode = false,
      selectedAgentInfo = null,
      onLiveModeChange
    },
    ref
  ) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [sessionActive, setSessionActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Loading...');
    const [agentConnected, setAgentConnected] = useState(false);
    const [hasSessionError, setHasSessionError] = useState(false);
    const [showPlaceholder, setShowPlaceholder] = useState(false);
    const sessionErrorTimestampRef = React.useRef<number>(0);
    const sessionActiveStateRef = React.useRef(false);
    const hasSessionErrorRef = React.useRef(false);
    const previousSelectedAgentRef = React.useRef<string>('');
    const selectedAgentIdRef = React.useRef(selectedAgentId);
    const pendingAgentIdRef = React.useRef(pendingAgentId);
    const chatInputRef = useRef<ChatInputRef>(null);
    const messagesRef = useRef<Message[]>([]);
    const agentInfoRef = useRef<AgentInfo | null>(selectedAgentInfo ?? null);

    // Expose focus method to parent components
    useImperativeHandle(ref, () => ({
      focusInput: () => {
        chatInputRef.current?.focus();
      }
    }));

    useEffect(() => {
      selectedAgentIdRef.current = selectedAgentId;
    }, [selectedAgentId]);

    useEffect(() => {
      pendingAgentIdRef.current = pendingAgentId;
    }, [pendingAgentId]);

    useEffect(() => {
      messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
      agentInfoRef.current = selectedAgentInfo ?? null;
    }, [selectedAgentInfo]);

    // Notify parent when session error state changes and keep ref in sync
    useEffect(() => {
      hasSessionErrorRef.current = hasSessionError;
      if (onHasSessionError) {
        onHasSessionError(hasSessionError);
      }
    }, [hasSessionError, onHasSessionError]);

    // Notify parent when loading state changes
    useEffect(() => {
      if (onLoadingChange) {
        onLoadingChange(isLoading);
      }
    }, [isLoading, onLoadingChange]);

    useEffect(() => {
      const disposers: Array<() => void> = [];

      const disposeClearMessages = vscodeApi.onMessage('clearMessages', () => {
        setMessages([]);
        setSessionActive(false);
        setAgentConnected(false);
        setIsLoading(false);
        setHasSessionError(false); // Clear error state when switching agents
        setShowPlaceholder(false); // Clear placeholder when switching agents
      });
      disposers.push(disposeClearMessages);

      const disposeConversationHistory = vscodeApi.onMessage('conversationHistory', data => {
        if (data && Array.isArray(data.messages) && data.messages.length > 0) {
          const historyMessages: Message[] = data.messages.map(normalizeHistoryMessage);
          setMessages(historyMessages);
        } else {
          setMessages([]);
        }

        // History loaded - show it without starting session
        // User will manually click play button to start new session
        setSessionActive(false);
        setAgentConnected(false);
        setIsLoading(false);
      });
      disposers.push(disposeConversationHistory);

      const disposeNoHistoryFound = vscodeApi.onMessage('noHistoryFound', data => {
        // No history found - show placeholder instead of auto-starting
        if (data && data.agentId) {
          setShowPlaceholder(true);
          setIsLoading(false);
        }
      });
      disposers.push(disposeNoHistoryFound);

      const disposeExportRequest = vscodeApi.onMessage('requestConversationExport', data => {
        const agentLabel = agentInfoRef.current?.name || data?.agentName || 'Agent Conversation';
        const markdown = buildConversationMarkdown(agentLabel, messagesRef.current);
        const safeBase = sanitizeConversationFileName(agentLabel) || 'agent-conversation';
        const exported = new Date();
        const datePart = exported.toISOString().slice(0, 10);
        const timePart = `${exported.getUTCHours().toString().padStart(2, '0')}-${exported
          .getUTCMinutes()
          .toString()
          .padStart(2, '0')}-${exported.getUTCSeconds().toString().padStart(2, '0')}`;
        const fileName = `${datePart}-${timePart}-${safeBase}.md`;
        vscodeApi.sendConversationExport(markdown, fileName);
      });
      disposers.push(disposeExportRequest);

      const disposeSessionStarted = vscodeApi.onMessage('sessionStarted', data => {
        const timeSinceError = Date.now() - sessionErrorTimestampRef.current;
        if (sessionErrorTimestampRef.current > 0 && timeSinceError < 500) {
          console.warn('Ignoring sessionStarted that arrived too soon after error (race condition)');
          return;
        }

        sessionErrorTimestampRef.current = 0;
        sessionActiveStateRef.current = true;

        if (data) {
          setMessages(prev => {
            const newMessages = [...prev];

            // Add welcome message
            const welcomeMessage: Message = {
              id: (Date.now() + 1).toString(),
              type: 'agent',
              content: data.content || "Hi! I'm ready to help. What can I do for you?",
              timestamp: new Date().toISOString()
            };
            newMessages.push(welcomeMessage);

            return newMessages;
          });
        }

        setSessionActive(true);
        setAgentConnected(true);
        setIsLoading(false);
        setHasSessionError(false); // Clear error state when session successfully starts
        setShowPlaceholder(false); // Clear placeholder when session starts
        onSessionTransitionSettled();
      });
      disposers.push(disposeSessionStarted);

      const disposeClientAppReady = vscodeApi.onClientAppReady(() => {
        onClientAppStateChange('ready');
        setIsLoading(false);
      });
      disposers.push(disposeClientAppReady);

      const disposeSessionStarting = vscodeApi.onMessage('sessionStarting', () => {
        const currentSelectedAgentId = selectedAgentIdRef.current;
        const currentPendingAgentId = pendingAgentIdRef.current;

        setSessionActive(false);
        setAgentConnected(false);
        sessionActiveStateRef.current = false;
        sessionErrorTimestampRef.current = 0;

        if (currentSelectedAgentId === '') {
          setIsLoading(false);
          setMessages([]);
          return;
        }

        if (currentPendingAgentId && currentPendingAgentId === currentSelectedAgentId) {
          setIsLoading(true);
          setLoadingMessage('Connecting to agent...');
        } else if (!currentPendingAgentId) {
          setIsLoading(true);
          setLoadingMessage('Loading agent...');
          setMessages([]);
        } else {
          setIsLoading(false);
        }
      });
      disposers.push(disposeSessionStarting);

      const disposeCompilationStarting = vscodeApi.onMessage('compilationStarting', data => {
        setIsLoading(true);
        setLoadingMessage(data?.message || 'Compiling agent...');
      });
      disposers.push(disposeCompilationStarting);

      const disposeCompilationError = vscodeApi.onMessage('compilationError', data => {
        setIsLoading(false);
        setAgentConnected(false);

        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: data?.message || 'Failed to compile agent',
          systemType: 'error',
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
      });
      disposers.push(disposeCompilationError);

      const disposeSimulationStarting = vscodeApi.onMessage('simulationStarting', data => {
        setIsLoading(true);
        setLoadingMessage(data?.message || 'Starting simulation...');
      });
      disposers.push(disposeSimulationStarting);


      const disposeMessageSent = vscodeApi.onMessage('messageSent', data => {
        if (data && data.content) {
          const agentMessage: Message = {
            id: Date.now().toString(),
            type: 'agent',
            content: data.content,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, agentMessage]);
        }

        setIsLoading(false);
      });
      disposers.push(disposeMessageSent);

      const disposeMessageStarting = vscodeApi.onMessage('messageStarting', () => {
        setIsLoading(true);
        setLoadingMessage('Agent is thinking...');
      });
      disposers.push(disposeMessageStarting);

      const disposeError = vscodeApi.onMessage('error', data => {
        setAgentConnected(false);
        sessionActiveStateRef.current = false;
        sessionErrorTimestampRef.current = Date.now();
        setHasSessionError(true); // Set error state when session fails

        setMessages(prev => {
          const filteredMessages = pruneStartingSessionMessages(prev);
          const errorMessage = createSystemMessage(data?.message || 'Something went wrong', 'error');
          return errorMessage ? [...filteredMessages, errorMessage] : filteredMessages;
        });

        setIsLoading(false);
        onSessionTransitionSettled();
      });
      disposers.push(disposeError);

      const disposeSessionEnded = vscodeApi.onMessage('sessionEnded', () => {
        setSessionActive(false);
        setIsLoading(false);
        setAgentConnected(false);
        sessionActiveStateRef.current = false;
        onSessionTransitionSettled();
      });
      disposers.push(disposeSessionEnded);

      const disposeDebugLogProcessed = vscodeApi.onMessage('debugLogProcessed', data => {
        const logMessage = createSystemMessage(data?.message, 'debug');
        if (logMessage) {
          setMessages(prev => [...prev, logMessage]);
        }
      });
      disposers.push(disposeDebugLogProcessed);

      const disposeDebugLogError = vscodeApi.onMessage('debugLogError', data => {
        const errorMessage = createSystemMessage(data?.message, 'error');
        if (errorMessage) {
          setMessages(prev => [...prev, errorMessage]);
        }
      });
      disposers.push(disposeDebugLogError);

      return () => {
        disposers.forEach(dispose => dispose());
      };
    }, [onClientAppStateChange, onSessionTransitionSettled]);

    useEffect(() => {
      if (selectedAgentId === previousSelectedAgentRef.current) {
        return;
      }

      previousSelectedAgentRef.current = selectedAgentId;
      sessionActiveStateRef.current = false;
      setSessionActive(false);
      setAgentConnected(false);
      setShowPlaceholder(false); // Reset placeholder when agent changes

      if (selectedAgentId === '') {
        setIsLoading(false);
        setMessages([]);
        return;
      }

      setMessages([]);

      if (pendingAgentId && pendingAgentId === selectedAgentId) {
        setIsLoading(true);
        setLoadingMessage('Connecting to agent...');
      }
    }, [selectedAgentId, pendingAgentId]);

    useEffect(() => {
      if (isSessionTransitioning) {
        if (shouldShowTransitionLoader(pendingAgentId, selectedAgentId)) {
          setIsLoading(true);
          setLoadingMessage('Connecting to agent...');
          setAgentConnected(false);
        }
      } else if (shouldShowTransitionLoader(pendingAgentId, selectedAgentId)) {
        setIsLoading(false);
      }
    }, [isSessionTransitioning, pendingAgentId, selectedAgentId]);

    const handleSendMessage = (content: string) => {
      if (!agentConnected) {
        return;
      }

      // Allow sending even when loading - let the backend handle message queuing
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMessage]);

      // Send message to VS Code
      vscodeApi.sendChatMessage(content);
    };

    const handleClientAppSelected = (clientAppName: string) => {
      // Hide client app selection UI and reset chat area to normal
      onClientAppStateChange('ready');
      // Clear any prior selection/status messages and return to normal chat state
      setMessages([]);
      // Notify backend to finalize the client app selection and refresh agents
      vscodeApi.selectClientApp(clientAppName);
    };

    // Watch for when selectedAgentId becomes empty (user selects default option)
    useEffect(() => {
      if (selectedAgentId === '') {
        // End any active session
        if (sessionActive || agentConnected) {
          vscodeApi.endSession();
        }
        // Reset to default welcome state
        setSessionActive(false);
        setIsLoading(false);
        setAgentConnected(false);
        setMessages([]);
        setShowPlaceholder(false);
      }
    }, [selectedAgentId, sessionActive, agentConnected]);

    // Render client app selection UI in the chat area for case 3
    const renderAgentSelection = () => {
      if (clientAppState !== 'selecting') return null;

      return (
        <div className="agent-selection">
          <h4>Select Client App:</h4>
          <select
            className="agent-select"
            onChange={e => {
              if (e.target.value) {
                handleClientAppSelected(e.target.value);
              }
            }}
          >
            <option value="">Choose a client app...</option>
            {availableClientApps.map(app => (
              <option key={app.name} value={app.name}>
                {app.name}
              </option>
            ))}
          </select>
        </div>
      );
    };

    const handleStartSession = () => {
      if (!hasAgentSelection(selectedAgentId)) {
        return;
      }
      setShowPlaceholder(false);
      setIsLoading(true);
      vscodeApi.startSession(selectedAgentId);
    };

    // Show placeholder when no agent is selected or in special client app states
    if (selectedAgentId === '' || clientAppState === 'selecting') {
      return (
        <div className="agent-preview">
          {renderAgentSelection()}
          <PlaceholderContent />
        </div>
      );
    }

    // Show agent preview placeholder when agent is selected but has no history
    if (showPlaceholder && !isLoading && messages.length === 0) {
      return (
        <div className="agent-preview">
          <AgentPreviewPlaceholder
            onStartSession={handleStartSession}
            isLiveMode={isLiveMode}
            selectedAgentInfo={selectedAgentInfo}
            onModeChange={onLiveModeChange}
          />
          <FormContainer
            ref={chatInputRef}
            onSendMessage={handleSendMessage}
            sessionActive={false}
            isLoading={isLoading}
            messages={messages}
            isLiveMode={isLiveMode}
          />
        </div>
      );
    }

    return (
      <div className="agent-preview">
        {renderAgentSelection()}
        <ChatContainer messages={messages} isLoading={isLoading} loadingMessage={loadingMessage} />
        <FormContainer
          ref={chatInputRef}
          onSendMessage={handleSendMessage}
          sessionActive={agentConnected}
          isLoading={isLoading}
          messages={messages}
          isLiveMode={isLiveMode}
        />
      </div>
    );
  }
);

AgentPreview.displayName = 'AgentPreview';

export default AgentPreview;
