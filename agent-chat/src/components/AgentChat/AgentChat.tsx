import React, { useState, useEffect, useRef } from "react";
import ChatContainer from "./ChatContainer";
import FormContainer from "./FormContainer";
import "./AgentChat.css";

interface Message {
  id: string;
  type: "user" | "agent" | "system";
  content: string;
  systemType?: "session" | "debug";
}

interface AgentOption {
  Id: string;
  MasterLabel: string;
}

const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

const AgentChat: React.FC = () => {
  const [debugMode, setDebugMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [sendDisabled, setSendDisabled] = useState(true);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [currentAgent, setCurrentAgent] = useState('Select an Agent');
  const [selectable, setSelectable] = useState<boolean>(true);
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
      if (command === 'setAgents') {
        setAgents(data);
      } else if (command === 'sessionStarting') {
        setSelectable(false);
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
        
        setMessages(prev => [
          ...prev,
          { 
            id: Date.now().toString(), 
            type: isAgentMessage ? 'agent' : 'system',
            content: data.message,
            ...(isAgentMessage ? {} : { systemType: 'session' })
          }
        ]);
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
        setMessages(prev => [
          ...prev, 
          { 
            id: Date.now().toString(), 
            type: 'system', 
            content: error,
            systemType: 'session'
          }
        ]);
        setSelectable(true);
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

  const handleAgentSelect = (agentId: string) => {
    const agent = agents.find(a => a.Id === agentId);
    if (agent && vscode) {
      setCurrentAgent(agent.MasterLabel);
      vscode.postMessage({ command: 'startSession', data: agent.Id });
    }
  };

  const handleEndSession = () => {
    setSendDisabled(true);
    setCurrentAgent('Select an Agent');
    setIsThinking(false);
    setSelectable(true);
    
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
        agents={agents}
        currentAgent={currentAgent}
        selectable={selectable}
        onAgentSelect={handleAgentSelect}
        onEndSession={handleEndSession}
        sendDisabled={sendDisabled}
        inputRef={inputRef}
      />
    </div>
  );
};

export default AgentChat;