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
    vscodeApi.onMessage('configuration', data => {
      if (data.section === 'salesforce.agentforceDX.showAgentTracer') {
        setShowTracerTab(data.value === true);
        // If tracer tab is being hidden and it's currently active, switch to preview
        if (!data.value && activeTab === 'tracer') {
          setActiveTab('preview');
        }
      }
    });

    // Request the current configuration
    vscodeApi.getConfiguration('salesforce.agentforceDX.showAgentTracer');
  }, [activeTab]);

  const handleTabChange = (tab: 'preview' | 'tracer') => {
    setActiveTab(tab);
  };

  return (
    <div className="app">
      {showTracerTab && (
        <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} showTracerTab={showTracerTab} />
      )}
      <div className="app-content">
        <div className={`tab-content ${activeTab === 'preview' ? 'active' : 'hidden'}`}>
          <AgentPreview />
        </div>
        {showTracerTab && (
          <div className={`tab-content ${activeTab === 'tracer' ? 'active' : 'hidden'}`}>
            <AgentTracer />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
