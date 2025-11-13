import React from 'react';
import './TracerPlaceholder.css';

interface TracerPlaceholderProps {
  onGoToPreview?: () => void;
  isSessionActive?: boolean;
  isLiveMode?: boolean;
}

const TracerPlaceholder: React.FC<TracerPlaceholderProps> = ({ onGoToPreview, isSessionActive = false, isLiveMode = false }) => {
  // Determine button text based on session state and mode
  const getButtonText = () => {
    if (isSessionActive) {
      return 'Send a Message';
    }
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
    <div className="tracer-placeholder">
      <div className="tracer-placeholder-icon"></div>
      <p>Agent Tracer displays the step-by-step actions an AI agent takes, so you can understand what it does in detail.</p>
      {onGoToPreview && (
        <button className="send-message-button" onClick={onGoToPreview}>
          {isSessionActive ? (
            <span className="button-send-icon"></span>
          ) : (
            <span className="button-play-icon">{playIcon}</span>
          )}
          <span>{getButtonText()}</span>
        </button>
      )}
    </div>
  );
};

export default TracerPlaceholder;
