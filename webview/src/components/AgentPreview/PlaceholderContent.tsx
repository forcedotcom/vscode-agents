import React from 'react';
import { vscodeApi } from '../../services/vscodeApi.js';
import './PlaceholderContent.css';

const PlaceholderContent: React.FC = () => {
  const handleSelectAgent = () => {
    // Open the agent picker to select and start an agent
    vscodeApi.executeCommand('sf.agent.selectAndRun');
  };

  return (
    <div className="placeholder-content">
      <div className="placeholder-icon"></div>
      <p>Agentforce DX lets you build and test agents in your IDE, so you can iterate quickly before deployment.</p>
      <button className="select-agent-button" onClick={handleSelectAgent}>
        Select an Agent to Get Started
      </button>
    </div>
  );
};

export default PlaceholderContent;
