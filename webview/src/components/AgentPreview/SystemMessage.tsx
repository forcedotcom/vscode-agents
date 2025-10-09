import React from 'react';
import './SystemMessage.css';

interface SystemMessageProps {
  content: string;
  type?: 'session' | 'debug' | 'error';
}

const SystemMessage: React.FC<SystemMessageProps> = ({ content, type = 'session' }) => {
  return <div className={`system-message ${type}`} dangerouslySetInnerHTML={{ __html: content }} />;
};

export default SystemMessage;
