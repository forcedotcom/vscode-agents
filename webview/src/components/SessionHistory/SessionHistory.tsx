import React, { useEffect, useState } from 'react';
import { vscodeApi, AgentInfo, AgentSource, SessionListEntry } from '../../services/vscodeApi.js';
import { Button } from '../shared/Button.js';
import { SplitButton } from '../shared/SplitButton.js';
import './SessionHistory.css';

interface SessionHistoryProps {
  agentId: string;
  agentSource?: AgentSource;
  isActive: boolean;
  isSessionActive?: boolean;
  isLiveMode: boolean;
  selectedAgentInfo?: AgentInfo | null;
  onResume: (sessionId: string) => void;
  onGoToPreview?: () => void;
  onLiveModeChange?: (isLive: boolean) => void;
}

const SESSION_TYPE_LABELS: Record<NonNullable<SessionListEntry['sessionType']>, string> = {
  simulated: 'Simulation',
  live: 'Live Test',
  published: 'Live Test'
};

const formatTimestamp = (timestamp?: string): string => {
  if (!timestamp) {
    return '';
  }
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return timestamp;
    }
    const now = new Date();
    const sameYear = date.getFullYear() === now.getFullYear();
    const datePart = date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: '2-digit' })
    });
    const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${datePart}, ${timePart}`;
  } catch {
    return timestamp;
  }
};

const playIcon = (
  <svg width="10" height="10" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M0.6 0L7.36 4.52V5.16L0.6 9.64L0 9.32V0.32L0.6 0ZM0.76 8.64L6.48 4.84L0.76 1.04V8.64Z"
      fill="currentColor"
    />
  </svg>
);

const sendIcon = (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3.01333 3.92L3.76 3.49333L16.9867 9.46667V10.3733L3.76 16.3467L3.01333 15.92L4.56 10L3.01333 3.92ZM5.62667 10.48L4.34667 15.12L15.4933 9.89333L4.34667 4.82667L5.62667 9.41333L11.0133 9.52V10.48H5.62667Z"
      fill="currentColor"
    />
  </svg>
);

const SessionHistory: React.FC<SessionHistoryProps> = ({
  agentId,
  agentSource,
  isActive,
  isSessionActive = false,
  isLiveMode,
  selectedAgentInfo = null,
  onResume,
  onGoToPreview,
  onLiveModeChange
}) => {
  const [sessions, setSessions] = useState<SessionListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAgentId, setCurrentAgentId] = useState(agentId);

  useEffect(() => {
    const dispose = vscodeApi.onMessage('sessionList', (data: { agentId: string; sessions: SessionListEntry[] }) => {
      setIsLoading(false);
      if (data?.agentId === currentAgentId) {
        setSessions(data.sessions || []);
      }
    });
    return dispose;
  }, [currentAgentId]);

  useEffect(() => {
    if (!isActive || !agentId) {
      return;
    }
    setCurrentAgentId(agentId);
    setIsLoading(true);
    setSessions([]);
    vscodeApi.listSessions(agentId, agentSource);
  }, [isActive, agentId, agentSource]);

  const handleResume = (session: SessionListEntry) => {
    if (!agentId) {
      return;
    }
    // Sync the Start button mode to the previewed session's type so clicking
    // Start resumes in the same mode the session ran in originally.
    if (onLiveModeChange && session.sessionType) {
      const wasLive = session.sessionType === 'live' || session.sessionType === 'published';
      if (wasLive !== isLiveMode) {
        onLiveModeChange(wasLive);
      }
    }
    vscodeApi.previewSession(agentId, session.sessionId, { agentSource, sessionType: session.sessionType });
    onResume(session.sessionId);
  };

  const renderPlaceholder = (message: string, showButton: boolean) => {
    const isPublishedAgent = selectedAgentInfo?.type === AgentSource.PUBLISHED;
    const buttonText = isSessionActive ? 'Send a message' : isLiveMode ? 'Start Live Test' : 'Start Simulation';
    const handleModeSelect = (value: string) => {
      onLiveModeChange?.(value === 'live');
    };

    return (
      <div className="session-history-placeholder">
        <div className="session-history-placeholder-icon"></div>
        <p>{message}</p>
        {showButton &&
          onGoToPreview &&
          (isSessionActive ? (
            <Button
              appearance="primary"
              size="small"
              onClick={onGoToPreview}
              startIcon={sendIcon}
              className="session-history-send-icon"
            >
              Send a message
            </Button>
          ) : isPublishedAgent ? (
            <Button appearance="primary" size="small" onClick={onGoToPreview} startIcon={playIcon}>
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
              {buttonText}
            </SplitButton>
          ))}
      </div>
    );
  };

  if (!agentId) {
    return renderPlaceholder('Select an agent to see its previous sessions here.', false);
  }

  if (isLoading) {
    return renderPlaceholder('Loading sessions...', false);
  }

  if (sessions.length === 0) {
    return renderPlaceholder(
      'History lists your prior conversations with this agent so you can pick one back up where you left off without losing context.',
      true
    );
  }

  return (
    <ul className="session-history-list">
      {sessions.map(session => {
        const label = session.firstUserMessage?.trim() || '(No messages sent)';
        return (
          <li key={session.sessionId} className="session-history-item">
            <button
              type="button"
              className="session-history-item-button"
              onClick={() => handleResume(session)}
              title={`${label} — ${formatTimestamp(session.timestamp)}`}
            >
              {session.sessionType && (
                <span className={`session-history-item-type session-history-item-type-${session.sessionType}`}>
                  {SESSION_TYPE_LABELS[session.sessionType]}
                </span>
              )}
              <span className="session-history-item-message">{label}</span>
              <span className="session-history-item-timestamp">{formatTimestamp(session.timestamp)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default SessionHistory;
