import React from 'react';
import './ChatMessage.css';
import userIconDark from '../../assets/user-dark.svg';
import userIconLight from '../../assets/user-light.svg';
import agentIconDark from '../../assets/agent-dark.svg';
import agentIconLight from '../../assets/agent-light.svg';

interface ChatMessageProps {
  type: 'user' | 'agent';
  content: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ type, content }) => {
  const isDark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');

  const iconSrc = type === 'user'
    ? (isDark ? userIconDark : userIconLight)
    : (isDark ? agentIconDark : agentIconLight);

  return (
    <div className={`chat-message ${type}`}>
      <div className="message-icon">
        <img
          src={iconSrc}
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
