import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import TracerPlaceholder from './TracerPlaceholder.js';
import { Timeline, TimelineItemProps } from '../shared/Timeline.js';
import { CodeBlock } from '../shared/CodeBlock.js';
import TabNavigation from '../shared/TabNavigation.js';
import SystemMessage from '../AgentPreview/SystemMessage.js';

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
  userMessage?: string;
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

const formatTime = (date: Date): string => {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12; // Convert to 12-hour format, 0 becomes 12
  return `${hours}:${minutes}:${seconds} ${ampm}`;
};

export const formatHistoryLabel = (entry: TraceHistoryEntry, index: number, maxLength?: number): string => {
  let baseLabel = entry.userMessage || (entry.messageId ? `Message ${index + 1}` : `Trace ${index + 1}`);

  // Truncate baseLabel if maxLength is specified (for dropdown options)
  if (maxLength !== undefined && baseLabel.length > maxLength) {
    baseLabel = baseLabel.substring(0, maxLength) + '...';
  }

  if (!entry.timestamp) {
    return baseLabel;
  }
  const date = new Date(entry.timestamp);
  if (Number.isNaN(date.getTime())) {
    return baseLabel;
  }
  const time = formatTime(date);
  return `${time} • ${baseLabel}`;
};

export const formatHistoryParts = (
  entry: TraceHistoryEntry,
  index: number
): { time: string | null; message: string } => {
  const baseLabel = entry.userMessage || (entry.messageId ? `Message ${index + 1}` : `Trace ${index + 1}`);

  if (!entry.timestamp) {
    return { time: null, message: baseLabel };
  }
  const date = new Date(entry.timestamp);
  if (Number.isNaN(date.getTime())) {
    return { time: null, message: baseLabel };
  }
  const time = formatTime(date);
  return { time, message: baseLabel };
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

// Map step types to user-friendly display names
const STEP_DISPLAY_NAMES: Record<string, string> = {
  UserInputStep: 'User Input',
  SessionInitialStateStep: 'Session Initialized',
  NodeEntryStateStep: 'Entered Topic',
  EnabledToolsStep: 'Tools Enabled',
  LLMStep: 'Reasoning',
  VariableUpdateStep: 'Variable Update',
  TransitionStep: 'Topic Transition',
  BeforeReasoningStep: 'Before Reasoning',
  ReasoningStep: 'Output Evaluation',
  PlannerResponseStep: 'Agent Response',
  UpdateTopicStep: 'Topic Selected',
  FunctionStep: 'Action Executed'
};

// Get the description/subtitle for a step based on its type
const getStepDescription = (step: any): string | undefined => {
  const stepType = step.type || step.stepType || '';

  switch (stepType) {
    case 'UserInputStep':
      return step.message || undefined;

    case 'SessionInitialStateStep':
      return step.data?.directive_context || undefined;

    case 'NodeEntryStateStep':
      return step.data?.agent_name || undefined;

    case 'EnabledToolsStep': {
      const tools = step.data?.enabled_tools;
      if (Array.isArray(tools) && tools.length > 0) {
        return `${tools.length} tool${tools.length > 1 ? 's' : ''} for ${step.data?.agent_name || 'agent'}`;
      }
      return step.data?.agent_name || undefined;
    }

    case 'LLMStep': {
      const agentName = step.data?.agent_name;
      const latency = step.data?.execution_latency;
      if (agentName && latency) {
        return `${agentName} (${latency}ms)`;
      }
      return agentName || undefined;
    }

    case 'VariableUpdateStep': {
      const updates = step.data?.variable_updates;
      if (Array.isArray(updates) && updates.length > 0) {
        const varNames = updates.map((u: any) => u.variable_name).filter(Boolean);
        if (varNames.length === 1) {
          return varNames[0];
        }
        if (varNames.length > 1) {
          return `${varNames.length} variables updated`;
        }
      }
      return undefined;
    }

    case 'TransitionStep': {
      const from = step.data?.from_agent;
      const to = step.data?.to_agent;
      if (from && to) {
        return `${from} → ${to}`;
      }
      return undefined;
    }

    case 'BeforeReasoningStep':
      return step.data?.agent_name || undefined;

    case 'ReasoningStep': {
      const reason = step.reason;
      if (reason) {
        // Extract the category (text before the colon)
        const colonIndex = reason.indexOf(':');
        if (colonIndex > 0 && colonIndex < 30) {
          return reason.substring(0, colonIndex);
        }
        return reason;
      }
      return undefined;
    }

    case 'PlannerResponseStep': {
      const message = step.message;
      if (message) {
        return message;
      }
      return undefined;
    }

    case 'UpdateTopicStep':
      return step.topic || undefined;

    case 'FunctionStep':
      return step.function?.name || undefined;

    default:
      return undefined;
  }
};

export const buildTimelineItems = (
  traceData: PlanSuccessResponse | null,
  onSelect: (index: number) => void
): TimelineItemProps[] => {
  if (!traceData || !traceData.plan) {
    return [];
  }

  return traceData.plan.map((step: any, index: number) => {
    const stepType = step.type || step.stepType || '';
    const stepName = step.name || step.label || step.description || '';

    // Determine status - FunctionStep without output indicates an error
    let status: 'success' | 'error' | 'pending' | 'incomplete' = 'success';
    if (stepType === 'FunctionStep' && step.function && !step.function.output) {
      status = 'error';
    }

    // Get user-friendly display name
    const displayType = STEP_DISPLAY_NAMES[stepType] || stepType;

    let label: string;
    if (stepType && stepName) {
      label = `${displayType}: ${stepName}`;
    } else if (stepType) {
      label = displayType;
    } else if (stepName) {
      label = stepName;
    } else {
      label = `Step ${index + 1}`;
    }

    const description = getStepDescription(step);
    const hasData = step && (step.data || step.message || step.reason || step.function);

    return {
      status,
      label,
      description,
      onClick: hasData ? () => onSelect(index) : undefined
    };
  });
};

export const getStepData = (traceData: PlanSuccessResponse | null, selectedStepIndex: number | null): string | null => {
  if (selectedStepIndex === null || !traceData || !traceData.plan) {
    return null;
  }

  const step = traceData.plan[selectedStepIndex];
  if (!step) {
    return null;
  }

  // Build a display object with relevant step properties
  const displayData: Record<string, any> = {};

  if (step.data) {
    Object.assign(displayData, step.data);
  }
  if (step.message) {
    displayData.message = step.message;
  }
  if (step.reason) {
    displayData.reason = step.reason;
  }
  if (step.topic) {
    displayData.topic = step.topic;
  }
  if (step.responseType) {
    displayData.responseType = step.responseType;
  }
  if (step.isContentSafe !== undefined) {
    displayData.isContentSafe = step.isContentSafe;
  }
  if (step.safetyScore) {
    displayData.safetyScore = step.safetyScore;
  }
  if (step.function) {
    displayData.function = step.function;
  }

  if (Object.keys(displayData).length > 0) {
    return JSON.stringify(displayData, null, 2);
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
  const currentHistoryEntry = useMemo(() => {
    if (selectedHistoryIndex !== null && traceHistory[selectedHistoryIndex]) {
      return traceHistory[selectedHistoryIndex];
    }

    if (traceHistory.length > 0 && (selectedHistoryIndex === null || selectedHistoryIndex >= traceHistory.length)) {
      return traceHistory[traceHistory.length - 1];
    }

    return null;
  }, [selectedHistoryIndex, traceHistory]);

  const updateSelectedHistoryIndex = (index: number | null) => {
    historyIndexRef.current = index;
    setSelectedHistoryIndex(index);
  };

  const requestTraceData = useCallback(() => {
    setLoading(true);
    setError(null);
    vscodeApi.getTraceData();
  }, []);

  const handleOpenTraceJson = useCallback(() => {
    if (!currentHistoryEntry) {
      return;
    }
    vscodeApi.openTraceJson(currentHistoryEntry);
  }, [currentHistoryEntry]);

  useEffect(() => {
    // Listen for trace data response
    const disposeTraceData = vscodeApi.onMessage('traceData', data => {
      setTraceData(data);
      setLoading(false);
      setError(null);

      // Send test response when trace data is received (for integration tests)
      vscodeApi.postTestMessage('testTraceDataReceived', {
        hasPlanId: !!data?.planId,
        hasSessionId: !!data?.sessionId,
        planStepCount: data?.plan?.length || 0,
        traceData: data
      });
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
      // Reset history selection to automatically select the latest trace
      historyIndexRef.current = null;
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

      // Send test response when trace history is received (for integration tests)
      vscodeApi.postTestMessage('testTraceHistoryReceived', { entryCount: entries.length, entries });

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
        <div className="tracer-error">{error}</div>
      </div>
    );
  }

  const planSteps = traceData?.plan;
  const hasPlanArray = Array.isArray(planSteps);
  const hasTraceData = hasPlanArray && planSteps.length > 0;
  const shouldShowPlaceholder = !traceData || (hasPlanArray && planSteps.length === 0);
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
          <div className="tracer-loading">
            <span className="loading-spinner"></span>
            <span className="loading-text">Loading trace data...</span>
          </div>
        ) : hasTraceData && traceData ? (
          <div className="tracer-simple">
            {traceHistory.length > 0 && (
              <div className="trace-history-selector">
                <div className="trace-history-selector__input">
                  <select
                    id="trace-history-select"
                    aria-label="Trace history"
                    className={`trace-history-selector__select ${selectedHistoryIndex !== null ? 'has-selection' : ''}`}
                    value={selectedHistoryIndex !== null ? selectedHistoryIndex : Math.max(traceHistory.length - 1, 0)}
                    onChange={handleHistoryChange}
                  >
                    {traceHistory.map((entry, index) => {
                      const fullLabel = formatHistoryLabel(entry, index);
                      const truncatedLabel = formatHistoryLabel(entry, index, 60);
                      return (
                        <option key={`${entry.planId}-${index}`} value={index} title={fullLabel}>
                          {truncatedLabel}
                        </option>
                      );
                    })}
                  </select>
                  {selectedHistoryIndex !== null &&
                    (() => {
                      const currentEntry = traceHistory[selectedHistoryIndex];
                      const { time, message } = formatHistoryParts(currentEntry, selectedHistoryIndex);
                      return (
                        <div className="trace-history-selector__display">
                          {time && <span className="trace-time">{time}</span>}
                          {time && <span className="trace-separator">•</span>}
                          <span className="trace-message">{message}</span>
                        </div>
                      );
                    })()}
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
                {selectedHistoryIndex !== null && traceHistory[selectedHistoryIndex]?.timestamp && (
                  <tr>
                    <td className="tracer-info-table__label">Timestamp</td>
                    <td className="tracer-info-table__value">
                      {new Date(traceHistory[selectedHistoryIndex].timestamp).toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="tracer-scrollable-content">
              <div className="tracer-plan-timeline">
                <Timeline items={timelineItems} />
              </div>
              {currentHistoryEntry && (
                <div className="tracer-json-link">
                  <button type="button" className="tracer-json-link__button" onClick={handleOpenTraceJson}>
                    View raw JSON
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : shouldShowPlaceholder ? (
          <TracerPlaceholder
            onGoToPreview={onGoToPreview}
            isSessionActive={isSessionActive}
            isLiveMode={isLiveMode}
            selectedAgentInfo={selectedAgentInfo}
            onModeChange={onLiveModeChange}
          />
        ) : (
          <SystemMessage content="Unable to load trace data. Check the console for errors." type="error" />
        )}
      </div>

      {selectedStepIndex !== null && selectedStepData && (
        <div className="tracer-step-data-panel" style={{ height: `${panelHeight}px` }}>
          <div className="tracer-step-data-panel__resize-handle" onMouseDown={handleResizeStart} />
          <TabNavigation
            activeTab={0}
            onTabChange={() => {}}
            onClose={() => setSelectedStepIndex(null)}
            tabs={[
              {
                id: 'json',
                label: 'JSON',
                icon: (
                  <svg
                    width="14"
                    height="11"
                    viewBox="0 0 14 11"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3.68 2.61333L2.98667 1.86667L0 4.90667V5.6L2.98667 8.58667L3.68 7.89333L1.06667 5.22667L3.68 2.61333ZM10.72 1.86667L13.7067 4.90667V5.6L10.72 8.58667L9.97333 7.89333L12.64 5.22667L9.97333 2.61333L10.72 1.86667ZM3.89333 10.0267L8.90667 0L9.81333 0.48L4.8 10.4533L3.89333 10.0267Z"
                      fill="currentColor"
                    />
                  </svg>
                )
              }
            ]}
          />
          <div className="tracer-step-data-panel__content">
            <CodeBlock code={selectedStepData!} showCopy={false} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentTracer;
