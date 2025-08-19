import React, { useState, useEffect } from "react";
import { SessionInfo } from "./SessionInfo";
import { PlanInfo } from "./PlanInfo";
import { StepUserMessage } from "./StepUserMessage";
import { StepTopicSelection } from "./StepTopicSelection";
import { StepTopic } from "./StepTopic";
import { StepActionSelection } from "./StepActionSelection";
import { StepAction } from "./StepAction";
import { StepResponseValidation } from "./StepResponseValidation";
import { StepAgentResponse } from "./StepAgentResponse";
import { TraceSelector } from "./TraceSelector";
import { vscodeApi } from "../../services/vscodeApi";
import "./AgentTracer.css";

interface TraceData {
  sessionId: string;
  date: string;
  plans: Array<{
    title: string;
    planId: string;
    steps: Array<{
      type: string;
      timing: string;
      data: any;
    }>;
  }>;
}

const AgentTracer: React.FC = () => {
  const [traceIds, setTraceIds] = useState<string[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [traceData, setTraceData] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Request available trace IDs when component mounts
    vscodeApi.getTraceIds();

    // Listen for trace IDs response
    vscodeApi.onMessage('traceIds', (data) => {
      setTraceIds(data.traceIds);
    });

    // Listen for trace data response
    vscodeApi.onMessage('traceData', (data) => {
      console.log('Received trace data:', data);
      console.log('Trace data structure:', {
        hasData: !!data,
        hasPlans: Array.isArray(data?.plans),
        plansCount: Array.isArray(data?.plans) ? data.plans.length : 0,
        firstPlan: data?.plans?.[0] ? {
          hasSteps: Array.isArray(data.plans[0].steps),
          stepsCount: Array.isArray(data.plans[0].steps) ? data.plans[0].steps.length : 0
        } : null
      });
      setTraceData(data);
      setLoading(false);
      setError(null);
    });

    // Listen for errors
    vscodeApi.onMessage('error', (data) => {
      setError(data.message);
      setLoading(false);
    });
  }, []);

  const handleTraceSelect = (traceId: string) => {
    setSelectedTraceId(traceId);
    setLoading(true);
    setError(null);
    vscodeApi.getTraceData(traceId);
  };

  if (error) {
    return (
      <div className="agent-tracer">
        <div className="tracer-error">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="agent-tracer">
      <TraceSelector
        traceIds={traceIds}
        selectedTraceId={selectedTraceId}
        onTraceSelect={handleTraceSelect}
      />
      <div className="tracer-content">
        {loading ? (
          <div className="tracer-loading">Loading trace data...</div>
        ) : traceData ? (
          <>
            {console.log('Rendering trace data:', traceData)}
            <SessionInfo
              date={traceData.date || 'Unknown Date'}
              sessionId={traceData.sessionId || 'Unknown Session'}
              isExpanded={true}
            />
            {Array.isArray(traceData?.plans) ? traceData.plans.map((plan): React.ReactNode => (
              <PlanInfo
                key={plan.planId || `plan-${Math.random()}`}
                title={plan.title || 'Untitled Plan'}
                planId={plan.planId || 'unknown'}
                isExpanded={true}
              >
                <div className="tracer-steps">
                  {Array.isArray(plan.steps) ? plan.steps.map((step, index): React.ReactNode => {
                    console.log('Rendering step:', step);
                    const timing = step.timing || '0.00 sec';
                    
                    switch (step.type) {
                      case 'user_message':
                        return (
                          <StepUserMessage
                            key={index}
                            message={step.data?.message || 'No message'}
                            timing={timing}
                          />
                        );
                      case 'topic_selection':
                        return (
                          <StepTopicSelection
                            key={index}
                            timing={timing}
                            promptUsed={<p>{step.data?.promptUsed || 'No prompt'}</p>}
                            availableTopics={<p>{step.data?.availableTopics || 'No topics'}</p>}
                            availableTopicsCount={step.data?.availableTopicsCount || 0}
                          />
                        );
                      case 'topic':
                        return (
                          <StepTopic
                            key={index}
                            topicName={step.data?.topicName || 'Unknown Topic'}
                            description={step.data?.description || 'No description'}
                            timing={timing}
                            instructions={<p>{step.data?.instructions || 'No instructions'}</p>}
                            instructionsCount={step.data?.instructionsCount || 0}
                            availableTopics={<p>{step.data?.availableTopics || 'No topics'}</p>}
                            availableTopicsCount={step.data?.availableTopicsCount || 0}
                          />
                        );
                      case 'action_selection':
                        return (
                          <StepActionSelection
                            key={index}
                            timing={timing}
                            promptUsed={<p>{step.data?.promptUsed || 'No prompt'}</p>}
                          />
                        );
                      case 'action':
                        return (
                          <StepAction
                            key={index}
                            actionName={step.data?.actionName || 'Unknown Action'}
                            description={step.data?.description || 'No description'}
                            timing={timing}
                            inputCode={step.data?.inputCode || '{}'}
                            outputCode={step.data?.outputCode || '{}'}
                          />
                        );
                      case 'response_validation':
                        return (
                          <StepResponseValidation
                            key={index}
                            timing={timing}
                            validationCode={step.data?.validationCode || '{}'}
                          />
                        );
                      case 'agent_response':
                        return (
                          <StepAgentResponse
                            key={index}
                            response={step.data?.response || 'No response'}
                          />
                        );
                      default:
                        console.log('Unknown step type:', step.type);
                        return null;
                    }
                  }) : <div className="tracer-empty">No steps available</div>}
                </div>
              </PlanInfo>
            )) : null}
          </>
        ) : (
          <div className="tracer-empty">
            Select a trace to view its details
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentTracer;
