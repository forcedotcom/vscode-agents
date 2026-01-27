import React from 'react';
import { vscodeApi } from '../../services/vscodeApi.js';
import { Button } from '../shared/Button.js';
import './PlaceholderContent.css';

interface PlaceholderContentProps {
  hasAgents?: boolean;
  isLoadingAgents?: boolean;
}

const PlaceholderContent: React.FC<PlaceholderContentProps> = ({ hasAgents = false, isLoadingAgents = true }) => {
  const handleSelectAgent = () => {
    // Open the agent picker to select and start an agent
    vscodeApi.executeCommand('sf.agent.selectAndRun');
  };

  const showButton = !isLoadingAgents && hasAgents;

  return (
    <div className="placeholder-content">
      <div className="placeholder-icon"></div>
      <p>Agentforce DX provides a suite of tools to iteratively build, preview, and test agents right in your IDE.</p>
      {showButton ? (
        <Button appearance="primary" size="small" onClick={handleSelectAgent}>
          Select Agent
        </Button>
      ) : (
        !isLoadingAgents && (
          <p className="placeholder-hint">
            There are no agents available in your selected Org or Project. Create an agent first to get started.
          </p>
        )
      )}
    </div>
  );
};

export default PlaceholderContent;
