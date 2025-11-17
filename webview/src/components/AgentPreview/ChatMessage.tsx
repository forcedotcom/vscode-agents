import React, { useState, useEffect } from 'react';
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
  const [isDark, setIsDark] = useState(() => {
    const classList = document.body.classList;
    return classList.contains('vscode-dark') ||
           (classList.contains('vscode-high-contrast') && !classList.contains('vscode-high-contrast-light'));
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const classList = document.body.classList;
      const newIsDark = classList.contains('vscode-dark') ||
                        (classList.contains('vscode-high-contrast') && !classList.contains('vscode-high-contrast-light'));
      setIsDark(newIsDark);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

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
