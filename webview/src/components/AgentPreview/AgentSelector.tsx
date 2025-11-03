import React, { useState, useEffect } from 'react';
import { vscodeApi, AgentInfo } from '../../services/vscodeApi';
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
    // Listen for available agents from VS Code
    const disposeAvailableAgents = vscodeApi.onMessage(
      'availableAgents',
      (data: { agents: AgentInfo[]; selectedAgentId?: string } | AgentInfo[]) => {
        setIsLoading(false);
        if (Array.isArray(data)) {
          // Handle legacy format
          if (data.length > 0) {
            setAgents(data);
          } else {
            setAgents([]);
          }
        } else {
          // Handle new format with selectedAgentId
          if (data.agents && data.agents.length > 0) {
            setAgents(data.agents);
            if (data.selectedAgentId) {
              const agentExists = data.agents.some(agent => agent.id === data.selectedAgentId);
              if (agentExists) {
                onAgentChange(data.selectedAgentId);
              }
            }
          } else {
            setAgents([]);
          }
        }
      }
    );

    // Listen for client app required message (Case 1) - pass to parent
    const disposeClientAppRequired = vscodeApi.onMessage('clientAppRequired', data => {
      setIsLoading(false);
      if (onClientAppRequired) {
        onClientAppRequired(data);
      }
    });

    // Listen for client app selection required (Case 3) - pass to parent
    const disposeSelectClientApp = vscodeApi.onMessage('selectClientApp', data => {
      setIsLoading(false);
      if (onClientAppSelection) {
        onClientAppSelection(data);
      }
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
  };

  return (
    <div className="agent-selector">
      <select className="agent-select" value={selectedAgent} onChange={handleAgentChange} disabled={isLoading}>
        <option value="">
          {isLoading ? 'Loading...' : agents.length === 0 ? 'No agents available' : 'Select an agent...'}
        </option>
        {agents.map(agent => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AgentSelector;
