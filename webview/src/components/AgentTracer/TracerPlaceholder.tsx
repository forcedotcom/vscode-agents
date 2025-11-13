import React from 'react';
import './TracerPlaceholder.css';

const TracerPlaceholder: React.FC = () => {
  return (
    <div className="tracer-placeholder">
      <div className="tracer-placeholder-icon"></div>
      <p>Agent Tracer shows the execution flow of your agent's reasoning process. Send a message to the agent to see detailed trace data.</p>
    </div>
  );
};

export default TracerPlaceholder;
