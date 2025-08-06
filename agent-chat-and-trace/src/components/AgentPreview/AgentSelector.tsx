import React, { useState, useEffect } from "react";
import { vscodeApi, AgentInfo } from "../../services/vscodeApi";
import "./AgentSelector.css";
import chevronIcon from "../../assets/chevron.svg";

const AgentSelector: React.FC = () => {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  useEffect(() => {
    // Listen for available agents from VS Code
    vscodeApi.onMessage('availableAgents', (data: AgentInfo[]) => {
      if (data && data.length > 0) {
        setAgents(data);
        // Don't automatically select or start session - wait for user selection
      }
    });

    // Request available agents
    vscodeApi.getAvailableAgents();
  }, []);

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
      >
        <option value="">Select an agent...</option>
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
