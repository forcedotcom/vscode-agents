import React from 'react';
import { vscodeApi } from '../../services/vscodeApi.js';
import { Button } from '../shared/Button.js';
import './PlaceholderContent.css';

interface PlaceholderContentProps {
  hasAgents?: boolean;
  isLoadingAgents?: boolean;
}

const CREATE_AI_AUTHORING_BUNDLE_COMMAND = 'salesforcedx-vscode-agents.createAiAuthoringBundle';

const PlaceholderContent: React.FC<PlaceholderContentProps> = ({ hasAgents = false, isLoadingAgents = true }) => {
  const handleSelectAgent = () => {
    // Open the agent picker to select and start an agent
    vscodeApi.executeCommand('sf.agent.selectAndRun');
  };

  const handleCreateAgent = () => {
    // Prompts for agent name and uses ScriptAgent.createAuthoringBundle
    vscodeApi.executeCommand(CREATE_AI_AUTHORING_BUNDLE_COMMAND);
  };

  const showSelectButton = !isLoadingAgents && hasAgents;

  return (
    <div className="placeholder-content">
      <div className="placeholder-icon"></div>
      <p>Agentforce DX provides a suite of tools to iteratively build, preview, and test agents right in your IDE.</p>
      <div className="placeholder-buttons">
        {showSelectButton ? (
          <>
            <Button appearance="secondary" size="small" onClick={handleCreateAgent}>
              Create Agent
            </Button>
            <Button appearance="primary" size="small" onClick={handleSelectAgent}>
              Select Agent
            </Button>
          </>
        ) : (
          <Button appearance="primary" size="small" onClick={handleCreateAgent}>
            Create Agent
          </Button>
        )}
      </div>
    </div>
  );
};

export default PlaceholderContent;
