import React, { useState } from 'react';
import AgentPreview from './components/AgentPreview/AgentPreview';
import AgentTracer from './components/AgentTracer/AgentTracer';
import TabNavigation from './components/shared/TabNavigation';
import './App.css';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'preview' | 'tracer'>('preview');

  const handleTabChange = (tab: 'preview' | 'tracer') => {
    setActiveTab(tab);
  };

  return (
    <div className="app">
      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="app-content">
        {activeTab === 'preview' ? <AgentPreview /> : <AgentTracer />}
      </div>
    </div>
  );
};

export default App;