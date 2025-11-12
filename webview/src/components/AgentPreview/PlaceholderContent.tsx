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
      <p>Agent Preview lets you see what an agent can do before deploying it. Simulate conversations from your IDE.</p>
      <button className="select-agent-button" onClick={handleSelectAgent}>
        Select an Agent to Get Started
      </button>
    </div>
  );
};

export default PlaceholderContent;
