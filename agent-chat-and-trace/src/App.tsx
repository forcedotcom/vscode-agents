import React, { useState, useEffect } from 'react';
import AgentPreview from './components/AgentPreview/AgentPreview';
import AgentTracer from './components/AgentTracer/AgentTracer';
import TabNavigation from './components/shared/TabNavigation';
import { vscodeApi } from './services/vscodeApi';
import './App.css';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'preview' | 'tracer'>('preview');
  const [showTracerTab, setShowTracerTab] = useState<boolean>(false);

  useEffect(() => {
    // Listen for configuration updates
    vscodeApi.onMessage('configuration', (data) => {
      if (data.section === 'agentforceDx.showAgentTracer') {
        setShowTracerTab(data.value === true);
        // If tracer tab is being hidden and it's currently active, switch to preview
        if (!data.value && activeTab === 'tracer') {
          setActiveTab('preview');
        }
      }
    });

    // Request the current configuration
    vscodeApi.getConfiguration('agentforceDx.showAgentTracer');
  }, [activeTab]);

  const handleTabChange = (tab: 'preview' | 'tracer') => {
    setActiveTab(tab);
  };

  return (
    <div className="app">
      <TabNavigation 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        showTracerTab={showTracerTab}
      />
      <div className="app-content">
        {activeTab === 'preview' ? <AgentPreview /> : <AgentTracer />}
      </div>
    </div>
  );
};

export default App;