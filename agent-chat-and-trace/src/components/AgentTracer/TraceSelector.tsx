import React from 'react';
import './TraceSelector.css';

interface TraceSelectorProps {
  traceIds: string[];
  selectedTraceId: string | null;
  onTraceSelect: (traceId: string) => void;
}

export const TraceSelector: React.FC<TraceSelectorProps> = ({
  traceIds,
  selectedTraceId,
  onTraceSelect,
}) => {
  return (
    <div className="trace-selector">
      <select
        value={selectedTraceId || ''}
        onChange={(e) => onTraceSelect(e.target.value)}
        className="trace-selector-dropdown"
      >
        <option value="">Select a trace...</option>
        {traceIds.map((id) => (
          <option key={id} value={id}>
            Trace {id}
          </option>
        ))}
      </select>
    </div>
  );
};
