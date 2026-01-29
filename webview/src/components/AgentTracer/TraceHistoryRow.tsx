import React from 'react';
import { Timeline, TimelineItemProps } from '../shared/Timeline.js';
import chevronIconDark from '../../assets/chevron-dark.svg';
import chevronIconLight from '../../assets/chevron-light.svg';
import './TraceHistoryRow.css';

interface PlanSuccessResponse {
  type: string;
  planId: string;
  sessionId: string;
  intent?: string;
  topic?: string;
  plan: any[];
}

export interface TraceHistoryRowProps {
  /** The trace entry data */
  entry: {
    storageKey: string;
    agentId: string;
    sessionId: string;
    planId: string;
    messageId?: string;
    userMessage?: string;
    timestamp?: string;
    trace: PlanSuccessResponse;
  };
  /** Index of this row in the list */
  index: number;
  /** Whether this row is currently expanded */
  isExpanded: boolean;
  /** Callback when expand state changes */
  onExpandedChange: (expanded: boolean) => void;
  /** Callback to open raw JSON */
  onOpenJson: () => void;
  /** Timeline items for this entry */
  timelineItems: TimelineItemProps[];
  /** Time string for header display */
  time: string | null;
  /** Message string for header display */
  message: string;
}

export const TraceHistoryRow: React.FC<TraceHistoryRowProps> = ({
  entry,
  index,
  isExpanded,
  onExpandedChange,
  onOpenJson,
  timelineItems,
  time: _time,
  message
}) => {
  const isDark =
    document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');

  const contentId = `trace-history-content-${index}`;

  const handleHeaderClick = () => {
    onExpandedChange(!isExpanded);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onExpandedChange(!isExpanded);
    }
  };

  const traceData = entry.trace;

  const handleJsonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenJson();
  };

  return (
    <div className={`trace-history-row ${isExpanded ? 'trace-history-row--expanded' : ''}`}>
      <div className="trace-history-row__header-wrapper">
        <button
          type="button"
          className="trace-history-row__header"
          onClick={handleHeaderClick}
          onKeyDown={handleKeyDown}
          aria-expanded={isExpanded}
          aria-controls={contentId}
        >
          <img
            src={isDark ? chevronIconDark : chevronIconLight}
            alt=""
            aria-hidden="true"
            className={`trace-history-row__chevron ${isExpanded ? 'trace-history-row__chevron--expanded' : ''}`}
          />
          <span className="trace-history-row__header-content">
            <span className="trace-history-row__message">{message}</span>
          </span>
        </button>
        <button
          type="button"
          className="trace-history-row__json-icon"
          onClick={handleJsonClick}
          aria-label="View raw JSON"
          title="View raw JSON"
        >
          <svg width="15" height="14" viewBox="0 0 15 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M5.01333 4.90666L7.04 2.82666V2.13333L4.90666 -2.86102e-06L4.21333 0.69333L5.49333 1.97333H2.50666C1.79555 1.97333 1.19111 2.22222 0.693331 2.72C0.231108 3.21777 -2.86102e-06 3.82222 -2.86102e-06 4.53333C-2.86102e-06 5.20889 0.231108 5.79555 0.693331 6.29333C1.19111 6.75555 1.79555 6.98666 2.50666 6.98666H2.98666V5.97333H2.50666C2.08 5.97333 1.72444 5.83111 1.44 5.54666C1.15555 5.26222 0.995553 4.90666 0.959997 4.48C0.959997 4.05333 1.10222 3.69777 1.38666 3.41333C1.70666 3.12889 2.08 2.98666 2.50666 2.98666H5.49333L4.21333 4.26666L4.90666 4.96L5.01333 4.90666ZM9.97333 0.959997H7.30666L6.29333 -2.86102e-06H10.9867L11.68 0.266664L14.72 3.25333L14.9867 4V12.96L13.9733 13.9733H5.01333L4 12.96V5.49333L5.01333 6.34666V12.96H13.9733V4.96H9.97333V0.959997ZM10.9867 0.959997V4H13.9733L10.9867 0.959997Z" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div id={contentId} className="trace-history-row__content">
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
              {entry.timestamp && (
                <tr>
                  <td className="tracer-info-table__label">Timestamp</td>
                  <td className="tracer-info-table__value">{new Date(entry.timestamp).toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="trace-history-row__timeline">
            <Timeline items={timelineItems} />
          </div>
        </div>
      )}
    </div>
  );
};

export default TraceHistoryRow;
