import React from 'react';
import agentIcon from '../../assets/agent.svg';
import './StepAgentResponse.css';

interface StepAgentResponseProps {
  response: string;
}

export const StepAgentResponse: React.FC<StepAgentResponseProps> = ({ 
  response
}) => {
  return (
    <div className="step-agent-response step-agent-response--response">
      <div className="step-agent-response-header">
        <div className="step-agent-response-title">
          <img src={agentIcon} alt="Agent" className="step-agent-response-icon" />
          Agent Response
        </div>
      </div>
      <div className="step-agent-response-content">
        <p>{response}</p>
      </div>
    </div>
  );
};