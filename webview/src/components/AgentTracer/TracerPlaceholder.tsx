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

  return (
    <div className="tracer-placeholder">
      <div className="tracer-placeholder-icon"></div>
      <p>Agent Tracer displays the step-by-step actions an AI agent takes, so you can understand what it does in detail.</p>
      {onGoToPreview && (
        <button className="send-message-button" onClick={onGoToPreview}>
          {getButtonText()}
        </button>
      )}
    </div>
  );
};

export default TracerPlaceholder;
