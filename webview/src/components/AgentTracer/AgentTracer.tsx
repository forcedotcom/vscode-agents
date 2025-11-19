import React, { useState, useEffect, useCallback, useRef } from 'react';
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

export interface TraceHistoryEntry {
  storageKey: string;
  agentId: string;
  sessionId: string;
  planId: string;
  messageId?: string;
  timestamp?: string;
  trace: PlanSuccessResponse;
}

export const isTraceErrorMessage = (message?: string): boolean => {
  if (!message || typeof message !== 'string') {
    return false;
  }
  const lowered = message.toLowerCase();
  return lowered.includes('trace') || lowered.includes('plan id') || lowered.includes('session');
};

export const formatHistoryLabel = (entry: TraceHistoryEntry, index: number): string => {
  const baseLabel = entry.messageId ? `Message ${index + 1}` : `Trace ${index + 1}`;
  if (!entry.timestamp) {
    return baseLabel;
  }
  const date = new Date(entry.timestamp);
  if (Number.isNaN(date.getTime())) {
    return baseLabel;
  }
  return `${baseLabel} • ${date.toLocaleTimeString()}`;
};

export const selectHistoryEntry = (entries: TraceHistoryEntry[], index: number): PlanSuccessResponse | null => {
  if (index < 0 || index >= entries.length) {
    return null;
  }
  return entries[index].trace ?? null;
};

export const applyHistorySelection = (
  entries: TraceHistoryEntry[],
  preferredIndex: number | null
): { nextIndex: number | null; nextTraceData: PlanSuccessResponse | null } => {
  if (entries.length === 0) {
    return { nextIndex: null, nextTraceData: null };
  }

  const targetIndex =
    preferredIndex !== null && preferredIndex >= 0 && preferredIndex < entries.length
      ? preferredIndex
      : entries.length - 1;

  return {
    nextIndex: targetIndex,
    nextTraceData: entries[targetIndex].trace
  };
};

export const buildTimelineItems = (
  traceData: PlanSuccessResponse | null,
  onSelect: (index: number) => void
): TimelineItemProps[] => {
  if (!traceData || !traceData.plan) {
    return [];
  }

  return traceData.plan.map((step: any, index: number) => {
    const status: 'success' | 'error' | 'pending' | 'incomplete' = 'success';
    const stepType = step.type || step.stepType || '';
    const stepName = step.name || step.label || step.description || '';

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

    const description = `Step ${index + 1}`;
    const hasData = step && step.data;

    return {
      status,
      label,
      description,
      onClick: hasData ? () => onSelect(index) : undefined
    };
  });
};

export const getStepData = (
  traceData: PlanSuccessResponse | null,
  selectedStepIndex: number | null
): string | null => {
  if (selectedStepIndex === null || !traceData || !traceData.plan) {
    return null;
  }

  const step = traceData.plan[selectedStepIndex];
  if (step && step.data) {
    return JSON.stringify(step.data, null, 2);
  }

  return null;
};

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
  const [traceHistory, setTraceHistory] = useState<TraceHistoryEntry[]>([]);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const historyIndexRef = useRef<number | null>(null);

  const updateSelectedHistoryIndex = (index: number | null) => {
    historyIndexRef.current = index;
    setSelectedHistoryIndex(index);
  };

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
      if (isTraceErrorMessage(data?.message)) {
        setError(data.message);
        setLoading(false);
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

    const disposeTraceHistory = vscodeApi.onMessage('traceHistory', data => {
      const entries = Array.isArray(data?.entries) ? data.entries : [];
      setTraceHistory(entries);
      setLoading(false);

      if (entries.length === 0) {
        updateSelectedHistoryIndex(null);
        setTraceData(null);
        setSelectedStepIndex(null);
        return;
      }

      const { nextIndex, nextTraceData } = applyHistorySelection(entries, historyIndexRef.current);
      updateSelectedHistoryIndex(nextIndex);
      setTraceData(nextTraceData);
      setSelectedStepIndex(null);
    });

    return () => {
      disposeTraceData();
      disposeError();
      disposeMessageSent();
      disposeTraceHistory();
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
  const timelineItems = buildTimelineItems(traceData, index => setSelectedStepIndex(index));
  const selectedStepData = getStepData(traceData, selectedStepIndex);

  // Handle panel resize
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleHistoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const index = parseInt(event.target.value, 10);
    if (Number.isNaN(index)) {
      return;
    }

    const nextTrace = selectHistoryEntry(traceHistory, index);
    if (!nextTrace) {
      return;
    }

    updateSelectedHistoryIndex(index);
    setTraceData(nextTrace);
    setSelectedStepIndex(null);
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
            {traceHistory.length > 0 && (
              <div className="trace-history-selector">
                <div className="trace-history-selector__input">
                  <select
                    id="trace-history-select"
                    aria-label="Trace history"
                    className="trace-history-selector__select"
                    value={
                      selectedHistoryIndex !== null
                        ? selectedHistoryIndex
                        : Math.max(traceHistory.length - 1, 0)
                    }
                    onChange={handleHistoryChange}
                  >
                    {traceHistory.map((entry, index) => (
                      <option key={`${entry.planId}-${index}`} value={index}>
                        {formatHistoryLabel(entry, index)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
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
              <Timeline items={timelineItems} />
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

      {selectedStepIndex !== null && selectedStepData && (
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
              code={selectedStepData!}
              showCopy={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentTracer;
