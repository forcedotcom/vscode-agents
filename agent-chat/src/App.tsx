import {
  Avatar,
  ChatContainer,
  MainContainer,
  Message,
  MessageInput,
  MessageList,
  TypingIndicator
} from '@chatscope/chat-ui-kit-react';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import React, { useEffect, useRef, useState } from 'react';
import salesforceLogo from './assets/salesforce.png';
import Navbar from './components/Navbar';
import './index.css';
interface Message {
  id: number;
  timestamp: Date;
  role: 'system' | 'user';
  content: string;
}
const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

const App: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [sendDisabled, setSendDisabled] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [agents, setAgents] = useState([]);
  const [currentAgent, setCurrentAgent] = useState('Select an Agent to start session');
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectable, setSelectable] = useState<boolean>(true);

  useEffect(() => {
    if (vscode) {
      vscode.postMessage({ command: 'queryAgents' });
    } else {
      console.error('vscode API not available.');
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', event => {
      const { command, data, error } = event.data;
      if (command === 'setAgents') {
        setAgents(data);
      } else if (command === 'sessionStarting') {
        setSelectable(false);
        setMessages(prev => [
          ...prev,
          { id: prev.length + 1, role: 'system', content: data.message, timestamp: new Date() }
        ]);
        setSendDisabled(true);
      } else if (command === 'sessionStarted') {
        setMessages(prev => [
          ...prev,
          { id: prev.length + 1, role: 'system', content: data.message, timestamp: new Date() }
        ]);
        setSendDisabled(false);
        setTimeout(() => inputRef.current?.focus(), 0);
      } else if (command === 'chatResponse') {
        setIsThinking(false);
        setMessages(prev => [
          ...prev,
          { id: prev.length + 1, role: 'system', content: data.message, timestamp: new Date() }
        ]);
        setSendDisabled(false);
        setTimeout(() => inputRef.current?.focus(), 0);
      } else if (command === 'chatError') {
        setMessages(prev => [...prev, { id: 1, role: 'system', content: error, timestamp: new Date() }]);
        setSelectable(true);
      }
    });

    return () => window.removeEventListener('message', () => {});
  }, []);

  const handleSend = async (content: string) => {
    if (!content) return;
    setQuery('');
    setSendDisabled(true);
    setIsThinking(true);
    setMessages(prev => [...prev, { id: prev.length + 1, role: 'user', content: content, timestamp: new Date() }]);
    if (vscode) {
      vscode.postMessage({ command: 'sendChatMessage', text: content });
    } else {
      console.error('vscode API not available.');
    }
  };

  const handleEndSession = () => {
    setQuery('');
    setSendDisabled(true);
    setCurrentAgent('Select an Agent to start session');
    setIsThinking(false);
    setSelectable(true);
    setMessages([]);
    if (vscode) {
      vscode.postMessage({ command: 'endSession', data: messages });
    } else {
      console.warn('vscode API not available');
    }
  };

  const handleAgentSelect = (agent: { Id: string; MasterLabel: string }) => {
    if (vscode) {
      vscode.postMessage({ command: 'startSession', data: agent.Id });
    }
  };

  return (
    <div className="app-container">
      <Navbar
        agents={agents}
        currentAgent={currentAgent}
        selectable={selectable}
        setCurrentAgent={setCurrentAgent}
        onAgentSelect={handleAgentSelect}
        onEndSession={handleEndSession}
      />
      <MainContainer className="chat-container">
        <ChatContainer className="chat-container">
          <MessageList
            className="message-list"
            typingIndicator={isThinking ? <TypingIndicator content="Thinking..." /> : null}
          >
            {messages.map((msg: Message) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                {msg.role === 'system' && <Avatar size="md" color="blue" src={salesforceLogo} />}
                <Message
                  key={msg.id}
                  model={{
                    message: msg.content,
                    sender: msg.role,
                    direction: msg.role === 'system' ? 'incoming' : 'outgoing',
                    position: 'normal'
                  }}
                />
              </div>
            ))}
          </MessageList>
          <MessageInput
            ref={inputRef}
            value={query}
            placeholder="Start typing..."
            onChange={setQuery}
            disabled={sendDisabled}
            onSend={handleSend}
            attachButton={false}
          />
        </ChatContainer>
      </MainContainer>
    </div>
  );
};

export default App;
