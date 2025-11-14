import React, { useState, useEffect, useCallback } from 'react';
import TracerPlaceholder from './TracerPlaceholder.js';
import { Timeline, TimelineItemProps } from '../shared/Timeline.js';

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

      // Step number as the label (at the top)
      const label = `Step ${index + 1}`;

      // Type as the description (underneath)
      const stepType = step.type || step.stepType || '';
      const stepName = step.name || step.label || step.description || '';

      // Combine type and name for description
      let description: string | undefined;
      if (stepType && stepName) {
        description = `${stepType}: ${stepName}`;
      } else if (stepType) {
        description = stepType;
      } else if (stepName) {
        description = stepName;
      }

      return {
        status,
        label,
        description
      };
    });
  };

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
                {traceData.intent && (
                  <tr>
                    <td className="tracer-info-table__label">Intent</td>
                    <td className="tracer-info-table__value">{traceData.intent}</td>
                  </tr>
                )}
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

            <details className="tracer-json-details">
              <summary className="tracer-json-summary">View Raw JSON</summary>
              <pre className="tracer-json-dump">{JSON.stringify(traceData, null, 2)}</pre>
            </details>
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
    </div>
  );
};

export default AgentTracer;
