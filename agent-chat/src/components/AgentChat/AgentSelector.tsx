import React, { useState } from "react";
import "./AgentSelector.css";
import chevronIcon from "../../assets/chevron.svg";

interface AgentOption {
  Id: string;
  MasterLabel: string;
}

interface AgentSelectorProps {
  agents: AgentOption[];
  currentAgent: string;
  selectable: boolean;
  onAgentSelect: (agentId: string) => void;
  onEndSession: () => void;
}

const AgentSelector: React.FC<AgentSelectorProps> = ({
  agents,
  currentAgent,
  selectable,
  onAgentSelect,
  onEndSession
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleAgentSelect = (agentId: string) => {
    onAgentSelect(agentId);
    setIsDropdownOpen(false);
  };

  return (
    <div className="agent-selector">
      <div 
        className={`agent-select ${!selectable ? 'disabled' : ''}`}
        onClick={() => selectable && setIsDropdownOpen(!isDropdownOpen)}
      >
        <span className="agent-select-text">{currentAgent}</span>
        {selectable && <img src={chevronIcon} alt="Chevron" className="chevron-icon" />}
        {!selectable && (
          <button 
            className="end-session-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEndSession();
            }}
            title="End Session"
          >
            ✕
          </button>
        )}
      </div>
      
      {isDropdownOpen && selectable && (
        <div className="agent-dropdown">
          {agents.map((agent) => (
            <div 
              key={agent.Id}
              className="agent-option"
              onClick={() => handleAgentSelect(agent.Id)}
            >
              {agent.MasterLabel}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentSelector;
