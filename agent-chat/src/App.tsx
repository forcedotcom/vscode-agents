import React, { useRef, useState } from 'react';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  Avatar,
  TypingIndicator
} from '@chatscope/chat-ui-kit-react';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
// import { AgentPreview } from '@salesforce/agents';
// import fs from 'fs';
// import path from 'path';
// import { tmpdir } from 'os';
import salesforceLogo from './assets/salesforce.png';
import './index.css';
interface Message {
  id: number;
  timestamp: Date;
  role: 'system' | 'user';
  content: string;
}
const initialComment: Message = {
  content: `Hi, I'm an AI service assistant. How can I help you?`,
  role: 'system',
  id: 1,
  timestamp: new Date()
};

const App: React.FC = () => {
  // Inside your component
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [sendDisabled, setSendDisabled] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([initialComment]);
  // const vscode = window.acquireVsCodeApi();

  // const sendMessage = (message: string) => {
  //   vscode.postMessage({ type: 'NEW_PROMPT', payload: message });
  // };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const handleSend = async (content: string) => {
    if (!content) return;
    setQuery('');
    setSendDisabled(true);
    setIsThinking(true);
    setMessages(prev => [...prev, { id: prev.length + 1, role: 'user', content: content, timestamp: new Date() }]);
    await sleep(1500);

    setIsThinking(false);
    setMessages(prev => {
      const lastComment = prev[prev.length - 1];
      // TODO - use agents library for generations
      return (Math.random() * 2) % 2 > 1
        ? [
            ...prev,
            {
              id: prev.length + 1,
              role: 'system',
              content: "I'm sorry, I can't help with this request",
              timestamp: new Date()
            }
          ]
        : [
            ...prev,
            { ...lastComment, id: prev.length + 1, role: 'system', content: 'We have a scuba class at 9:30 AM' }
          ];
    });
    // sendMessage(content);
    setSendDisabled(false);
    // Ensure the input regains focus
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <MainContainer className="chat-wrapper">
      <ChatContainer className="chat-container">
        <MessageList
          className="message-list"
          typingIndicator={isThinking ? <TypingIndicator content="Thinking..." /> : null}
        >
          {messages.map(msg => (
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
  );
};

export default App;
