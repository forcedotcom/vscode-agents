import React, { useState, useEffect } from "react";
import { vscodeApi, AgentInfo } from "../../services/vscodeApi";
import "./AgentSelector.css";
import chevronIcon from "../../assets/chevron.svg";

interface AgentSelectorProps {
  onClientAppRequired?: (data: any) => void;
  onClientAppSelection?: (data: any) => void;
}

const AgentSelector: React.FC<AgentSelectorProps> = ({ 
  onClientAppRequired,
  onClientAppSelection 
}) => {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen for available agents from VS Code
    vscodeApi.onMessage('availableAgents', (data: AgentInfo[]) => {
      setIsLoading(false);
      if (data && data.length > 0) {
        setAgents(data);
        // Don't automatically select or start session - wait for user selection
      } else {
        setAgents([]);
      }
    });

    // Listen for client app required message (Case 1) - pass to parent
    vscodeApi.onMessage('clientAppRequired', (data) => {
      setIsLoading(false);
      if (onClientAppRequired) {
        onClientAppRequired(data);
      }
    });

    // Listen for client app selection required (Case 3) - pass to parent
    vscodeApi.onMessage('selectClientApp', (data) => {
      setIsLoading(false);
      if (onClientAppSelection) {
        onClientAppSelection(data);
      }
    });

    // Request available agents (this will trigger the client app checking)
    vscodeApi.getAvailableAgents();
  }, [onClientAppRequired, onClientAppSelection]);

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const agentId = e.target.value;
    setSelectedAgent(agentId);
    // Only start session if a valid agent is selected
    if (agentId && agentId !== "") {
      vscodeApi.startSession(agentId);
    }
  };

  return (
    <div className="agent-selector">
      <select 
        className="agent-select" 
        value={selectedAgent}
        onChange={handleAgentChange}
        disabled={isLoading}
      >
        <option value="">
          {isLoading ? "Loading..." : agents.length === 0 ? "No agents available" : "Select an agent..."}
        </option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
      <img src={chevronIcon} alt="Chevron" className="chevron-icon" />
    </div>
  );
};

export default AgentSelector;
