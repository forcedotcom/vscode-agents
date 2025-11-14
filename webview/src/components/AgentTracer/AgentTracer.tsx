import React, { useState, useEffect, useCallback } from 'react';
import TracerPlaceholder from './TracerPlaceholder.js';
import { Timeline, TimelineItemProps } from '../shared/Timeline.js';
import { CodeBlock } from '../shared/CodeBlock.js';
import TabNavigation from '../shared/TabNavigation.js';

import { vscodeApi, AgentInfo } from '../../services/vscodeApi.js';
import './AgentTracer.css';

interface AgentTracerProps {
  isVisible?: boolean;
  onGoToPreview?: () => void;
  isSessionActive?: boolean;
  isLiveMode?: boolean;
  selectedAgentInfo?: AgentInfo | null;
  onLiveModeChange?: (isLive: boolean) => void;
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

const AgentTracer: React.FC<AgentTracerProps> = ({
  isVisible = true,
  onGoToPreview,
  isSessionActive = false,
  isLiveMode = false,
  selectedAgentInfo = null,
  onLiveModeChange
}) => {
  const [traceData, setTraceData] = useState<PlanSuccessResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [panelHeight, setPanelHeight] = useState<number>(300);
  const [isResizing, setIsResizing] = useState<boolean>(false);

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
        <div className="tracer-error">{error || 'Something went wrong'}</div>
      </div>
    );
  }

  const hasTraceData = traceData !== null && traceData.plan && traceData.plan.length > 0;

  // Convert plan steps to timeline items
  const getTimelineItems = (): TimelineItemProps[] => {
    if (!traceData || !traceData.plan) return [];

    return traceData.plan.map((step: any, index: number) => {
      // All steps are shown as success (checked state)
      const status: 'success' | 'error' | 'pending' | 'incomplete' = 'success';

      // Type as the label (at the top)
      const stepType = step.type || step.stepType || '';
      const stepName = step.name || step.label || step.description || '';

      // Combine type and name for label
      let label: string;
      if (stepType && stepName) {
        label = `${stepType}: ${stepName}`;
      } else if (stepType) {
        label = stepType;
      } else if (stepName) {
        label = stepName;
      } else {
        label = `Step ${index + 1}`;
      }

      // Step number as the description (underneath)
      const description = `Step ${index + 1}`;

      // Only add onClick if the step has data
      const hasData = step && step.data;

      return {
        status,
        label,
        description,
        onClick: hasData ? () => setSelectedStepIndex(index) : undefined
      };
    });
  };

  // Get selected step data
  const getSelectedStepData = (): string | null => {
    if (selectedStepIndex === null || !traceData || !traceData.plan) {
      return null;
    }

    const step = traceData.plan[selectedStepIndex];
    if (step && step.data) {
      return JSON.stringify(step.data, null, 2);
    }

    return null;
  };

  // Handle panel resize
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight >= 100 && newHeight <= window.innerHeight * 0.8) {
        setPanelHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div className="agent-tracer">
      <div className="tracer-content">
        {loading ? (
          <div className="tracer-loading">Loading trace data...</div>
        ) : hasTraceData && traceData ? (
          <div className="tracer-simple">
            <table className="tracer-info-table">
              <tbody>
                <tr>
                  <td className="tracer-info-table__label">Session ID</td>
                  <td className="tracer-info-table__value">{traceData.sessionId}</td>
                </tr>
                <tr>
                  <td className="tracer-info-table__label">Plan ID</td>
                  <td className="tracer-info-table__value">{traceData.planId}</td>
                </tr>
                {traceData.topic && (
                  <tr>
                    <td className="tracer-info-table__label">Topic</td>
                    <td className="tracer-info-table__value">{traceData.topic}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="tracer-plan-timeline">
              <Timeline items={getTimelineItems()} />
            </div>
          </div>
        ) : traceData === null ? (
          <div className="tracer-empty">Loading trace data...</div>
        ) : traceData && traceData.plan && traceData.plan.length === 0 ? (
          <TracerPlaceholder
            onGoToPreview={onGoToPreview}
            isSessionActive={isSessionActive}
            isLiveMode={isLiveMode}
            selectedAgentInfo={selectedAgentInfo}
            onModeChange={onLiveModeChange}
          />
        ) : (
          <div className="tracer-empty">Unable to load trace data. Check the console for errors.</div>
        )}
      </div>

      {selectedStepIndex !== null && getSelectedStepData() && (
        <div
          className="tracer-step-data-panel"
          style={{ height: `${panelHeight}px` }}
        >
          <div
            className="tracer-step-data-panel__resize-handle"
            onMouseDown={handleResizeStart}
          />
          <TabNavigation
            activeTab={0}
            onTabChange={() => {}}
            onClose={() => setSelectedStepIndex(null)}
            tabs={[
              {
                id: 'json',
                label: 'JSON',
                icon: (
                  <svg width="14" height="11" viewBox="0 0 14 11" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3.68 2.61333L2.98667 1.86667L0 4.90667V5.6L2.98667 8.58667L3.68 7.89333L1.06667 5.22667L3.68 2.61333ZM10.72 1.86667L13.7067 4.90667V5.6L10.72 8.58667L9.97333 7.89333L12.64 5.22667L9.97333 2.61333L10.72 1.86667ZM3.89333 10.0267L8.90667 0L9.81333 0.48L4.8 10.4533L3.89333 10.0267Z" fill="currentColor"/>
                  </svg>
                )
              }
            ]}
          />
          <div className="tracer-step-data-panel__content">
            <CodeBlock
              code={getSelectedStepData()!}
              showCopy={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentTracer;
