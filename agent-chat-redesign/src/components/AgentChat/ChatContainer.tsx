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
}

const ChatContainer: React.FC<ChatContainerProps> = ({ messages }) => {
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
    </div>
  );
};

export default ChatContainer;