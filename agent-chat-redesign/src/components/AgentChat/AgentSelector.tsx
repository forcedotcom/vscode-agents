import React from "react";
import "./AgentSelector.css";
import chevronIcon from "../../assets/chevron.svg";

const AgentSelector: React.FC = () => {
  return (
    <div className="agent-selector">
      <select className="agent-select">
        <option>Local Info Agent</option>
      </select>
      <img src={chevronIcon} alt="Chevron" className="chevron-icon" />
    </div>
  );
};

export default AgentSelector;
