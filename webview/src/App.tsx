import React, { useState, useEffect, useRef, useCallback } from 'react';
import AgentPreview, { AgentPreviewRef } from './components/AgentPreview/AgentPreview.js';
import AgentTracer from './components/AgentTracer/AgentTracer.js';
import AgentSelector from './components/AgentPreview/AgentSelector.js';
import TabNavigation from './components/shared/TabNavigation.js';
import { vscodeApi, AgentInfo } from './services/vscodeApi.js';
import './App.css';

interface SelectAgentMessage {
  agentId: string;
  forceRestart?: boolean;
}

declare global {
  interface Window {
    __agentforceDXAppTestHooks?: {
      waitForSessionEnd: () => Promise<void>;
      setSessionActiveFlag: (active: boolean) => void;
      getPendingStartResolvers: () => number;
      getDisplayedAgentId: () => string;
    };
  }
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'preview' | 'tracer'>('preview');
  const [displayedAgentId, setDisplayedAgentIdState] = useState('');
  const [desiredAgentId, setDesiredAgentId] = useState('');
  const [restartTrigger, setRestartTrigger] = useState(0);
  const [isSessionTransitioning, setIsSessionTransitioning] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isSessionStarting, setIsSessionStarting] = useState(false);
  const [hasSessionError, setHasSessionError] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [selectedAgentInfo, setSelectedAgentInfo] = useState<AgentInfo | null>(null);
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
      if (!data || typeof data.agentId === 'undefined') {
        return;
      }

      // Update the selected agent in the dropdown (even when clearing selection)
      setDesiredAgentId(data.agentId);
      vscodeApi.setSelectedAgentId(data.agentId);

      if (data.agentId === '') {
        // Clear the view immediately when the provider resets the selection
        vscodeApi.clearMessages();
        return;
      }

      if (data.forceRestart) {
        // Restart Agent button clicked - force immediate restart
        forceRestartRef.current = true;
        setRestartTrigger(prev => prev + 1);
      } else {
        // Palette selection - let history flow decide whether to show saved conversation or placeholder
        // Don't clear messages here - let the backend's showHistoryOrPlaceholder handle it atomically
        // to avoid flickering between clear and load
        vscodeApi.loadAgentHistory(data.agentId);
      }
    });

    const disposeRefreshAgents = vscodeApi.onMessage('refreshAgents', () => {
      // Switch back to preview tab when refreshing agents
      setActiveTab('preview');
    });

    const disposeSetLiveMode = vscodeApi.onMessage('setLiveMode', (data: { isLiveMode: boolean }) => {
      if (data && typeof data.isLiveMode === 'boolean') {
        setIsLiveMode(data.isLiveMode);
      }
    });

    // Test command handlers for integration tests
    const disposeTestStartSession = vscodeApi.onMessage('testStartSession', (data: { agentId?: string; isLiveMode?: boolean }) => {
      const agentId = data?.agentId || desiredAgentIdRef.current;
      const liveMode = data?.isLiveMode !== undefined ? data.isLiveMode : isLiveMode;
      
      if (agentId) {
        console.log('[Webview Test] testStartSession received:', { agentId, isLiveMode: liveMode });
        // Set live mode if provided
        if (data?.isLiveMode !== undefined) {
          setIsLiveMode(liveMode);
        }
        // Trigger session start by setting desired agent and forcing restart
        setDesiredAgentId(agentId);
        forceRestartRef.current = true;
        setRestartTrigger(prev => prev + 1);
      } else {
        console.warn('[Webview Test] testStartSession: No agentId provided');
      }
    });

    const disposeTestSendMessage = vscodeApi.onMessage('testSendMessage', (data: { message: string }) => {
      const message = data?.message;
      if (message && agentPreviewRef.current) {
        console.log('[Webview Test] testSendMessage received:', message);
        // Use the ref to send message - we need to expose a method on AgentPreviewRef
        // For now, we'll trigger it through the component's handleSendMessage
        // We'll need to add a method to AgentPreviewRef for this
        agentPreviewRef.current.sendMessage?.(message);
      } else {
        console.warn('[Webview Test] testSendMessage: No message or agentPreviewRef not available');
      }
    });

    const disposeTestEndSession = vscodeApi.onMessage('testEndSession', () => {
      console.log('[Webview Test] testEndSession received');
      vscodeApi.endSession();
    });

    const disposeTestGetTrace = vscodeApi.onMessage('testGetTrace', () => {
      console.log('[Webview Test] testGetTrace received');
      vscodeApi.getTraceData();
    });

    const disposeTestSwitchTab = vscodeApi.onMessage('testSwitchTab', (data: { tab: 'preview' | 'tracer' }) => {
      const tab = data?.tab || 'preview';
      console.log('[Webview Test] testSwitchTab received:', tab);
      setActiveTab(tab);
    });

    // Request initial live mode state from extension
    vscodeApi.getInitialLiveMode();

    return () => {
      disposeSelectAgent();
      disposeRefreshAgents();
      disposeSetLiveMode();
      disposeTestStartSession();
      disposeTestSendMessage();
      disposeTestEndSession();
      disposeTestGetTrace();
      disposeTestSwitchTab();
    };
  }, []);

  const handleTabChange = (tab: 'preview' | 'tracer') => {
    setActiveTab(tab);
  };

  const handleLiveModeChange = useCallback((isLive: boolean) => {
    setIsLiveMode(isLive);
    // Notify the provider to persist the selection
    vscodeApi.setLiveMode(isLive);
  }, []);

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
      // Switch to preview tab when starting a new session
      setActiveTab('preview');
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
    if (process.env.NODE_ENV === 'test' && typeof window !== 'undefined') {
      window.__agentforceDXAppTestHooks = {
        waitForSessionEnd,
        setSessionActiveFlag: (active: boolean) => {
          sessionActiveRef.current = active;
        },
        getPendingStartResolvers: () => sessionStartResolversRef.current.length,
        getDisplayedAgentId: () => displayedAgentIdRef.current
      };
      return () => {
        delete window.__agentforceDXAppTestHooks;
      };
    }
  }, [waitForSessionEnd]);

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
          vscodeApi.startSession(nextAgentId, { isLiveMode });
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
  }, [
    desiredAgentId,
    restartTrigger,
    waitForSessionEnd,
    waitForSessionStart,
    handleSessionTransitionSettled,
    isLiveMode
  ]);

  const previewAgentId = desiredAgentId !== '' ? desiredAgentId : displayedAgentId;
  const pendingAgentId = desiredAgentId !== displayedAgentId ? desiredAgentId : null;

  return (
    <div className="app">
      <div className="app-menu">
        <AgentSelector
          selectedAgent={desiredAgentId}
          onAgentChange={handleAgentChange}
          isSessionActive={isSessionActive}
          isSessionStarting={isSessionStarting}
          onLiveModeChange={handleLiveModeChange}
          initialLiveMode={isLiveMode}
          onSelectedAgentInfoChange={setSelectedAgentInfo}
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
            isSessionTransitioning={isSessionTransitioning}
            onSessionTransitionSettled={handleSessionTransitionSettled}
            selectedAgentId={previewAgentId}
            pendingAgentId={pendingAgentId}
            onHasSessionError={setHasSessionError}
            isLiveMode={isLiveMode}
            selectedAgentInfo={selectedAgentInfo}
            onLiveModeChange={handleLiveModeChange}
          />
        </div>
        <div className={`tab-content ${activeTab === 'tracer' ? 'active' : 'hidden'}`}>
          <AgentTracer
            onGoToPreview={handleGoToPreview}
            isSessionActive={isSessionActive}
            isLiveMode={isLiveMode}
            selectedAgentInfo={selectedAgentInfo}
            onLiveModeChange={handleLiveModeChange}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
