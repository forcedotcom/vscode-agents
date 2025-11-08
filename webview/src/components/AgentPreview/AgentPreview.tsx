import React, { useState, useEffect } from 'react';
import ChatContainer from './ChatContainer.js';
import FormContainer from './FormContainer.js';
import PlaceholderContent from './PlaceholderContent.js';
import { vscodeApi, Message } from '../../services/vscodeApi.js';
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
}

const AgentPreview: React.FC<AgentPreviewProps> = ({
  clientAppState,
  availableClientApps,
  onClientAppStateChange,
  onAvailableClientAppsChange: _onAvailableClientAppsChange,
  isSessionTransitioning,
  onSessionTransitionSettled,
  pendingAgentId,
  selectedAgentId
}) => {
  const [debugMode, setDebugMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [agentConnected, setAgentConnected] = useState(false);
  const sessionErrorTimestampRef = React.useRef<number>(0);
  const sessionActiveStateRef = React.useRef(false);
  const previousSelectedAgentRef = React.useRef<string>('');
  const selectedAgentIdRef = React.useRef(selectedAgentId);
  const pendingAgentIdRef = React.useRef(pendingAgentId);

  useEffect(() => {
    selectedAgentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  useEffect(() => {
    pendingAgentIdRef.current = pendingAgentId;
  }, [pendingAgentId]);

  useEffect(() => {
    const disposers: Array<() => void> = [];

    const disposeClearMessages = vscodeApi.onMessage('clearMessages', () => {
      setMessages([]);
      setSessionActive(false);
      setAgentConnected(false);
      setIsLoading(false);
    });
    disposers.push(disposeClearMessages);

    const disposeConversationHistory = vscodeApi.onMessage('conversationHistory', data => {
      if (data && Array.isArray(data.messages) && data.messages.length > 0) {
        const historyMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id || `${msg.timestamp}-${Date.now()}`,
          type: msg.type as 'user' | 'agent',
          content: msg.content || '',
          timestamp: msg.timestamp || new Date().toISOString()
        }));
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
      // No history found - auto-start the session
      if (data && data.agentId) {
        setIsLoading(true);
        vscodeApi.startSession(data.agentId);
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
        const welcomeMessage: Message = {
          id: Date.now().toString(),
          type: 'agent',
          content: data.content || "Hi! I'm ready to help. What can I do for you?",
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, welcomeMessage]);
      }

      setSessionActive(true);
      setAgentConnected(true);
      setIsLoading(false);
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
        content: `Compilation Error: ${data?.message || 'Failed to compile agent'}`,
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

    const disposePreviewDisclaimer = vscodeApi.onMessage('previewDisclaimer', data => {
      if (data && data.message) {
        const disclaimerMessage: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: data.message,
          systemType: 'warning',
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, disclaimerMessage]);
      }
    });
    disposers.push(disposePreviewDisclaimer);

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

      setMessages(prev => {
        const filteredMessages = prev.filter(msg => !(msg.type === 'system' && msg.content === 'Starting session...'));

        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: `Error: ${data.message}`,
          systemType: 'error',
          timestamp: new Date().toISOString()
        };

        return [...filteredMessages, errorMessage];
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

    const disposeDebugModeChanged = vscodeApi.onMessage('debugModeChanged', data => {
      if (data && data.message) {
        const debugMessage: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: data.message,
          systemType: 'debug',
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, debugMessage]);
      }
    });
    disposers.push(disposeDebugModeChanged);

    const disposeDebugLogProcessed = vscodeApi.onMessage('debugLogProcessed', data => {
      if (data && data.message) {
        const logMessage: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: data.message,
          systemType: 'debug',
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, logMessage]);
      }
    });
    disposers.push(disposeDebugLogProcessed);

    const disposeDebugLogError = vscodeApi.onMessage('debugLogError', data => {
      if (data && data.message) {
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: data.message,
          systemType: 'error',
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    });
    disposers.push(disposeDebugLogError);

    const disposeDebugLogInfo = vscodeApi.onMessage('debugLogInfo', data => {
      if (data && data.message) {
        const infoMessage: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: data.message,
          systemType: 'debug',
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, infoMessage]);
      }
    });
    disposers.push(disposeDebugLogInfo);

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
      if (!pendingAgentId || pendingAgentId === selectedAgentId || selectedAgentId === '') {
        setIsLoading(true);
        setLoadingMessage('Connecting to agent...');
        setAgentConnected(false);
      }
    } else if (!pendingAgentId || pendingAgentId === selectedAgentId || selectedAgentId === '') {
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

  const handleDebugModeChange = (enabled: boolean) => {
    setDebugMode(enabled);
    vscodeApi.setApexDebugging(enabled);

    const debugMessage: Message = {
      id: Date.now().toString(),
      type: 'system',
      content: `Debug mode ${enabled ? 'activated' : 'deactivated'}.`,
      systemType: 'debug',
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, debugMessage]);
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
      // Reset to placeholder state
      setDebugMode(false);
      setSessionActive(false);
      setIsLoading(false);
      setAgentConnected(false);
      setMessages([]);
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

  // Show placeholder when no agent is selected or in special client app states
  if (selectedAgentId === '' || clientAppState === 'selecting') {
    return (
      <div className="agent-preview">
        {renderAgentSelection()}
        <PlaceholderContent />
        <FormContainer
          debugMode={debugMode}
          onDebugModeChange={handleDebugModeChange}
          onSendMessage={handleSendMessage}
          sessionActive={false}
          isLoading={isLoading}
          messages={messages}
        />
      </div>
    );
  }

  return (
    <div className="agent-preview">
      {renderAgentSelection()}
      <ChatContainer messages={messages} isLoading={isLoading} loadingMessage={loadingMessage} />
      <FormContainer
        debugMode={debugMode}
        onDebugModeChange={handleDebugModeChange}
        onSendMessage={handleSendMessage}
        sessionActive={agentConnected}
        isLoading={isLoading}
        messages={messages}
      />
    </div>
  );
};

export default AgentPreview;
