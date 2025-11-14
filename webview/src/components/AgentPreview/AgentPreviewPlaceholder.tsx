import React from 'react';
import './AgentPreviewPlaceholder.css';

interface AgentPreviewPlaceholderProps {
  onStartSession?: () => void;
  isLiveMode?: boolean;
}

const AgentPreviewPlaceholder: React.FC<AgentPreviewPlaceholderProps> = ({
  onStartSession,
  isLiveMode = false
}) => {
  // Determine button text based on mode
  const getButtonText = () => {
    return isLiveMode ? 'Start Live Test' : 'Start Simulation';
  };

  // Play icon SVG (for Start Simulation / Start Live Test)
  const playIcon = (
    <svg width="10" height="10" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0.6 0L7.36 4.52V5.16L0.6 9.64L0 9.32V0.32L0.6 0ZM0.76 8.64L6.48 4.84L0.76 1.04V8.64Z"
        fill="currentColor"
      />
    </svg>
  );

  return (
    <div className="agent-preview-placeholder">
      <div className="agent-preview-placeholder-icon"></div>
      <p>
        Agent Preview lets you test an agent in a simulated or live environment, so you can see how it responds to user messages.
      </p>
      {onStartSession && (
        <button className="start-session-button" onClick={onStartSession}>
          <span className="button-icon">{playIcon}</span>
          <span>{getButtonText()}</span>
        </button>
      )}
    </div>
  );
};

export default AgentPreviewPlaceholder;
