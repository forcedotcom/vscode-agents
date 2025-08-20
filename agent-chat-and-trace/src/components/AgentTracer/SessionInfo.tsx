import React, { useState } from 'react';
import chevronIcon from '../../assets/chevron.svg';
import './SessionInfo.css';

interface SessionInfoProps {
  date: string;
  sessionId: string;
  isExpanded?: boolean;
}

export const SessionInfo: React.FC<SessionInfoProps> = ({ date, sessionId, isExpanded: initialExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  return (
    <div className="session-info">
      <button className="session-info-header" onClick={() => setIsExpanded(!isExpanded)}>
        <img src={chevronIcon} alt="Expand" className={`session-icon ${isExpanded ? 'expanded' : ''}`} />
        <span className="session-title">Session Details</span>
      </button>
      {isExpanded && (
        <div className="session-info-content">
          <div className="session-date">{date}</div>
          <div className="session-id">Session ID: {sessionId}</div>
        </div>
      )}
    </div>
  );
};
