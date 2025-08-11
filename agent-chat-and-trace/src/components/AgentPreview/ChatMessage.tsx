import React from 'react';
import './ChatMessage.css';
import userIcon from '../../assets/user.svg';
import agentIcon from '../../assets/agent.svg';

interface ChatMessageProps {
  type: 'user' | 'agent';
  content: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ type, content }) => {
  return (
    <div className={`chat-message ${type}`}>
      <div className="message-icon">
        <img 
          src={type === 'user' ? userIcon : agentIcon} 
          alt={type === 'user' ? 'User' : 'Agent'} 
          className="icon-svg"
        />
      </div>
      <div className="message-content-wrapper">
        <div className="message-content">{content}</div>
      </div>
    </div>
  );
};

export default ChatMessage;