import React from 'react';
import { createRoot } from 'react-dom/client';
import AgentTracer from './components/AgentTracer/AgentTracer';
import './index.css';

const TracerOnlyApp: React.FC = () => {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <AgentTracer />
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<TracerOnlyApp />);