import React, { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import SystemMessage from './SystemMessage';
import './ChatContainer.css';

interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  systemType?: 'session' | 'debug' | 'error';
  timestamp?: string;
}

interface ChatContainerProps {
  messages: Message[];
  isLoading?: boolean;
}

const ChatContainer: React.FC<ChatContainerProps> = ({ messages, isLoading }) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or when loading
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  return (
    <div className="chat-container">
      {messages.map(message =>
        message.type === 'system' ? (
          <SystemMessage key={message.id} content={message.content} type={message.systemType} />
        ) : (
          <ChatMessage key={message.id} type={message.type} content={message.content} />
        )
      )}
      {isLoading && (
        <div className="chat-loading">
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
      {/* Invisible element at the bottom for auto-scrolling */}
      <div ref={chatEndRef} />
    </div>
  );
};

export default ChatContainer;
