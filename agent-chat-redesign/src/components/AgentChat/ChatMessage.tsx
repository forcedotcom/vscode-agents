import React from 'react';
import './ChatMessage.css';
import userIcon from '../../assets/user.svg';
import agentIcon from '../../assets/agent.svg';
import thumbsUpIcon from '../../assets/thumbs-up.svg';
import thumbsDownIcon from '../../assets/thumbs-down.svg';
import copyIcon from '../../assets/copy.svg';

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
        {type === 'agent' && (
          <div className="message-actions">
            <button className="action-button" title="Thumbs up">
              <img src={thumbsUpIcon} alt="Thumbs up" className="action-icon" />
            </button>
            <button className="action-button" title="Thumbs down">
              <img src={thumbsDownIcon} alt="Thumbs down" className="action-icon" />
            </button>
            <button className="action-button" title="Copy">
              <img src={copyIcon} alt="Copy" className="action-icon" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;