import React from 'react';
import './TracerPlaceholder.css';

interface TracerPlaceholderProps {
  onGoToPreview?: () => void;
}

const TracerPlaceholder: React.FC<TracerPlaceholderProps> = ({ onGoToPreview }) => {
  return (
    <div className="tracer-placeholder">
      <div className="tracer-placeholder-icon"></div>
      <p>Agent Tracer displays the step-by-step actions an AI agent takes, so you can understand what it does in detail.</p>
      {onGoToPreview && (
        <button className="send-message-button" onClick={onGoToPreview}>
          Send a message
        </button>
      )}
    </div>
  );
};

export default TracerPlaceholder;
