import React from 'react';
import ChatMessage from './ChatMessage';
import SystemMessage from './SystemMessage';
import './ChatContainer.css';

interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  systemType?: 'session' | 'debug';
}

interface ChatContainerProps {
  messages: Message[];
  isThinking?: boolean;
}

const ChatContainer: React.FC<ChatContainerProps> = ({ messages, isThinking }) => {
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
      {isThinking && (
        <div className="thinking-indicator">
          <ChatMessage
            type="agent"
            content="Thinking..."
          />
        </div>
      )}
    </div>
  );
};

export default ChatContainer;