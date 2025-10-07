import React from 'react';
import chevronIconDark from '../../assets/chevron-dark.svg';
import chevronIconLight from '../../assets/chevron-light.svg';
import './SessionInfo.css';

interface SessionInfoProps {
  date: string;
  sessionId: string;
  isExpanded?: boolean;
  onToggle?: () => void;
  onToggleAll?: () => void;
  isAllExpanded?: boolean;
}

export const SessionInfo: React.FC<SessionInfoProps> = ({
  date,
  sessionId,
  isExpanded = false,
  onToggle,
  onToggleAll,
  isAllExpanded = true
}) => {
  const isDark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');

  return (
    <div className="session-info">
      <button className="session-info-header" onClick={onToggle}>
        <img src={isDark ? chevronIconDark : chevronIconLight} alt="Expand" className={`session-icon ${isExpanded ? 'expanded' : ''}`} />
        <span className="session-title">Session Details</span>
        {onToggleAll && (
          <button className="toggle-all-button" onClick={(e) => {
            e.stopPropagation();
            onToggleAll();
          }}>
            {isAllExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        )}
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
