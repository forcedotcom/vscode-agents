import React from 'react';
import './SystemMessage.css';

interface SystemMessageProps {
  content: string;
  type?: 'session' | 'debug' | 'error' | 'warning';
  details?: string;
}

const SystemMessage: React.FC<SystemMessageProps> = ({ content, type = 'session', details }) => {
  // For error and warning messages, use plain text to avoid issues with special characters
  // Only use dangerouslySetInnerHTML for session/debug messages that may contain formatted content
  if (type === 'error' || type === 'warning') {
    return (
      <div className={`system-message ${type}`}>
        {content}
        {details && <div className="system-message-details">{details}</div>}
      </div>
    );
  }
  return <div className={`system-message ${type}`} dangerouslySetInnerHTML={{ __html: content }} />;
};

export default SystemMessage;
