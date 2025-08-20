import React from 'react';
import { SessionInfo } from './SessionInfo';
import { PlanInfo } from './PlanInfo';
import { StepUserMessage } from './StepUserMessage';
import { StepTopicSelection } from './StepTopicSelection';
import { StepTopic } from './StepTopic';
import { StepActionSelection } from './StepActionSelection';
import { StepAction } from './StepAction';
import { StepResponseValidation } from './StepResponseValidation';
import { StepAgentResponse } from './StepAgentResponse';
import './AgentTracer.css';

const AgentTracer: React.FC = () => {
  return (
    <div className="agent-tracer">
      <div className="tracer-content">
        <SessionInfo date="August 22, 2024 4:15PM" sessionId="123456" isExpanded={false} />

        <PlanInfo title='"What is the weather like at the resort on June 11th?"' planId="123456" isExpanded={false}>
          <div className="tracer-steps">
            <StepUserMessage message="What is the weather like at the resort on June 11th?" timing="0.75 sec" />
            <StepTopicSelection
              timing="1.10 sec"
              promptUsed={<p>System instructions and context for topic selection for resort weather inquiry...</p>}
              availableTopics={<p>Weather Service, Location Service, Travel Service, Calendar Service</p>}
              availableTopicsCount={4}
            />
            <StepAgentResponse response="I'd be happy to help you check the weather at the resort on June 11th. However, I need to know which resort you're referring to. Could you please specify the name and location of the resort?" />
          </div>
        </PlanInfo>

        <PlanInfo title={'"What\'s the weather like today?"'} planId="789012" isExpanded={true}>
          <div className="tracer-steps">
            <StepUserMessage message="What's the weather like today?" timing="0.90 sec" />

            <StepTopicSelection
              timing="1.20 sec"
              promptUsed={<p>System instructions and context for topic selection...</p>}
              availableTopics={<p>Weather Service, News Service, Calendar Service, Location Service</p>}
              availableTopicsCount={4}
            />

            <StepTopic
              topicName="Weather Service"
              description="The Weather Service monitors, forecasts, and reports real-time weather conditions and alerts. You can pass a location to be get the weather report."
              timing="1.15 sec"
              instructions={<p>Detailed instructions for using the Weather Service...</p>}
              instructionsCount={7}
              availableTopics={<p>Available weather-related topics and endpoints...</p>}
              availableTopicsCount={4}
            />

            <StepActionSelection timing="0.65 sec" promptUsed={<p>System instructions for action selection...</p>} />

            <StepAction
              actionName="Weather Location"
              description="Weather Location retrieves weather data for a specified geographic point based on provided coordinates."
              timing="1.20 sec"
              inputCode={`{
  "prompt": "What's the weather like today?",
  "args": "Location:NYC"
}`}
              outputCode={`{
  "response": "500 internal server error"
}`}
            />

            <StepResponseValidation
              timing="0.12 sec"
              validationCode={`{
  "prompt_response": "The weather could not be retrieved (the response was 500 internal server error). The weather service might not be working correctly."
}`}
            />

            <StepAgentResponse response="The weather could not be retrieved (the response was 500 internal server error). The weather service might not be working correctly." />
          </div>
        </PlanInfo>
      </div>
    </div>
  );
};

export default AgentTracer;
