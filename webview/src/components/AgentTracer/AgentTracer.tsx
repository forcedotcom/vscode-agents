import React, { useState, useEffect, useCallback } from 'react';
import { SessionInfo } from './SessionInfo.js';
import { PlanInfo } from './PlanInfo.js';
import { StepUserMessage } from './StepUserMessage.js';
import { StepTopicSelection } from './StepTopicSelection.js';
import { StepTopic } from './StepTopic.js';
import { StepActionSelection } from './StepActionSelection.js';
import { StepAction } from './StepAction.js';
import { StepAgentResponse } from './StepAgentResponse.js';

import { vscodeApi } from '../../services/vscodeApi.js';
import './AgentTracer.css';

interface AgentTracerProps {
  isVisible?: boolean;
}

// PlanSuccessResponse format from AgentSimulate.trace()
interface PlanSuccessResponse {
  type: string;
  planId: string;
  sessionId: string;
  intent?: string;
  topic?: string;
  plan: any[];
}

const AgentTracer: React.FC<AgentTracerProps> = ({ isVisible = true }) => {
  const [traceData, setTraceData] = useState<PlanSuccessResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['session']));

  const requestTraceData = useCallback(() => {
    setLoading(true);
    setError(null);
    vscodeApi.getTraceData();
  }, []);

  useEffect(() => {
    // Listen for trace data response
    const disposeTraceData = vscodeApi.onMessage('traceData', data => {
      setTraceData(data);
      setLoading(false);
      setError(null);
    });

    // Listen for errors
    const disposeError = vscodeApi.onMessage('error', data => {
      // Only show error if it's related to trace data, not other errors
      if (data.message && typeof data.message === 'string') {
        // Check if this is a trace-related error
        if (data.message.includes('trace') || data.message.includes('plan ID') || data.message.includes('session')) {
          setError(data.message);
          setLoading(false);
        }
      }
    });

    // Listen for messageSent events to refresh trace data
    const disposeMessageSent = vscodeApi.onMessage('messageSent', () => {
      // Wait a bit for the planId to be set in the provider before requesting
      setTimeout(() => {
        requestTraceData();
      }, 200);
    });

    // Request trace data when component mounts
    requestTraceData();

    return () => {
      disposeTraceData();
      disposeError();
      disposeMessageSent();
    };
  }, [requestTraceData]);

  // Request trace data when the tracer tab becomes visible
  useEffect(() => {
    if (isVisible) {
      requestTraceData();
    }
  }, [isVisible, requestTraceData]);

  if (error) {
    return (
      <div className="agent-tracer">
        <div className="tracer-error">Error: {error}</div>
      </div>
    );
  }

  const hasTraceData = traceData !== null && traceData.plan && traceData.plan.length > 0;

  const toggleExpansion = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    if (newState) {
      // Expand all sections
      const allSections = new Set(['session']);
      if (hasTraceData) {
        allSections.add('plan-0');
      }
      setExpandedSections(allSections);
    } else {
      // Collapse all sections
      setExpandedSections(new Set());
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  return (
    <div className="agent-tracer">
      <div className="tracer-content">
        {loading ? (
          <div className="tracer-loading">Loading trace data...</div>
        ) : hasTraceData && traceData ? (
          <>
            <SessionInfo
              date={new Date().toLocaleString()}
              sessionId={traceData.sessionId}
              isExpanded={expandedSections.has('session')}
              onToggle={() => toggleSection('session')}
              onToggleAll={toggleExpansion}
              isAllExpanded={isExpanded}
            />
            <PlanInfo
              key={traceData.planId}
              title={traceData.plan.find(step => step.type === 'UserInputStep')?.message || 'Untitled Plan'}
              planId={traceData.planId}
              isExpanded={expandedSections.has('plan-0')}
              onToggle={() => toggleSection('plan-0')}
            >
              <div className="tracer-steps">
                {Array.isArray(traceData.plan) ? (
                  traceData.plan.map((step, index): React.ReactNode => {
                      // Extract timing from various possible fields
                      let timing = '0.00 sec';
                      if (step instanceof Object) {
                        const stepAny = step as any;
                        if (stepAny.executionLatency !== undefined) {
                          timing = `${(stepAny.executionLatency / 1000).toFixed(2)} sec`;
                        } else if (stepAny.execution_latency !== undefined) {
                          timing = `${(stepAny.execution_latency / 1000).toFixed(2)} sec`;
                        } else if (stepAny.data?.execution_latency !== undefined) {
                          timing = `${(stepAny.data.execution_latency / 1000).toFixed(2)} sec`;
                        }
                      }

                      // Type assertion for custom step types not in @salesforce/agents
                      const stepWithType = step as typeof step & {
                        type: string;
                        actionName?: string;
                        description?: string;
                        timing?: string;
                        inputCode?: string;
                        outputCode?: string;
                      };

                      switch (stepWithType.type) {
                        case 'UserInputStep':
                          return <StepUserMessage key={index} message={(step as any).message} timing={timing} />;
                        case 'LLMExecutionStep':
                          return (
                            <StepTopicSelection
                              key={index}
                              timing={timing}
                              promptUsed={<p>{(step as any).promptContent}</p>}
                              availableTopics={<p>{(step as any).promptResponse}</p>}
                              availableTopicsCount={1}
                            />
                          );
                        case 'UpdateTopicStep':
                          return (
                            <StepTopic
                              key={index}
                              topicName={(step as any).topic}
                              description={(step as any).description}
                              timing={timing}
                              instructions={<p>{(step as any).instructions.join('\n')}</p>}
                              instructionsCount={(step as any).instructions.length}
                              availableTopics={<p>{(step as any).availableFunctions.join(', ')}</p>}
                              availableTopicsCount={(step as any).availableFunctions.length}
                            />
                          );
                        case 'EventStep':
                          return (
                            <StepActionSelection
                              key={index}
                              timing={timing}
                              promptUsed={
                                <p>{`${(step as any).eventName}: ${(step as any).payload.oldTopic} → ${(step as any).payload.newTopic}`}</p>
                              }
                            />
                          );
                        case 'ReasoningStep': {
                          const reasoningStep = step as any;
                          return (
                            <StepAction
                              key={index}
                              actionName="Reasoning"
                              description={reasoningStep.reason}
                              timing={timing}
                              inputCode={reasoningStep.inputCode || "{}"}
                              outputCode={reasoningStep.outputCode || "{}"}
                            />
                          );
                        }
                        case 'PlannerResponseStep':
                          return <StepAgentResponse key={index} response={(step as any).message} />;
                        case 'LLMStep': {
                          const llmStep = step as any;
                          return (
                            <StepAction
                              key={index}
                              actionName="LLM Execution"
                              description={`Prompt: ${llmStep.data?.prompt_name || 'Unknown'}`}
                              timing={timing}
                              inputCode={llmStep.data?.prompt_content ? JSON.stringify(llmStep.data.prompt_content, null, 2) : "{}"}
                              outputCode={llmStep.data?.prompt_response ? JSON.stringify(llmStep.data.prompt_response, null, 2) : "{}"}
                            />
                          );
                        }
                        case 'FunctionStep': {
                          const functionStep = step as any;
                          return (
                            <StepAction
                              key={index}
                              actionName={functionStep.function?.name || 'Function Call'}
                              description={`Function execution`}
                              timing={timing}
                              inputCode={functionStep.function?.input ? JSON.stringify(functionStep.function.input, null, 2) : "{}"}
                              outputCode={functionStep.function?.output ? JSON.stringify(functionStep.function.output, null, 2) : "{}"}
                            />
                          );
                        }
                        case 'BeforeReasoningStep':
                        case 'VariableUpdateStep':
                        case 'EnabledToolsStep': {
                          // These are internal steps that don't need detailed display
                          const stepName = stepWithType.type.replace(/([A-Z])/g, ' $1').trim();
                          return (
                            <div key={index} className="tracer-step-internal">
                              <strong>{stepName}</strong>
                              {stepWithType.data && (
                                <pre>{JSON.stringify((step as any).data, null, 2)}</pre>
                              )}
                            </div>
                          );
                        }
                        default: {
                          const unknownStep = step as { type: string };
                          // Handle ActionStep as default case
                          if (unknownStep.type === 'ActionStep') {
                            const actionStep = step as any;
                            return (
                              <StepAction
                                key={index}
                                actionName={actionStep.actionName || 'Unknown Action'}
                                description={actionStep.description || ''}
                                timing={actionStep.timing || timing}
                                inputCode={actionStep.inputCode}
                                outputCode={actionStep.outputCode}
                              />
                            );
                          }
                          return null;
                        }
                      }
                    })
                  ) : (
                    <div className="tracer-empty">No steps available</div>
                  )}
              </div>
            </PlanInfo>
          </>
        ) : traceData === null ? (
          <div className="tracer-empty">Loading trace data...</div>
        ) : traceData && traceData.plan && traceData.plan.length === 0 ? (
          <div className="tracer-empty">No trace data available yet. Send a message to the agent to generate trace data.</div>
        ) : (
          <div className="tracer-empty">Unable to load trace data. Check the console for errors.</div>
        )}
      </div>
    </div>
  );
};

export default AgentTracer;
