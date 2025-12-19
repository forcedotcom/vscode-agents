import React, { useState, useEffect } from 'react';
import { vscodeApi, AgentInfo } from '../../services/vscodeApi.js';
import { SplitButton } from '../shared/SplitButton.js';
import { Button } from '../shared/Button.js';
import './AgentSelector.css';

interface AgentSelectorProps {
  selectedAgent: string;
  onAgentChange: (agentId: string) => void;
  isSessionActive?: boolean;
  isSessionStarting?: boolean;
  onLiveModeChange?: (isLive: boolean) => void;
  initialLiveMode?: boolean;
  onSelectedAgentInfoChange?: (agentInfo: AgentInfo | null) => void;
}

export interface StartClickParams {
  selectedAgent: string;
  isSessionActive: boolean;
  isSessionStarting: boolean;
  isLiveMode: boolean;
  endSession: () => unknown;
  startSession: (agentId: string, options: { isLiveMode: boolean }) => unknown;
}

export const handleStartClickImpl = ({
  selectedAgent,
  isSessionActive,
  isSessionStarting,
  isLiveMode,
  endSession,
  startSession
}: StartClickParams) => {
  if (!selectedAgent) {
    return;
  }

  if (isSessionActive || isSessionStarting) {
    endSession();
  } else {
    startSession(selectedAgent, {
      isLiveMode
    });
  }
};

