import React, { useState, useEffect } from 'react';
import ChatContainer from './ChatContainer';
import FormContainer from './FormContainer';
import { vscodeApi, Message } from '../../services/vscodeApi';
import './AgentPreview.css';

interface ClientApp {
  name: string;
  clientId: string;
}

const AgentPreview: React.FC = () => {
  const [debugMode, setDebugMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSelectedAgent, setHasSelectedAgent] = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);
  const [clientAppState, setClientAppState] = useState<'none' | 'required' | 'selecting' | 'ready'>('none');
  const [availableClientApps, setAvailableClientApps] = useState<ClientApp[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');

  useEffect(() => {
    // Set up message handlers for VS Code communication
    vscodeApi.onMessage('sessionStarted', data => {
      setSessionActive(true);
      setIsLoading(false);
      setHasSelectedAgent(true);
      setAgentConnected(true); // Agent is now ready for conversation
      if (data) {
        const welcomeMessage: Message = {
          id: Date.now().toString(),
          type: 'agent',
          content: data.content || "Hi! I'm ready to help. What can I do for you?",
          timestamp: new Date().toISOString()
        };
        setMessages([welcomeMessage]);
      }
    });

    // When backend confirms client app ready, clear any temp UI/messages
    vscodeApi.onClientAppReady(() => {
      setClientAppState('ready');
      // Do not auto-start a session; user will still pick an agent from updated list
      // Ensure chat area is clean
      setIsLoading(false);
    });

    vscodeApi.onMessage('sessionStarting', () => {
      setIsLoading(true);
      setAgentConnected(false); // Reset agent connected state while starting
      setMessages([]); // Just clear messages without showing transition message
    });

    vscodeApi.onMessage('messageSent', data => {
      setIsLoading(false);
      if (data && data.content) {
        const agentMessage: Message = {
          id: Date.now().toString(),
          type: 'agent',
          content: data.content,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, agentMessage]);
      }
    });

    vscodeApi.onMessage('messageStarting', () => {
      setIsLoading(true);
    });

    vscodeApi.onMessage('error', data => {
      setIsLoading(false);
      setAgentConnected(false); // Reset agent connected state on error

      // Remove the "Starting session..." message if it exists
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

    // Handle agent selection from external command (e.g., play-circle button)
    vscodeApi.onMessage('selectAgent', data => {
      if (data && data.agentId) {
        setSelectedAgentId(data.agentId);
        // End current session if one exists
        if (sessionActive) {
          vscodeApi.endSession();
        }
        // Start new session with the selected agent
        vscodeApi.startSession(data.agentId);
      }
    });

    // Don't start session automatically - wait for agent selection
    // The user should select an agent first

    return () => {
      if (sessionActive) {
        vscodeApi.endSession();
      }
    };
  }, [sessionActive]);

  // Listen for backend reset completion and client app readiness signals
  useEffect(() => {
    const handleReady = () => {
      setClientAppState('ready');
      setIsLoading(false);
    };
    vscodeApi.onClientAppReady(handleReady);

    const handleResetComplete = () => {
      setClientAppState('none');
      setAvailableClientApps([]);
      setMessages([]);
    };
    vscodeApi.onMessage('resetComplete', handleResetComplete);

    // no cleanup needed for our simple message bus
  }, []);

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

  const handleClearChat = () => {
    // Reset all UI state back to initial
    setDebugMode(false);
    setSessionActive(false);
    setIsLoading(false);
    setHasSelectedAgent(false);
    setAgentConnected(false);
    setClientAppState('none');
    setAvailableClientApps([]);
    setSelectedAgentId(''); // Reset selected agent

    // Show welcome message
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      type: 'system',
      content: `
        <div class="welcome-message">
          <h2 style="font-size: 1.2em; margin: 0 0 8px 0;">Welcome to Agent Chat!</h2>
          <p style="margin: 0;">Select an agent to begin.</p>
        </div>
      `,
      systemType: 'session',
      timestamp: new Date().toISOString()
    };
    setMessages([welcomeMessage]);

    // Ask backend to reset its state
    vscodeApi.reset();
  };

  const handleClientAppRequired = (_data: any) => {
    setClientAppState('required');
    // Replace chat content with only the error message
    setMessages([
      {
        id: Date.now().toString(),
        type: 'system',
        content:
          'Client app required for agent preview. See "Preview an Agent" in the Agentforce Developer Guide for complete documentation: https://developer.salesforce.com/docs/einstein/genai/guide/agent-dx-preview.html',
        systemType: 'error',
        timestamp: new Date().toISOString()
      }
    ]);
  };

  const handleClientAppSelection = (data: any) => {
    setClientAppState('selecting');
    setAvailableClientApps(data.clientApps || []);
    const selectionMessage: Message = {
      id: Date.now().toString(),
      type: 'system',
      content: `Multiple client apps found (${data.clientApps?.length || 0}). Please select one to continue.`,
      systemType: 'session',
      timestamp: new Date().toISOString()
    };
    setMessages([selectionMessage]);
  };

  const handleClientAppSelected = (clientAppName: string) => {
    // Hide client app selection UI and reset chat area to normal
    setClientAppState('ready');
    // Clear any prior selection/status messages and return to normal chat state
    setMessages([]);
    // Notify backend to finalize the client app selection and refresh agents
    vscodeApi.selectClientApp(clientAppName);
  };

  // Show placeholder when no agent is selected and no client app issues
  if (!hasSelectedAgent && messages.length === 0 && clientAppState === 'none') {
    return (
      <div className="agent-preview">
        <div className="agent-preview-placeholder">
          <div className="placeholder-content">
            <h3>Welcome to Agent Chat</h3>
            <p>Select an agent from the dropdown below to start a conversation.</p>
            <p>
              <strong>Note:</strong> Agents are loaded from your Salesforce org. Only active agents are shown.
            </p>
          </div>
        </div>
        <FormContainer
          debugMode={debugMode}
          onDebugModeChange={handleDebugModeChange}
          onSendMessage={handleSendMessage}
          onClearChat={handleClearChat}
          sessionActive={false}
          isLoading={isLoading}
          messages={messages}
          onClientAppRequired={handleClientAppRequired}
          onClientAppSelection={handleClientAppSelection}
          selectedAgent={selectedAgentId}
          onAgentChange={setSelectedAgentId}
        />
      </div>
    );
  }

  // Render client app selection UI in the chat area for case 3
  const renderClientAppSelection = () => {
    if (clientAppState !== 'selecting') return null;

    return (
      <div style={{ padding: '16px', borderBottom: '1px solid #eee' }}>
        <h4>Select Client App:</h4>
        <select
          onChange={e => {
            if (e.target.value) {
              handleClientAppSelected(e.target.value);
            }
          }}
          style={{ padding: '8px', marginRight: '8px', minWidth: '200px' }}
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

  return (
    <div className="agent-preview">
      {renderClientAppSelection()}
      <ChatContainer messages={messages} isLoading={isLoading} />
      <FormContainer
        debugMode={debugMode}
        onDebugModeChange={handleDebugModeChange}
        onSendMessage={handleSendMessage}
        onClearChat={handleClearChat}
        sessionActive={agentConnected}
        isLoading={isLoading}
        messages={messages}
        onClientAppRequired={handleClientAppRequired}
        onClientAppSelection={handleClientAppSelection}
        selectedAgent={selectedAgentId}
        onAgentChange={setSelectedAgentId}
      />
    </div>
  );
};

export default AgentPreview;
