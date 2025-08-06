import React from 'react';
import './SystemMessage.css';

interface SystemMessageProps {
  content: string;
  type?: 'session' | 'debug';
}

const SystemMessage: React.FC<SystemMessageProps> = ({ content, type = 'session' }) => {
  return (
    <div className={`system-message ${type}`}>
      {content}
    </div>
  );
};

export default SystemMessage;