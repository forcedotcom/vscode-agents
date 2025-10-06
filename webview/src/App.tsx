import React, { useState, useEffect } from 'react';
import AgentPreview from './components/AgentPreview/AgentPreview';
import AgentTracer from './components/AgentTracer/AgentTracer';
import AgentSelector from './components/AgentPreview/AgentSelector';
import TabNavigation from './components/shared/TabNavigation';
import { vscodeApi } from './services/vscodeApi';
import './App.css';

interface ClientApp {
  name: string;
  clientId: string;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'preview' | 'tracer'>('preview');
  const [showTracerTab, setShowTracerTab] = useState<boolean>(false);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [clientAppState, setClientAppState] = useState<'none' | 'required' | 'selecting' | 'ready'>('none');
  const [availableClientApps, setAvailableClientApps] = useState<ClientApp[]>([]);

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

    // Listen for agent selection from external command (e.g., play-circle button)
    vscodeApi.onMessage('selectAgent', data => {
      if (data && data.agentId) {
        // Update the selected agent in the dropdown
        setSelectedAgentId(data.agentId);
        // The AgentSelector component will handle starting the session
      }
    });

    // Request the current configuration
    vscodeApi.getConfiguration('salesforce.agentforceDX.showAgentTracer');
  }, [activeTab]);

  const handleTabChange = (tab: 'preview' | 'tracer') => {
    setActiveTab(tab);
  };

  const handleClientAppRequired = (_data: any) => {
    setClientAppState('required');
  };

  const handleClientAppSelection = (data: any) => {
    setClientAppState('selecting');
    setAvailableClientApps(data.clientApps || []);
  };

  return (
    <div className="app">
      <div className="app-menu">
        <AgentSelector
          onClientAppRequired={handleClientAppRequired}
          onClientAppSelection={handleClientAppSelection}
          selectedAgent={selectedAgentId}
          onAgentChange={setSelectedAgentId}
        />
        {showTracerTab && (
          <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} showTracerTab={showTracerTab} />
        )}
      </div>
      <div className="app-content">
        <div className={`tab-content ${activeTab === 'preview' ? 'active' : 'hidden'}`}>
          <AgentPreview
            clientAppState={clientAppState}
            availableClientApps={availableClientApps}
            onClientAppStateChange={setClientAppState}
            onAvailableClientAppsChange={setAvailableClientApps}
          />
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
