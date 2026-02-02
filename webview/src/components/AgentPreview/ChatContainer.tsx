import React, { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage.js';
import SystemMessage from './SystemMessage.js';
import './ChatContainer.css';

interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  systemType?: 'session' | 'debug' | 'error' | 'warning';
  details?: string;
  timestamp?: string;
}

interface ChatContainerProps {
  messages: Message[];
  isLoading?: boolean;
  loadingMessage?: string;
}

const ChatContainer: React.FC<ChatContainerProps> = ({ messages, isLoading, loadingMessage = 'Loading...' }) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or when loading
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container?.scrollTo) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      return;
    }

    if (chatEndRef.current?.scrollIntoView) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  return (
    <div className="chat-container" ref={chatContainerRef}>
      {messages.map(message =>
        message.type === 'system' ? (
          <SystemMessage key={message.id} content={message.content} type={message.systemType} details={message.details} />
        ) : (
          <ChatMessage key={message.id} type={message.type} content={message.content} />
        )
      )}
      {isLoading && (
        <div className="chat-loading">
          <span className="loading-spinner"></span>
          <span className="loading-text">{loadingMessage}</span>
        </div>
      )}
      {/* Invisible element at the bottom for auto-scrolling */}
      <div ref={chatEndRef} />
    </div>
  );
};

export default ChatContainer;
