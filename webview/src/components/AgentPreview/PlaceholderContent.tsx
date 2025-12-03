import React from 'react';
import { vscodeApi } from '../../services/vscodeApi.js';
import { Button } from '../shared/Button.js';
import './PlaceholderContent.css';

const PlaceholderContent: React.FC = () => {
  const handleSelectAgent = () => {
    // Open the agent picker to select and start an agent
    vscodeApi.executeCommand('sf.agent.selectAndRun');
  };

  return (
    <div className="placeholder-content">
      <div className="placeholder-icon"></div>
      <p>Agentforce DX provides a suite of tools to iteratively build, preview, and test agents right in your IDE.</p>
      <Button appearance="primary" size="small" onClick={handleSelectAgent}>
        Select Agent
      </Button>
    </div>
  );
};

export default PlaceholderContent;
