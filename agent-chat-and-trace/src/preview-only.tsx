import React from 'react';
import { createRoot } from 'react-dom/client';
import AgentPreview from './components/AgentPreview/AgentPreview';
import './index.css';

const PreviewOnlyApp: React.FC = () => {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <AgentPreview />
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<PreviewOnlyApp />);