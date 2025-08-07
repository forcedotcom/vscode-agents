import React, { useState, useEffect, useRef } from "react";
import ChatContainer from "./ChatContainer";
import FormContainer from "./FormContainer";
import "./AgentChat.css";

interface Message {
  id: string;
  type: "user" | "agent" | "system";
  content: string;
  systemType?: "session" | "debug" | "error";
}

const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

const AgentChat: React.FC = () => {
  const [debugMode, setDebugMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [sendDisabled, setSendDisabled] = useState(true);
  const [selectedAgentName, setSelectedAgentName] = useState('Select an Agent');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (vscode) {
      vscode.postMessage({ command: 'queryAgents' });
    } else {
      console.error('vscode API not available.');
    }
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { command, data, error } = event.data;
      if (command === 'agentSelectedFromCommand') {
        // Agent selected from VS Code command palette
        setSelectedAgentName(data.label);
        
        // Clear previous error messages when starting a new session
        setMessages(prev => prev.filter(msg => 
          !(msg.type === 'system' && msg.systemType === 'error')
        ));
        
        if (vscode) {
          vscode.postMessage({ command: 'startSession', data: data.id });
        }
      } else if (command === 'sessionStarting') {
        setMessages(prev => [
          ...prev,
          { 
            id: 'session-starting', 
            type: 'system', 
            content: data.message,
            systemType: 'session'
          }
        ]);
        setSendDisabled(true);
      } else if (command === 'sessionConnected') {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === 'session-starting' 
              ? { ...msg, content: data.message }
              : msg
          )
        );
      } else if (command === 'sessionStarted') {
        // Check if this is an agent introduction message or a system message
        const isAgentMessage = data.message && (
          data.message.includes("I'm") || 
          data.message.includes("AI") ||
          data.message.includes("assistant") ||
          data.message.includes("help")
        );
        
        // Clear previous error messages on successful connection
        setMessages(prev => {
          const messagesWithoutErrors = prev.filter(msg => 
            !(msg.type === 'system' && msg.systemType === 'error')
          );
          
          return [
            ...messagesWithoutErrors,
            { 
              id: Date.now().toString(), 
              type: isAgentMessage ? 'agent' : 'system',
              content: data.message,
              ...(isAgentMessage ? {} : { systemType: 'session' })
            }
          ];
        });
        setSendDisabled(false);
        setTimeout(() => inputRef.current?.focus(), 0);
      } else if (command === 'chatResponse') {
        setIsThinking(false);
        setMessages(prev => [
          ...prev,
          { 
            id: Date.now().toString(), 
            type: 'agent', 
            content: data.message
          }
        ]);
        setSendDisabled(false);
        setTimeout(() => inputRef.current?.focus(), 0);
      } else if (command === 'chatError') {
        const { clearPrevious } = event.data;
        setMessages(prev => {
          const filteredMessages = clearPrevious
            ? prev.filter(msg => !(msg.type === 'system' && msg.content === 'Starting session...'))
            : prev;
          return [
            ...filteredMessages,
            {
              id: Date.now().toString(),
              type: 'system',
              content: error,
              systemType: 'error'
            }
          ];
        });
      } else if (command === 'stopButtonClicked') {
        // Handle stop button click from VSCode panel header
        handleEndSession();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSendMessage = (content: string) => {
    if (!content || sendDisabled) return;
    
    setSendDisabled(true);
    setIsThinking(true);
    setMessages(prev => [
      ...prev, 
      { 
        id: Date.now().toString(), 
        type: 'user', 
        content: content
      }
    ]);
    
    if (vscode) {
      vscode.postMessage({ command: 'sendChatMessage', text: content });
    } else {
      console.error('vscode API not available.');
    }
  };

  const handleDebugModeChange = (enabled: boolean) => {
    setDebugMode(enabled);
    if (vscode) {
      vscode.postMessage({ command: 'setApexDebugging', data: enabled });
      
      const message = enabled ? 'Debug mode was activated.' : 'Debug mode was deactivated.';
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          type: 'system',
          content: message,
          systemType: 'debug'
        }
      ]);
    } else {
      console.warn('vscode API not available');
    }
  };

  const handleEndSession = () => {
    setSendDisabled(true);
    setIsThinking(false);
    setSelectedAgentName('Select an Agent');
    
    if (vscode) {
      vscode.postMessage({ command: 'endSession', data: messages });
    } else {
      console.warn('vscode API not available');
    }
    
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        type: 'system',
        content: 'Session was terminated.',
        systemType: 'session'
      }
    ]);
  };

  return (
    <div className="agent-chat">
      <ChatContainer 
        messages={messages} 
        isThinking={isThinking}
      />
      <FormContainer
        debugMode={debugMode}
        onDebugModeChange={handleDebugModeChange}
        onSendMessage={handleSendMessage}
        sendDisabled={sendDisabled}
        inputRef={inputRef}
        vscode={vscode}
        selectedAgentName={selectedAgentName}
      />
    </div>
  );
};

export default AgentChat;