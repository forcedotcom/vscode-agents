import React from 'react';
import { vscodeApi } from '../../services/vscodeApi';
import './PlaceholderContent.css';

const PlaceholderContent: React.FC = () => {
  const handleSelectAgent = () => {
    // Trigger the same command as the play-circle icon
    vscodeApi.executeCommand('sf.agent.combined.view.run');
  };

  return (
    <div className="placeholder-content">
      <div className="placeholder-icon"></div>
      <p>Agent Preview lets you see what an agent can do before deploying it. Simulate conversations from your IDE.</p>
      <button className="select-agent-button" onClick={handleSelectAgent}>
        Select an Agent to get started
      </button>
    </div>
  );
};

export default PlaceholderContent;
