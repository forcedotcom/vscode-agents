import React, { useState, useEffect } from "react";
import ChatContainer from "./ChatContainer";
import FormContainer from "./FormContainer";
import { vscodeApi, Message } from "../../services/vscodeApi";
import "./AgentPreview.css";

const AgentPreview: React.FC = () => {
  const [debugMode, setDebugMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSelectedAgent, setHasSelectedAgent] = useState(false);

  useEffect(() => {
    // Set up message handlers for VS Code communication
    vscodeApi.onMessage('sessionStarted', (data) => {
      setSessionActive(true);
      setIsLoading(false);
      setHasSelectedAgent(true);
      if (data) {
        const welcomeMessage: Message = {
          id: Date.now().toString(),
          type: 'agent',
          content: data.content || "Hi! I'm ready to help. What can I do for you?",
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() - 1).toString(),
            type: 'system',
            content: 'Session started successfully.',
            systemType: 'session',
            timestamp: new Date().toISOString()
          },
          welcomeMessage
        ]);
      }
    });

    vscodeApi.onMessage('sessionStarting', () => {
      setIsLoading(true);
      const startingMessage: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: 'Starting session...',
        systemType: 'session',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, startingMessage]);
    });

    vscodeApi.onMessage('messageSent', (data) => {
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

    vscodeApi.onMessage('error', (data) => {
      setIsLoading(false);
      
      // Remove the "Starting session..." message if it exists
      setMessages(prev => {
        const filteredMessages = prev.filter(msg => 
          !(msg.type === 'system' && msg.content === 'Starting session...')
        );
        
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
      const endMessage: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: 'Session ended.',
        systemType: 'session',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, endMessage]);
    });

    vscodeApi.onMessage('debugModeChanged', (data) => {
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

    vscodeApi.onMessage('debugLogProcessed', (data) => {
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

    vscodeApi.onMessage('debugLogError', (data) => {
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

    vscodeApi.onMessage('debugLogInfo', (data) => {
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

    return () => {
      if (sessionActive) {
        vscodeApi.endSession();
      }
    };
  }, []);

  const handleSendMessage = (content: string) => {
    if (!sessionActive || !hasSelectedAgent) {
      return;
    }

    // Allow sending even when loading - let the backend handle message queuing
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
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
    setMessages([]);
    vscodeApi.clearChat();
  };

  // Show placeholder when no agent is selected
  if (!hasSelectedAgent && messages.length === 0) {
    return (
      <div className="agent-preview">
        <div className="agent-preview-placeholder">
          <div className="placeholder-content">
            <h3>Welcome to Agent Chat</h3>
            <p>Select an agent from the dropdown below to start a conversation.</p>
            <p><strong>Note:</strong> Agents are loaded from your Salesforce org. Only active agents are shown.</p>
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
        />
      </div>
    );
  }

  return (
    <div className="agent-preview">
      <ChatContainer 
        messages={messages} 
        isLoading={isLoading}
      />
      <FormContainer
        debugMode={debugMode}
        onDebugModeChange={handleDebugModeChange}
        onSendMessage={handleSendMessage}
        onClearChat={handleClearChat}
        sessionActive={sessionActive && hasSelectedAgent}
        isLoading={isLoading}
        messages={messages}
      />
    </div>
  );
};

export default AgentPreview;
