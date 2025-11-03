import React, { useState, useEffect } from 'react';
import ChatContainer from './ChatContainer';
import FormContainer from './FormContainer';
import PlaceholderContent from './PlaceholderContent';
import { vscodeApi, Message } from '../../services/vscodeApi';
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
  selectedAgentId: string;
}

const AgentPreview: React.FC<AgentPreviewProps> = ({
  clientAppState,
  availableClientApps,
  onClientAppStateChange,
  onAvailableClientAppsChange: _onAvailableClientAppsChange,
  selectedAgentId
}) => {
  const [debugMode, setDebugMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');
  const [agentConnected, setAgentConnected] = useState(false);
  const sessionErrorRef = React.useRef(false);

  useEffect(() => {
    // Set up message handlers for VS Code communication
    vscodeApi.onMessage('sessionStarted', data => {
      // Ignore sessionStarted if we just had an error
      if (sessionErrorRef.current) {
        console.warn('Ignoring sessionStarted after error');
        return;
      }

      // Set messages FIRST, then clear loading state to prevent blank state flash
      if (data) {
        const welcomeMessage: Message = {
          id: Date.now().toString(),
          type: 'agent',
          content: data.content || "Hi! I'm ready to help. What can I do for you?",
          timestamp: new Date().toISOString()
        };
        setMessages([welcomeMessage]);
      }

      // Clear loading state AFTER messages are set
      setSessionActive(true);
      setAgentConnected(true); // Agent is now ready for conversation
      setIsLoading(false);
    });

    // When backend confirms client app ready, clear any temp UI/messages
    vscodeApi.onClientAppReady(() => {
      onClientAppStateChange('ready');
      // Do not auto-start a session; user will still pick an agent from updated list
      // Ensure chat area is clean
      setIsLoading(false);
    });

    vscodeApi.onMessage('sessionStarting', () => {
      setIsLoading(true);
      setLoadingMessage('Loading agent...');
      setSessionActive(false);
      setAgentConnected(false); // Reset agent connected state while starting
      sessionErrorRef.current = false; // Clear any previous error state
      setMessages([]); // Just clear messages without showing transition message
    });

    vscodeApi.onMessage('messageSent', data => {
      // Add message FIRST, then clear loading state to prevent blank state flash
      if (data && data.content) {
        const agentMessage: Message = {
          id: Date.now().toString(),
          type: 'agent',
          content: data.content,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, agentMessage]);
      }

      // Clear loading state AFTER message is added
      setIsLoading(false);
    });

    vscodeApi.onMessage('messageStarting', () => {
      setIsLoading(true);
      setLoadingMessage('Agent is thinking...');
    });

    vscodeApi.onMessage('error', data => {
      setAgentConnected(false); // Reset agent connected state on error
      sessionErrorRef.current = true; // Mark that an error occurred to prevent sessionStarted from processing

      // Update messages FIRST, then clear loading state to prevent blank state flash
      setMessages(prev => {
        const filteredMessages = prev.filter(msg => !(msg.type === 'system' && msg.content === 'Starting session...'));

        // Add the error message
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: `Error: ${data.message}`,
          systemType: 'error',
          timestamp: new Date().toISOString()
        };

        return [...filteredMessages, errorMessage];
      });

      // Clear loading state AFTER messages are updated
      setIsLoading(false);
    });

    vscodeApi.onMessage('sessionEnded', () => {
      setSessionActive(false);
      setIsLoading(false);
      setAgentConnected(false); // Reset agent connected state when session ends
    });

    vscodeApi.onMessage('debugModeChanged', data => {
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

    vscodeApi.onMessage('debugLogProcessed', data => {
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

    vscodeApi.onMessage('debugLogError', data => {
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

    vscodeApi.onMessage('debugLogInfo', data => {
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

    // Don't start session automatically - wait for agent selection
    // The user should select an agent first
    // Note: Agent selection from external commands is now handled in App.tsx

    return () => {
      if (sessionActive) {
        vscodeApi.endSession();
      }
    };
  }, [sessionActive, onClientAppStateChange]);

  // Listen for backend client app readiness signals
  useEffect(() => {
    const handleReady = () => {
      onClientAppStateChange('ready');
      setIsLoading(false);
    };
    vscodeApi.onClientAppReady(handleReady);

    // no cleanup needed for our simple message bus
  }, [onClientAppStateChange]);

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
