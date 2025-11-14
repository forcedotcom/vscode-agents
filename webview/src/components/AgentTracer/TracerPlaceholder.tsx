import React from 'react';
import { AgentInfo } from '../../services/vscodeApi.js';
import { SplitButton } from '../shared/SplitButton.js';
import { Button } from '../shared/Button.js';
import './TracerPlaceholder.css';

interface TracerPlaceholderProps {
  onGoToPreview?: () => void;
  isSessionActive?: boolean;
  isLiveMode?: boolean;
  selectedAgentInfo?: AgentInfo | null;
  onModeChange?: (isLive: boolean) => void;
}

const TracerPlaceholder: React.FC<TracerPlaceholderProps> = ({
  onGoToPreview,
  isSessionActive = false,
  isLiveMode = false,
  selectedAgentInfo = null,
  onModeChange
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

  const handleModeSelect = (value: string) => {
    const isLive = value === 'live';
    if (onModeChange) {
      onModeChange(isLive);
    }
  };

  const isPublishedAgent = selectedAgentInfo?.type === 'published';

  return (
    <div className="tracer-placeholder">
      <div className="tracer-placeholder-icon"></div>
      <p>
        Agent Tracer displays the step-by-step actions an Agent takes, so you can understand what it does in detail.
      </p>
      {onGoToPreview &&
        (isSessionActive ? (
          <Button
            appearance="primary"
            size="small"
            onClick={onGoToPreview}
            startIcon={sendIcon}
          >
            Send a Message
          </Button>
        ) : isPublishedAgent ? (
          <Button
            appearance="primary"
            size="small"
            onClick={onGoToPreview}
            startIcon={playIcon}
          >
            Start Live Test
          </Button>
        ) : (
          <SplitButton
            appearance="primary"
            size="small"
            onClick={onGoToPreview}
            onSelect={handleModeSelect}
            value={isLiveMode ? 'live' : 'simulate'}
            options={[
              { label: 'Simulation', value: 'simulate' },
              { label: 'Live Test', value: 'live' }
            ]}
            startIcon={playIcon}
          >
            {getButtonText()}
          </SplitButton>
        ))}
    </div>
  );
};

export default TracerPlaceholder;
