import React, { useState, useEffect } from 'react';
import { vscodeApi, AgentInfo } from '../../services/vscodeApi.js';
import './AgentSelector.css';

interface AgentSelectorProps {
  onClientAppRequired?: (data: any) => void;
  onClientAppSelection?: (data: any) => void;
  selectedAgent: string;
  onAgentChange: (agentId: string) => void;
}

const AgentSelector: React.FC<AgentSelectorProps> = ({
  onClientAppRequired,
  onClientAppSelection,
  selectedAgent,
  onAgentChange
}) => {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="agent-selector">
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
  );
};

export default AgentSelector;
