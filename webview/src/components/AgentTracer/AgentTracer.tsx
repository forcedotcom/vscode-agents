import React, { useState, useEffect } from 'react';
import { SessionInfo } from './SessionInfo';
import { PlanInfo } from './PlanInfo';
import { StepUserMessage } from './StepUserMessage';
import { StepTopicSelection } from './StepTopicSelection';
import { StepTopic } from './StepTopic';
import { StepActionSelection } from './StepActionSelection';
import { StepAction } from './StepAction';
import { StepAgentResponse } from './StepAgentResponse';

import { vscodeApi } from '../../services/vscodeApi';
import { AgentTraceResponse } from '@salesforce/agents';
import './AgentTracer.css';

const AgentTracer: React.FC = () => {
  const [traceData, setTraceData] = useState<AgentTraceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['session']));

  useEffect(() => {
    // Listen for trace data response
    vscodeApi.onMessage('traceData', data => {
      setTraceData(data);
      setLoading(false);
      setError(null);
    });

    // Listen for errors
    vscodeApi.onMessage('error', data => {
      setError(data.message);
      setLoading(false);
    });

    // Request trace data when component mounts
    vscodeApi.getTraceData();
  }, []);

  if (error) {
    return (
      <div className="agent-tracer">
        <div className="tracer-error">Error: {error}</div>
      </div>
    );
  }

  const toggleExpansion = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    if (newState) {
      // Expand all sections
      const allSections = new Set(['session']);
      traceData?.actions.forEach((_, index) => {
        allSections.add(`plan-${index}`);
      });
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
        ) : traceData ? (
          <>
            <SessionInfo
              date={new Date().toLocaleString()}
              sessionId={traceData.actions[0]?.returnValue.sessionId || 'Unknown Session'}
              isExpanded={expandedSections.has('session')}
              onToggle={() => toggleSection('session')}
              onToggleAll={toggleExpansion}
              isAllExpanded={isExpanded}
            />
            {traceData.actions.map((action, actionIndex) => (
              <PlanInfo
                key={`${action.returnValue.planId}-${actionIndex}`}
                title={action.returnValue.plan.find(step => step.type === 'UserInputStep')?.message || 'Untitled Plan'}
                planId={action.returnValue.planId || 'unknown'}
                isExpanded={expandedSections.has(`plan-${actionIndex}`)}
                onToggle={() => toggleSection(`plan-${actionIndex}`)}
              >
                <div className="tracer-steps">
                  {Array.isArray(action.returnValue.plan) ? (
                    action.returnValue.plan.map((step, index): React.ReactNode => {
                      console.log('Rendering step:', step);
                      const timing =
                        step instanceof Object && 'executionLatency' in step
                          ? `${(step.executionLatency / 1000).toFixed(2)} sec`
                          : '0.00 sec';

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
                        default: {
                          const unknownStep = step as { type: string };
                          console.log('Unknown step type:', unknownStep.type);
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
            ))}
          </>
        ) : (
          <div className="tracer-empty">Select a trace to view its details</div>
        )}
      </div>
    </div>
  );
};

export default AgentTracer;