const AgentSelector: React.FC<AgentSelectorProps> = ({
  selectedAgent,
  onAgentChange,
  isSessionActive = false,
  isSessionStarting = false,
  onLiveModeChange,
  initialLiveMode = false,
  onSelectedAgentInfoChange
}) => {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(initialLiveMode);
  const shouldShowStop = isSessionActive || isSessionStarting;
  const stopIcon = (
    <svg className="stop-icon" width="4" height="4" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.24 0L9 0.76V8.28L8.24 9H0.72L0 8.28V0.76L0.72 0H8.24ZM8.04 0.96H0.92V8.08H8.04V0.96Z"
        fill="currentColor"
      />
    </svg>
  );
  const playIcon = (
    <svg width="10" height="10" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0.6 0L7.36 4.52V5.16L0.6 9.64L0 9.32V0.32L0.6 0ZM0.76 8.64L6.48 4.84L0.76 1.04V8.64Z"
        fill="currentColor"
      />
    </svg>
  );

  // Track if we're syncing from parent to prevent circular updates
  const isSyncingRef = React.useRef(false);

  // Sync with parent's live mode when it changes
  useEffect(() => {
    isSyncingRef.current = true;
    setIsLiveMode(initialLiveMode);
    // Reset flag after state update
    setTimeout(() => {
      isSyncingRef.current = false;
    }, 0);
  }, [initialLiveMode]);

  // Notify parent component when live mode changes (but not during sync from parent)
  useEffect(() => {
    if (onLiveModeChange && !isSyncingRef.current) {
      onLiveModeChange(isLiveMode);
    }
  }, [isLiveMode, onLiveModeChange]);

  useEffect(() => {
    const disposeAvailableAgents = vscodeApi.onMessage(
      'availableAgents',
      (data: { agents: AgentInfo[]; selectedAgentId?: string } | AgentInfo[]) => {
        setIsLoading(false);
        if (Array.isArray(data)) {
          // Handle legacy format
          setAgents(data);
        } else {
          if (data.agents && data.agents.length > 0) {
            setAgents(data.agents);
            // If there's a selectedAgentId in the message, use it
            // Otherwise, if we already have a selectedAgent, try to keep it if it exists in the new list
            if (data.selectedAgentId) {
              const agentExists = data.agents.some(agent => agent.id === data.selectedAgentId);
              if (agentExists) {
                onAgentChange(data.selectedAgentId);
                vscodeApi.clearMessages();
                vscodeApi.loadAgentHistory(data.selectedAgentId);
              }
            } else if (selectedAgent) {
              // If we have a selected agent but it's not in the new list, clear the selection
              const agentExists = data.agents.some(agent => agent.id === selectedAgent);
              if (!agentExists) {
                onAgentChange('');
              }
            }
          } else {
            setAgents([]);
          }
        }
      }
    );

    const disposeRefreshAgents = vscodeApi.onMessage('refreshAgents', () => {
      setIsLoading(true);
      // Clear the current selection and messages
      onAgentChange('');
      vscodeApi.clearMessages();
      // Fetch the latest agents
      vscodeApi.getAvailableAgents();
    });

    // Request available agents
    vscodeApi.getAvailableAgents();

    return () => {
      disposeAvailableAgents();
      disposeRefreshAgents();
    };
  }, [onAgentChange, selectedAgent]);

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const agentId = e.target.value;
    onAgentChange(agentId);

    if (agentId && agentId !== '') {
      const selectedAgent = agents.find(agent => agent.id === agentId);

      if (selectedAgent?.type === 'published') {
        // Auto-enable live mode for published agents
        setIsLiveMode(true);
      }
      // For script agents, keep the current global live mode preference

      vscodeApi.clearMessages();
      vscodeApi.loadAgentHistory(agentId);
    } else {
      vscodeApi.clearMessages();
    }
  };

  // Group agents by type
  const publishedAgents = agents.filter(agent => agent.type === 'published');
  const scriptAgents = agents.filter(agent => agent.type === 'script');

  // Get the selected agent's details for custom display
  // This will update when agents list loads or selectedAgent changes
  const selectedAgentInfo = selectedAgent ? agents.find(agent => agent.id === selectedAgent) : undefined;
  const selectedAgentType =
    selectedAgentInfo?.type === 'script'
      ? 'Agent Script'
      : selectedAgentInfo?.type === 'published'
        ? 'Published'
        : null;

  // Notify parent of selected agent info changes
  useEffect(() => {
    if (onSelectedAgentInfoChange) {
      onSelectedAgentInfoChange(selectedAgentInfo || null);
    }
  }, [selectedAgentInfo, onSelectedAgentInfoChange]);

  const handleModeSelect = async (value: string) => {
    const isLive = value === 'live';
    const modeChanged = isLive !== isLiveMode;

    setIsLiveMode(isLive);

    // If session is active and mode changed, restart with new mode
    if (modeChanged && isSessionActive && selectedAgent) {
      await vscodeApi.endSession();
      // Wait a brief moment for the session to fully end
      await new Promise(resolve => setTimeout(resolve, 100));
      // Restart with new mode
      vscodeApi.startSession(selectedAgent, { isLiveMode: isLive });
    }
  };

  const handleStartClick = () =>
    handleStartClickImpl({
      selectedAgent,
      isSessionActive,
      isSessionStarting,
      isLiveMode,
      endSession: () => vscodeApi.endSession(),
      startSession: (agentId, options) => vscodeApi.startSession(agentId, options)
    });

  return (
    <div className="agent-selector">
      <div className="agent-selector__main">
        <select
          className={`agent-select ${selectedAgent ? 'has-selection' : ''}`}
          value={selectedAgent}
          onChange={handleAgentChange}
          disabled={isLoading || isSessionActive || isSessionStarting}
        >
          <option value="">
            {isLoading ? 'Loading...' : agents.length === 0 ? 'No agents available' : 'Select agent...'}
          </option>
          {scriptAgents.length > 0 && (
            <optgroup label="Agent Script">
              {scriptAgents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </optgroup>
          )}
          {publishedAgents.length > 0 && (
            <optgroup label="Published">
              {publishedAgents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {selectedAgentInfo && selectedAgentType && (
          <div className="agent-select-display">
            <span className="agent-name">{selectedAgentInfo.name}</span>
            <span className="agent-type">({selectedAgentType})</span>
          </div>
        )}
      </div>
      {selectedAgent &&
        (selectedAgentInfo?.type === 'published' ? (
          <Button
            appearance="primary"
            size="small"
            onClick={handleStartClick}
            className="agent-selector__start-button"
            disabled={isLoading}
            startIcon={shouldShowStop ? stopIcon : playIcon}
          >
            {shouldShowStop ? 'Stop Live Test' : 'Start Live Test'}
          </Button>
        ) : shouldShowStop ? (
          <Button
            appearance="primary"
            size="small"
            onClick={handleStartClick}
            className="agent-selector__start-button"
            disabled={isLoading}
            startIcon={stopIcon}
          >
            {isLiveMode ? 'Stop Live Test' : 'Stop Simulation'}
          </Button>
        ) : (
          <SplitButton
            appearance="primary"
            size="small"
            onClick={handleStartClick}
            onSelect={handleModeSelect}
            value={isLiveMode ? 'live' : 'simulate'}
            options={[
              { label: 'Simulation', value: 'simulate' },
              { label: 'Live Test', value: 'live' }
            ]}
            className="agent-selector__start-button"
            disabled={isLoading}
            startIcon={shouldShowStop ? stopIcon : playIcon}
          >
            {shouldShowStop
              ? isLiveMode
                ? 'Stop Live Test'
                : 'Stop Simulation'
              : isLiveMode
                ? 'Start Live Test'
                : 'Start Simulation'}
          </SplitButton>
        ))}
    </div>
  );
};

export default AgentSelector;
