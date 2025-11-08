import React, { useState, useEffect } from 'react';
import { vscodeApi, AgentInfo } from '../../services/vscodeApi.js';
import { Toggle } from '../shared/Toggle.js';
import { Button } from '../shared/Button.js';
import './AgentSelector.css';

interface AgentSelectorProps {
  onClientAppRequired?: (data: any) => void;
  onClientAppSelection?: (data: any) => void;
  selectedAgent: string;
  onAgentChange: (agentId: string) => void;
  isSessionActive?: boolean;
}

const AgentSelector: React.FC<AgentSelectorProps> = ({
  onClientAppRequired,
  onClientAppSelection,
  selectedAgent,
  onAgentChange,
  isSessionActive = false
}) => {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);

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

  const handleModeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsLiveMode(checked);
    // TODO: Implement mode change logic (e.g., notify extension)
    console.log(`Agent mode changed to: ${checked ? 'Live Test' : 'Simulate'}`);
  };

  const handleDebugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsDebugMode(checked);
    // TODO: Implement debug mode change logic (e.g., notify extension)
    console.log(`Debug mode changed to: ${checked ? 'On' : 'Off'}`);
  };

  const handleStartClick = () => {
    if (!selectedAgent) {
      return;
    }

    if (isSessionActive) {
      // Stop the active session
      vscodeApi.endSession();
    } else {
      // Start session with the selected agent
      vscodeApi.startSession(selectedAgent);
    }
  };

  return (
    <div className="agent-selector">
      <div className="agent-selector__main">
        <select
          className={`agent-select ${selectedAgent ? 'has-selection' : ''}`}
          value={selectedAgent}
          onChange={handleAgentChange}
          disabled={isLoading}
        >
          <option value="">
            {isLoading ? 'Loading...' : agents.length === 0 ? 'No agents available' : 'Select an agent...'}
          </option>
          {publishedAgents.length > 0 && (
            <optgroup label="Published">
              {publishedAgents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </optgroup>
          )}
          {scriptAgents.length > 0 && (
            <optgroup label="Agent Script">
              {scriptAgents.map(agent => (
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
      <div className="agent-selector__toggles">
        <Toggle
          label="Debug mode"
          checked={isDebugMode}
          onChange={handleDebugChange}
          size="small"
          disabled={!selectedAgent || isLoading}
        />
        <Toggle
          leftLabel="Simulate"
          rightLabel="Live Test"
          checked={isLiveMode}
          onChange={handleModeChange}
          size="small"
          disabled={!selectedAgent || isLoading}
        />
      </div>
      <Button
        appearance="primary"
        size="small"
        onClick={handleStartClick}
        className="agent-selector__start-button"
        disabled={!selectedAgent || isLoading}
        startIcon={
          isSessionActive ? (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.805 3.74H6.805V6.74H3.805V3.74ZM5.725 0.02C6.31167 0.0466666 6.87167 0.193333 7.405 0.46C7.965 0.726666 8.45833 1.07333 8.885 1.5C9.89833 2.59333 10.405 3.87333 10.405 5.34C10.405 6.48667 10.005 7.58 9.205 8.62C8.805 9.1 8.35167 9.5 7.845 9.82C7.33833 10.1133 6.79167 10.3133 6.205 10.42C4.925 10.66 3.765 10.4867 2.725 9.9C2.19167 9.60667 1.725 9.23333 1.325 8.78C0.925 8.32667 0.618333 7.82 0.405 7.26C0.191667 6.7 0.0583333 6.11333 0.005 5.5C-0.0216667 4.88667 0.0583333 4.3 0.245 3.74C0.645 2.51333 1.35167 1.56667 2.365 0.9C2.845 0.58 3.365 0.34 3.925 0.18C4.51167 0.02 5.11167 -0.0333333 5.725 0.02ZM6.125 9.7C7.13833 9.46 7.97833 8.92667 8.645 8.1C9.31167 7.19333 9.61833 6.24667 9.565 5.26C9.565 4.64667 9.445 4.06 9.205 3.5C8.99167 2.94 8.685 2.44667 8.285 2.02C7.51167 1.24667 6.61833 0.82 5.605 0.74C5.09833 0.713333 4.59167 0.766667 4.085 0.9C3.57833 1.00667 3.125 1.20667 2.725 1.5C1.87167 2.14 1.285 2.98 0.965 4.02C0.671667 5.06 0.738333 6.06 1.165 7.02C1.61833 7.98 2.29833 8.71333 3.205 9.22C3.63167 9.48667 4.09833 9.66 4.605 9.74C5.11167 9.82 5.61833 9.80667 6.125 9.7Z" fill="currentColor"/>
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.725 0.02C6.31167 0.0466666 6.87167 0.193333 7.405 0.46C7.965 0.726666 8.45833 1.07333 8.885 1.5C9.89833 2.59333 10.405 3.87333 10.405 5.34C10.405 6.48667 10.005 7.58 9.205 8.62C8.805 9.1 8.35167 9.5 7.845 9.82C7.33833 10.1133 6.79167 10.3133 6.205 10.42C4.925 10.66 3.765 10.4867 2.725 9.9C2.19167 9.60667 1.725 9.23333 1.325 8.78C0.925 8.32667 0.618333 7.82 0.405 7.26C0.191667 6.7 0.0583333 6.11333 0.005 5.5C-0.0216667 4.88667 0.0583333 4.3 0.245 3.74C0.645 2.51333 1.35167 1.56667 2.365 0.9C2.845 0.58 3.365 0.34 3.925 0.18C4.51167 0.02 5.11167 -0.0333333 5.725 0.02ZM6.125 9.7C7.13833 9.46 7.97833 8.92667 8.645 8.1C9.31167 7.19333 9.61833 6.24667 9.565 5.26C9.565 4.64667 9.445 4.06 9.205 3.5C8.99167 2.94 8.685 2.44667 8.285 2.02C7.51167 1.24667 6.61833 0.82 5.605 0.74C5.09833 0.713333 4.59167 0.766667 4.085 0.9C3.57833 1.00667 3.125 1.20667 2.725 1.5C1.87167 2.14 1.285 2.98 0.965 4.02C0.671667 5.06 0.738333 6.06 1.165 7.02C1.61833 7.98 2.29833 8.71333 3.205 9.22C3.63167 9.48667 4.09833 9.66 4.605 9.74C5.11167 9.82 5.61833 9.80667 6.125 9.7ZM3.805 3.02L4.365 2.7L7.725 4.94V5.58L4.365 7.82L3.805 7.5V3.02ZM4.525 3.7V6.82L6.845 5.26L4.525 3.7Z" fill="currentColor"/>
            </svg>
          )
        }
      >
        {isSessionActive ? 'Stop Preview' : 'Start Preview'}
      </Button>
    </div>
  );
};

export default AgentSelector;
