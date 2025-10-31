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
  const [previousAgent, setPreviousAgent] = useState('');

  useEffect(() => {
    // Listen for available agents from VS Code
    vscodeApi.onMessage('availableAgents', (data: { agents: AgentInfo[], selectedAgentId?: string } | AgentInfo[]) => {
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
            onAgentChange(data.selectedAgentId);
            // Load history for preselected agent (don't auto-start session)
            vscodeApi.loadAgentHistory(data.selectedAgentId);
          }
        } else {
          setAgents([]);
        }
      }
    });

    // Listen for client app required message (Case 1) - pass to parent
    vscodeApi.onMessage('clientAppRequired', data => {
      setIsLoading(false);
      if (onClientAppRequired) {
        onClientAppRequired(data);
      }
    });

    // Listen for client app selection required (Case 3) - pass to parent
    vscodeApi.onMessage('selectClientApp', data => {
      setIsLoading(false);
      if (onClientAppSelection) {
        onClientAppSelection(data);
      }
    });

    // Request available agents (this will trigger the client app checking)
    vscodeApi.getAvailableAgents();
  }, [onClientAppRequired, onClientAppSelection]);

  // Handle external agent selection (e.g., from command palette)
  useEffect(() => {
    const loadHistoryForSelectedAgent = async () => {
      // Load history when agent changes externally (not from dropdown)
      if (selectedAgent && selectedAgent !== '' && selectedAgent !== previousAgent && agents.length > 0) {
        // Check if this agent exists in the available agents list
        const agentExists = agents.some(agent => agent.id === selectedAgent);
        if (agentExists) {
          // End session if switching agents
          if (previousAgent && previousAgent !== '') {
            vscodeApi.endSession();
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          // Load history for the selected agent (don't auto-start session)
          // This will clear the panel and show the new agent's history
          vscodeApi.loadAgentHistory(selectedAgent);
          setPreviousAgent(selectedAgent);
        }
      }
    };

    loadHistoryForSelectedAgent();
  }, [selectedAgent, agents, previousAgent]);

  const handleAgentChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const agentId = e.target.value;
    
    // If switching to a different agent, end current session and clear
    if (selectedAgent && selectedAgent !== agentId) {
      vscodeApi.endSession();
      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    onAgentChange(agentId);
    setPreviousAgent(agentId);

    // Load history for the selected agent (don't auto-start session)
    // This will clear the panel and show the new agent's history
    if (agentId && agentId !== '') {
      vscodeApi.loadAgentHistory(agentId);
    } else {
      // If no agent selected, clear the panel
      vscodeApi.clearMessages();
    }
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
