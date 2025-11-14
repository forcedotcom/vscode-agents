import React, { useState, useEffect, useRef, useCallback } from 'react';
import AgentPreview, { AgentPreviewRef } from './components/AgentPreview/AgentPreview.js';
import AgentTracer from './components/AgentTracer/AgentTracer.js';
import AgentSelector from './components/AgentPreview/AgentSelector.js';
import TabNavigation from './components/shared/TabNavigation.js';
import { vscodeApi } from './services/vscodeApi.js';
import './App.css';

interface ClientApp {
  name: string;
  clientId: string;
}

interface SelectAgentMessage {
  agentId: string;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'preview' | 'tracer'>('preview');
  const [displayedAgentId, setDisplayedAgentIdState] = useState('');
  const [desiredAgentId, setDesiredAgentId] = useState('');
  const [restartTrigger, setRestartTrigger] = useState(0);
  const [clientAppState, setClientAppState] = useState<'none' | 'required' | 'selecting' | 'ready'>('none');
  const [availableClientApps, setAvailableClientApps] = useState<ClientApp[]>([]);
  const [isSessionTransitioning, setIsSessionTransitioning] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isSessionStarting, setIsSessionStarting] = useState(false);
  const [hasSessionError, setHasSessionError] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const sessionChangeQueueRef = useRef(Promise.resolve());
  const displayedAgentIdRef = useRef<string>('');
  const desiredAgentIdRef = useRef<string>('');
  const forceRestartRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const sessionEndResolversRef = useRef<Array<() => void>>([]);
  const sessionStartResolversRef = useRef<Array<(success: boolean) => void>>([]);
  const agentPreviewRef = useRef<AgentPreviewRef>(null);

  useEffect(() => {
    displayedAgentIdRef.current = displayedAgentId;
  }, [displayedAgentId]);

  useEffect(() => {
    desiredAgentIdRef.current = desiredAgentId;
  }, [desiredAgentId]);

  useEffect(() => {
    const disposeSelectAgent = vscodeApi.onMessage('selectAgent', (data: SelectAgentMessage) => {
      if (data && data.agentId) {
        // Update the selected agent in the dropdown
        forceRestartRef.current = true;
        setDesiredAgentId(data.agentId);
        // Increment restart trigger to force useEffect to run even if agent ID is the same
        setRestartTrigger(prev => prev + 1);
        vscodeApi.setSelectedAgentId(data.agentId);
      }
    });

    const disposeRefreshAgents = vscodeApi.onMessage('refreshAgents', () => {
      // Switch back to preview tab when refreshing agents
      setActiveTab('preview');
    });

    return () => {
      disposeSelectAgent();
      disposeRefreshAgents();
    };
  }, []);

  const handleTabChange = (tab: 'preview' | 'tracer') => {
    setActiveTab(tab);
  };

  const handleGoToPreview = useCallback(() => {
    // If session is not active and we have a desired agent, start the session
    if (!isSessionActive && !isSessionStarting && desiredAgentId) {
      forceRestartRef.current = true;
      setRestartTrigger(prev => prev + 1);
    }

    setActiveTab('preview');
    // Small delay to ensure tab is visible before focusing
    setTimeout(() => {
      agentPreviewRef.current?.focusInput();
    }, 100);
  }, [isSessionActive, isSessionStarting, desiredAgentId]);

  const handleClientAppRequired = useCallback((_data: any) => {
    setClientAppState('required');
  }, []);

  const handleClientAppSelection = useCallback((data: any) => {
    setClientAppState('selecting');
    setAvailableClientApps(data.clientApps || []);
  }, []);

  const handleAgentChange = useCallback((agentId: string) => {
    setDesiredAgentId(agentId);
    // Notify the extension about the selected agent
    vscodeApi.setSelectedAgentId(agentId);
  }, []);

  useEffect(() => {
    const disposeSessionStarted = vscodeApi.onMessage('sessionStarted', () => {
      sessionActiveRef.current = true;
      setIsSessionActive(true);
      setIsSessionStarting(false);
      const resolver = sessionStartResolversRef.current.shift();
      if (resolver) {
        resolver(true);
      }
    });

    const disposeSessionEnded = vscodeApi.onMessage('sessionEnded', () => {
      sessionActiveRef.current = false;
      setIsSessionActive(false);
      setIsSessionStarting(false);
      const resolver = sessionEndResolversRef.current.shift();
      if (resolver) {
        resolver();
      }
    });

    const disposeSessionStarting = vscodeApi.onMessage('sessionStarting', () => {
      sessionActiveRef.current = false;
      setIsSessionActive(false);
      setIsSessionStarting(true);
    });

    const disposeSessionError = vscodeApi.onMessage('error', () => {
      sessionActiveRef.current = false;
      setIsSessionActive(false);
      setIsSessionStarting(false);
      const endResolver = sessionEndResolversRef.current.shift();
      if (endResolver) {
        endResolver();
      }
      const startResolver = sessionStartResolversRef.current.shift();
      if (startResolver) {
        startResolver(false);
      }
    });

    return () => {
      disposeSessionStarted();
      disposeSessionEnded();
      disposeSessionStarting();
      disposeSessionError();
    };
  }, []);

  const waitForSessionEnd = useCallback(() => {
    if (!sessionActiveRef.current) {
      return Promise.resolve();
    }

    return new Promise<void>(resolve => {
      sessionEndResolversRef.current.push(resolve);
    });
  }, []);

  const waitForSessionStart = useCallback(() => {
    return new Promise<boolean>(resolve => {
      sessionStartResolversRef.current.push(resolve);
    });
  }, []);

  const handleSessionTransitionSettled = useCallback(() => {
    setIsSessionTransitioning(false);
  }, []);

  useEffect(() => {
    sessionChangeQueueRef.current = sessionChangeQueueRef.current
      .then(async () => {
        const shouldForceRestart = forceRestartRef.current;
        forceRestartRef.current = false;

        const previousAgentId = displayedAgentIdRef.current;
        const nextAgentId = desiredAgentIdRef.current;
        const hasExistingAgent = previousAgentId !== '';
        const hasTargetAgent = nextAgentId !== '';
        const changingAgents = shouldForceRestart || previousAgentId !== nextAgentId;

        if (!changingAgents && !hasExistingAgent && !hasTargetAgent) {
          return;
        }

        if (changingAgents || shouldForceRestart) {
          setIsSessionTransitioning(true);
        }

        if (hasExistingAgent && (changingAgents || shouldForceRestart) && sessionActiveRef.current) {
          const waitForEnd = waitForSessionEnd();
          vscodeApi.endSession();
          await waitForEnd;
        }

        if (!hasTargetAgent) {
          setDisplayedAgentIdState('');
          handleSessionTransitionSettled();
          return;
        }

        // Handle session start based on context:
        // - shouldForceRestart = true (play/refresh button): Start session immediately
        // - shouldForceRestart = false (dropdown selection): Let history flow handle it
        if (shouldForceRestart && hasTargetAgent) {
          // Play/refresh button clicked - start session immediately
          const waitForStart = waitForSessionStart();
          vscodeApi.startSession(nextAgentId);
          const startSucceeded = await waitForStart;

          if (startSucceeded) {
            setDisplayedAgentIdState(nextAgentId);
          }
        } else if (hasTargetAgent && changingAgents) {
          // Dropdown selection - just update UI, history flow handles session start
          setDisplayedAgentIdState(nextAgentId);
        }

        handleSessionTransitionSettled();
      })
      .catch(err => {
        console.error('Error managing agent session:', err);
        handleSessionTransitionSettled();
      });
  }, [desiredAgentId, restartTrigger, waitForSessionEnd, waitForSessionStart, handleSessionTransitionSettled]);

  const previewAgentId = desiredAgentId !== '' ? desiredAgentId : displayedAgentId;
  const pendingAgentId = desiredAgentId !== displayedAgentId ? desiredAgentId : null;

  return (
    <div className="app">
      <div className="app-menu">
        <AgentSelector
          onClientAppRequired={handleClientAppRequired}
          onClientAppSelection={handleClientAppSelection}
          selectedAgent={desiredAgentId}
          onAgentChange={handleAgentChange}
          isSessionActive={isSessionActive}
          isSessionStarting={isSessionStarting}
          onLiveModeChange={setIsLiveMode}
        />
        <div className="app-menu-divider" />
        {previewAgentId !== '' && !hasSessionError && !isSessionStarting && (
          <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} showTracerTab={true} />
        )}
      </div>
      <div className="app-content">
        <div className={`tab-content ${activeTab === 'preview' ? 'active' : 'hidden'}`}>
          <AgentPreview
            ref={agentPreviewRef}
            clientAppState={clientAppState}
            availableClientApps={availableClientApps}
            onClientAppStateChange={setClientAppState}
            onAvailableClientAppsChange={setAvailableClientApps}
            isSessionTransitioning={isSessionTransitioning}
            onSessionTransitionSettled={handleSessionTransitionSettled}
            selectedAgentId={previewAgentId}
            pendingAgentId={pendingAgentId}
            onHasSessionError={setHasSessionError}
          />
        </div>
        <div className={`tab-content ${activeTab === 'tracer' ? 'active' : 'hidden'}`}>
          <AgentTracer onGoToPreview={handleGoToPreview} isSessionActive={isSessionActive} isLiveMode={isLiveMode} />
        </div>
      </div>
    </div>
  );
};

export default App;
