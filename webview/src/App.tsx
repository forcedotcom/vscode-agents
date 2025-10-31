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
  const [showTracerTab] = useState<boolean>(true); // Always show tracer tab by default
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [clientAppState, setClientAppState] = useState<'none' | 'required' | 'selecting' | 'ready'>('none');
  const [availableClientApps, setAvailableClientApps] = useState<ClientApp[]>([]);

  useEffect(() => {
    // Listen for agent selection from external command (e.g., play-circle button or context menu)
    // This will load history and start the session
    vscodeApi.onMessage('selectAgent', data => {
      if (data && data.agentId) {
        // End any existing session
        vscodeApi.endSession();
        // Update the selected agent in the dropdown
        setSelectedAgentId(data.agentId);
        // Clear panel, load history, and start the session
        setTimeout(() => {
          vscodeApi.loadAgentHistory(data.agentId);
          vscodeApi.startSession(data.agentId);
        }, 100);
      }
    });
  }, []); // Empty dependency array means this runs once on mount

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

  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    // Notify the extension about the selected agent
    vscodeApi.setSelectedAgentId(agentId);
  };

  return (
    <div className="app">
      <div className="app-menu">
        <AgentSelector
          onClientAppRequired={handleClientAppRequired}
          onClientAppSelection={handleClientAppSelection}
          selectedAgent={selectedAgentId}
          onAgentChange={handleAgentChange}
        />
        {showTracerTab && selectedAgentId !== '' && (
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
            selectedAgentId={selectedAgentId}
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
