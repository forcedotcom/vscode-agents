import React from 'react';
import agentIconDark from '../../assets/agent-dark.svg';
import agentIconLight from '../../assets/agent-light.svg';
import './StepAgentResponse.css';

interface StepAgentResponseProps {
  response: string;
}

export const StepAgentResponse: React.FC<StepAgentResponseProps> = ({ response }) => {
  const isDark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');

  return (
    <div className="step-agent-response step-agent-response--response">
      <div className="step-agent-response-header">
        <div className="step-agent-response-title">
          <img src={isDark ? agentIconDark : agentIconLight} alt="Agent" className="step-agent-response-icon" />
          Agent Response
        </div>
      </div>
      <div className="step-agent-response-content">
        <p>{response}</p>
      </div>
    </div>
  );
};
