import React from 'react';
import { createRoot } from 'react-dom/client';
import TabNavigation from './components/shared/TabNavigation';
import './index.css';

const TabsOnlyApp: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'preview' | 'tracer'>('preview');

  return (
    <div style={{ width: '100%', height: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<TabsOnlyApp />);
