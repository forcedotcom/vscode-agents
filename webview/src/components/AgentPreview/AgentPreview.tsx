import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import ChatContainer from './ChatContainer.js';
import FormContainer from './FormContainer.js';
import PlaceholderContent from './PlaceholderContent.js';
import AgentPreviewPlaceholder from './AgentPreviewPlaceholder.js';
import { vscodeApi, Message, AgentInfo } from '../../services/vscodeApi.js';
import { ChatInputRef } from './ChatInput.js';
import './AgentPreview.css';

interface AgentPreviewProps {
  isSessionTransitioning: boolean;
  onSessionTransitionSettled: () => void;
  pendingAgentId: string | null;
  selectedAgentId: string;
  onHasSessionError?: (hasError: boolean) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  isLiveMode?: boolean;
  selectedAgentInfo?: AgentInfo | null;
  onLiveModeChange?: (isLive: boolean) => void;
  hasAgents?: boolean;
  isLoadingAgents?: boolean;
}

export interface AgentPreviewRef {
  focusInput: () => void;
  sendMessage?: (message: string) => void;
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


const AgentPreview = forwardRef<AgentPreviewRef, AgentPreviewProps>(
  (
    {
      isSessionTransitioning,
      onSessionTransitionSettled,
      pendingAgentId,
      selectedAgentId,
      onHasSessionError,
      onLoadingChange,
      isLiveMode = false,
      selectedAgentInfo = null,
      onLiveModeChange,
      hasAgents = false,
      isLoadingAgents = true
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
      },
      sendMessage: (message: string) => {
        handleSendMessage(message);
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

      // Atomic conversation state update - replaces separate clearMessages + conversationHistory
      // to avoid visual blink from sequential state updates
      const disposeSetConversation = vscodeApi.onMessage('setConversation', data => {
        // Atomically update all conversation-related state in one render
        const historyMessages: Message[] =
          data && Array.isArray(data.messages) ? data.messages.map(normalizeHistoryMessage) : [];

        setMessages(historyMessages);
        setShowPlaceholder(data?.showPlaceholder ?? historyMessages.length === 0);
        setSessionActive(false);
        setAgentConnected(false);
        setIsLoading(false);
        setHasSessionError(false);
      });
      disposers.push(disposeSetConversation);

      const disposeNoHistoryFound = vscodeApi.onMessage('noHistoryFound', data => {
        // No history found - show placeholder instead of auto-starting
        if (data && data.agentId) {
          setShowPlaceholder(true);
          setIsLoading(false);
        }
      });
      disposers.push(disposeNoHistoryFound);


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
          content: data?.message || 'Failed to compile the agent.',
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
          const errorMessage = createSystemMessage(data?.message, 'error');
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
    }, [onSessionTransitionSettled]);

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

      // Don't clear messages here - let the backend's setConversation message
      // handle it atomically to avoid visual blink

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

    const handleStartSession = () => {
      if (!hasAgentSelection(selectedAgentId)) {
        return;
      }
      setShowPlaceholder(false);
      setIsLoading(true);
      vscodeApi.startSession(selectedAgentId);
    };

    // Show placeholder when no agent is selected
    if (selectedAgentId === '') {
      return (
        <div className="agent-preview">
          <PlaceholderContent hasAgents={hasAgents} isLoadingAgents={isLoadingAgents} />
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
