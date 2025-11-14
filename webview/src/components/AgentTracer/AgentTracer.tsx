import React, { useState, useEffect, useCallback } from 'react';
import TracerPlaceholder from './TracerPlaceholder.js';

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

  return (
    <div className="agent-tracer">
      <div className="tracer-content">
        {loading ? (
          <div className="tracer-loading">Loading trace data...</div>
        ) : hasTraceData && traceData ? (
          <div className="tracer-simple">
            <div className="tracer-header">
              <div>Session ID: {traceData.sessionId}</div>
              <div>Date: {new Date().toLocaleString()}</div>
            </div>
            <pre className="tracer-json-dump">{JSON.stringify(traceData, null, 2)}</pre>
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
