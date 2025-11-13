import React from 'react';
import './TracerPlaceholder.css';

interface TracerPlaceholderProps {
  onGoToPreview?: () => void;
  isSessionActive?: boolean;
  isLiveMode?: boolean;
}

const TracerPlaceholder: React.FC<TracerPlaceholderProps> = ({
  onGoToPreview,
  isSessionActive = false,
  isLiveMode = false
}) => {
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

  // Send icon SVG (for Send a Message)
  const sendIcon = (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3.01333 3.92L3.76 3.49333L16.9867 9.46667V10.3733L3.76 16.3467L3.01333 15.92L4.56 10L3.01333 3.92ZM5.62667 10.48L4.34667 15.12L15.4933 9.89333L4.34667 4.82667L5.62667 9.41333L11.0133 9.52V10.48H5.62667Z"
        fill="currentColor"
      />
    </svg>
  );

  return (
    <div className="tracer-placeholder">
      <div className="tracer-placeholder-icon"></div>
      <p>
        Agent Tracer displays the step-by-step actions an Agent takes, so you can understand what it does in detail.
      </p>
      {onGoToPreview && (
        <button className="send-message-button" onClick={onGoToPreview}>
          {isSessionActive ? (
            <span className="button-icon">{sendIcon}</span>
          ) : (
            <span className="button-icon">{playIcon}</span>
          )}
          <span>{getButtonText()}</span>
        </button>
      )}
    </div>
  );
};

export default TracerPlaceholder;
