import React, { useState, useEffect } from 'react';
import { vscodeApi, AgentInfo } from '../../services/vscodeApi.js';
import { SplitButton } from '../shared/SplitButton.js';
import './AgentSelector.css';

interface AgentSelectorProps {
  onClientAppRequired?: (data: any) => void;
  onClientAppSelection?: (data: any) => void;
  selectedAgent: string;
  onAgentChange: (agentId: string) => void;
  isSessionActive?: boolean;
  isSessionStarting?: boolean;
}

const AgentSelector: React.FC<AgentSelectorProps> = ({
  onClientAppRequired,
  onClientAppSelection,
  selectedAgent,
  onAgentChange,
  isSessionActive = false,
  isSessionStarting = false
}) => {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(false);
  // Store live mode preference per agent script
  const [agentModePreferences, setAgentModePreferences] = useState<Record<string, boolean>>({});

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
            if (data.selectedAgentId) {
              const agentExists = data.agents.some(agent => agent.id === data.selectedAgentId);
              if (agentExists) {
                onAgentChange(data.selectedAgentId);
                vscodeApi.clearMessages();
                vscodeApi.loadAgentHistory(data.selectedAgentId);
              }
            }
          } else {
            setAgents([]);
          }
        }
      }
    );

    const disposeClientAppRequired = vscodeApi.onMessage('clientAppRequired', data => {
      setIsLoading(false);
      onClientAppRequired?.(data);
    });

    const disposeSelectClientApp = vscodeApi.onMessage('selectClientApp', data => {
      setIsLoading(false);
      onClientAppSelection?.(data);
    });

    // Request available agents (this will trigger the client app checking)
    vscodeApi.getAvailableAgents();

    return () => {
      disposeAvailableAgents();
      disposeClientAppRequired();
      disposeSelectClientApp();
    };
  }, [onClientAppRequired, onClientAppSelection, onAgentChange]);

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const agentId = e.target.value;
    onAgentChange(agentId);

    if (agentId && agentId !== '') {
      const selectedAgent = agents.find(agent => agent.id === agentId);

      if (selectedAgent?.type === 'published') {
        // Auto-enable live mode for published agents
        setIsLiveMode(true);
      } else if (selectedAgent?.type === 'script') {
        // Restore saved preference for agent scripts, default to simulate (false)
        setIsLiveMode(agentModePreferences[agentId] ?? false);
      }

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
  const selectedAgentInfo = agents.find(agent => agent.id === selectedAgent);
  const selectedAgentType = selectedAgentInfo?.type === 'script' ? 'Agent Script' : selectedAgentInfo?.type === 'published' ? 'Published' : null;

  const handleModeSelect = (value: string) => {
    const isLive = value === 'live';
    setIsLiveMode(isLive);

    // Save preference for agent scripts
    if (selectedAgent && selectedAgentInfo?.type === 'script') {
      setAgentModePreferences(prev => ({
        ...prev,
        [selectedAgent]: isLive
      }));
    }
  };

  const handleStartClick = () => {
    if (!selectedAgent) {
      return;
    }

    if (isSessionActive) {
      // Stop the active session
      vscodeApi.endSession();
    } else {
      // Start session with the selected agent and current mode settings
      vscodeApi.startSession(selectedAgent, {
        isLiveMode
      });
    }
  };

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
            {isLoading ? 'Loading...' : agents.length === 0 ? 'No agents available' : 'Select an agent...'}
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
      <SplitButton
        appearance="primary"
        size="small"
        onClick={handleStartClick}
        onSelect={handleModeSelect}
        value={isLiveMode ? 'live' : 'simulate'}
        options={[
          { label: 'Simulation', value: 'simulate', disabled: selectedAgentInfo?.type === 'published' },
          { label: 'Live Test', value: 'live', disabled: selectedAgentInfo?.type === 'published' }
        ]}
        className="agent-selector__start-button"
        disabled={!selectedAgent || isLoading || isSessionStarting}
        startIcon={
          isSessionStarting ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="loading-spinner">
              <path d="M13.92 6.98667C13.7422 6.06222 13.3689 5.22667 12.8 4.48C12.2667 3.69778 11.5733 3.09333 10.72 2.66667C9.86667 2.24 8.96 2.02667 8 2.02667C7.04 2.02667 6.13333 2.24 5.28 2.66667C4.42667 3.09333 3.71556 3.69778 3.14667 4.48C2.61333 5.22667 2.25778 6.06222 2.08 6.98667H1.06667C1.24444 5.84889 1.65333 4.83556 2.29333 3.94667C2.96889 3.02222 3.80444 2.31111 4.8 1.81333C5.79556 1.28 6.86222 1.01333 8 1.01333C9.13778 1.01333 10.2044 1.28 11.2 1.81333C12.1956 2.31111 13.0133 3.02222 13.6533 3.94667C14.3289 4.83556 14.7556 5.84889 14.9333 6.98667H13.92Z" fill="currentColor"/>
            </svg>
          ) : isSessionActive ? (
            <svg width="10" height="10" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.24 0L9 0.76V8.28L8.24 9H0.72L0 8.28V0.76L0.72 0H8.24ZM8.04 0.96H0.92V8.08H8.04V0.96Z" fill="currentColor"/>
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 8 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0.6 0L7.36 4.52V5.16L0.6 9.64L0 9.32V0.32L0.6 0ZM0.76 8.64L6.48 4.84L0.76 1.04V8.64Z" fill="currentColor"/>
            </svg>
          )
        }
      >
        {isSessionStarting
          ? (isLiveMode ? 'Starting Live Test...' : 'Starting Simulation...')
          : isSessionActive
            ? (isLiveMode ? 'Stop Live Test' : 'Stop Simulation')
            : (isLiveMode ? 'Start Live Test' : 'Start Simulation')
        }
      </SplitButton>
    </div>
  );
};

export default AgentSelector;
