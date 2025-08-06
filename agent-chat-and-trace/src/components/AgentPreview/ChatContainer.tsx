import React from 'react';
import ChatMessage from './ChatMessage';
import SystemMessage from './SystemMessage';
import './ChatContainer.css';

interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  systemType?: 'session' | 'debug';
  timestamp?: string;
}

interface ChatContainerProps {
  messages: Message[];
  isLoading?: boolean;
}

const ChatContainer: React.FC<ChatContainerProps> = ({ messages, isLoading }) => {
  return (
    <div className="chat-container">
      {messages.map((message) => (
        message.type === 'system' ? (
          <SystemMessage
            key={message.id}
            content={message.content}
            type={message.systemType}
          />
        ) : (
          <ChatMessage
            key={message.id}
            type={message.type}
            content={message.content}
          />
        )
      ))}
      {isLoading && (
        <div className="chat-loading">
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatContainer;