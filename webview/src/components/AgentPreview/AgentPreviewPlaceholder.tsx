import React from 'react';
import { AgentInfo, AgentSource } from '../../services/vscodeApi.js';
import { SplitButton } from '../shared/SplitButton.js';
import { Button } from '../shared/Button.js';
import './AgentPreviewPlaceholder.css';

interface AgentPreviewPlaceholderProps {
  onStartSession?: () => void;
  isLiveMode?: boolean;
  selectedAgentInfo?: AgentInfo | null;
  onModeChange?: (isLive: boolean) => void;
}

const AgentPreviewPlaceholder: React.FC<AgentPreviewPlaceholderProps> = ({
  onStartSession,
  isLiveMode = false,
  selectedAgentInfo = null,
  onModeChange
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

  const handleModeSelect = (value: string) => {
    const isLive = value === 'live';
    if (onModeChange) {
      onModeChange(isLive);
    }
  };

  const isPublishedAgent = selectedAgentInfo?.type === AgentSource.PUBLISHED;

  return (
    <div className="agent-preview-placeholder">
      <div className="agent-preview-placeholder-icon"></div>
      <p>
        Agent Preview lets you test an agent by having a conversation, so you can see how it responds to user messages.
      </p>
      {onStartSession &&
        (isPublishedAgent ? (
          <Button appearance="primary" size="small" onClick={onStartSession} startIcon={playIcon}>
            Start Live Test
          </Button>
        ) : (
          <SplitButton
            appearance="primary"
            size="small"
            onClick={onStartSession}
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

export default AgentPreviewPlaceholder;
