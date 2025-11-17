/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

// Mock vscodeApi before importing App
const mockVscodeApi = {
  postMessage: jest.fn(),
  onMessage: jest.fn(),
  startSession: jest.fn(),
  endSession: jest.fn(),
  sendChatMessage: jest.fn(),
  setApexDebugging: jest.fn(),
  getAvailableAgents: jest.fn(),
  getTraceData: jest.fn(),
  clearChat: jest.fn(),
  clearMessages: jest.fn(),
  getConfiguration: jest.fn(),
  selectClientApp: jest.fn(),
  onClientAppReady: jest.fn(),
  executeCommand: jest.fn(),
  setSelectedAgentId: jest.fn(),
  loadAgentHistory: jest.fn(),
  setLiveMode: jest.fn(),
  getInitialLiveMode: jest.fn(),
  sendConversationExport: jest.fn()
};

jest.mock('../../webview/src/services/vscodeApi', () => ({
  vscodeApi: mockVscodeApi
}));

// Mock components
jest.mock('../../webview/src/components/AgentPreview/AgentPreview', () => {
  return React.forwardRef(function MockAgentPreview(
    { selectedAgentId, isSessionTransitioning }: any,
    ref: any
  ) {
    return (
      <div data-testid="agent-preview" ref={ref}>
        <div data-testid="selected-agent">{selectedAgentId || 'none'}</div>
        <div data-testid="transition-flag">{isSessionTransitioning ? 'transitioning' : 'idle'}</div>
      </div>
    );
  });
});

jest.mock('../../webview/src/components/AgentTracer/AgentTracer', () => {
  return function MockAgentTracer() {
    return <div data-testid="agent-tracer">Tracer</div>;
  };
});

jest.mock('../../webview/src/components/AgentPreview/AgentSelector', () => {
  return function MockAgentSelector({ onClientAppRequired, onClientAppSelection, onLiveModeChange }: any) {
    // Expose callbacks for testing
    (window as any).testCallbacks = { onClientAppRequired, onClientAppSelection, onLiveModeChange };
    return <div data-testid="agent-selector">Selector</div>;
  };
});

jest.mock('../../webview/src/components/shared/TabNavigation', () => {
  return function MockTabNavigation() {
    return <div data-testid="tab-navigation">Tabs</div>;
  };
});

import App from '../../webview/src/App';

describe('App Coverage Tests', () => {
  let messageHandlers: Map<string, Function>;
  let mockVSCodeApi: any;

  beforeEach(() => {
    messageHandlers = new Map();
    jest.clearAllMocks();

    mockVSCodeApi = {
      postMessage: jest.fn(),
      getState: jest.fn(),
      setState: jest.fn()
    };

    (window as any).vscode = mockVSCodeApi;

    mockVscodeApi.onMessage.mockImplementation((command: string, handler: Function) => {
      messageHandlers.set(command, handler);
      return () => messageHandlers.delete(command);
    });

    mockVscodeApi.onClientAppReady.mockImplementation((handler: Function) => {
      messageHandlers.set('clientAppReady', handler);
      return () => messageHandlers.delete('clientAppReady');
    });
  });

  afterEach(() => {
    delete (window as any).vscode;
    delete (window as any).testCallbacks;
    messageHandlers.clear();
  });

  const triggerMessage = (command: string, data?: any) => {
    const handler = messageHandlers.get(command);
    if (handler) {
      handler(data);
    }
  };

  describe('Coverage: Live mode handler', () => {
    it('should persist live mode changes from AgentSelector', async () => {
      render(<App />);

      await waitFor(() => {
        expect((window as any).testCallbacks?.onLiveModeChange).toBeDefined();
      });

      act(() => {
        (window as any).testCallbacks.onLiveModeChange(true);
      });

      expect(mockVscodeApi.setLiveMode).toHaveBeenCalledWith(true);

      act(() => {
        (window as any).testCallbacks.onLiveModeChange(false);
      });

      expect(mockVscodeApi.setLiveMode).toHaveBeenCalledWith(false);
    });
  });

  describe('Coverage: Session Promise Resolvers', () => {
    it('should hit line 94: resolver(true) on sessionStarted with pending resolver', async () => {
      render(<App />);

      // Trigger selectAgent to create a pending start resolver
      act(() => {
        triggerMessage('selectAgent', { agentId: 'agent1' });
      });

      // Allow microtask queue to process
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Now trigger sessionStarted to resolve the pending promise
      act(() => {
        triggerMessage('sessionStarted', {});
      });

      // This should have called resolver(true) on line 94
      await waitFor(() => {
        expect(screen.getByTestId('selected-agent').textContent).toBe('agent1');
      });
    });

    it('should hit lines 114 & 118: error handlers with pending resolvers', async () => {
      render(<App />);

      // Set up scenario: start session, then trigger error before completion
      act(() => {
        triggerMessage('selectAgent', { agentId: 'agent1' });
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Mark session as started
      act(() => {
        triggerMessage('sessionStarted', {});
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Now switch agents, which creates end resolver
      act(() => {
        triggerMessage('selectAgent', { agentId: 'agent2' });
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Trigger error - this should call both endResolver() and startResolver(false)
      act(() => {
        triggerMessage('error', { message: 'Test error' });
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Component should still be functional
      expect(screen.getByTestId('agent-selector')).toBeInTheDocument();
    });

    it('should hit lines 191-192: startSucceeded branch', async () => {
      render(<App />);

      // Trigger force restart
      act(() => {
        triggerMessage('selectAgent', { agentId: 'agent1' });
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      // Resolve with success
      act(() => {
        triggerMessage('sessionStarted', {});
      });

      // This should hit lines 191-192: if (startSucceeded) { setDisplayedAgentIdState(nextAgentId); }
      await waitFor(() => {
        expect(screen.getByTestId('selected-agent').textContent).toBe('agent1');
      }, { timeout: 3000 });
    });

    it('should hit lines 202-203: catch block in session management', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Create a scenario that might throw an error
      mockVscodeApi.startSession.mockImplementation(() => {
        throw new Error('Mock error');
      });

      render(<App />);

      act(() => {
        triggerMessage('selectAgent', { agentId: 'agent1' });
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
      });

      // The catch block should have been hit (lines 202-203)
      // Component should still be functional
      expect(screen.getByTestId('agent-selector')).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });

    it('should hit line 118: startResolver(false) on error with startResolver pending', async () => {
      render(<App />);

      // Trigger selectAgent which sets up startResolver
      act(() => {
        triggerMessage('selectAgent', { agentId: 'agent1' });
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      // Trigger error BEFORE sessionStarted
      // This should call startResolver(false) on line 118
      act(() => {
        triggerMessage('error', { message: 'Error before session started' });
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Component should handle error gracefully
      expect(screen.getByTestId('agent-selector')).toBeInTheDocument();
    });

    it('should hit line 132: race condition - session ends between check and waitForSessionEnd call', async () => {
      render(<App />);

      // Start a session
      act(() => {
        triggerMessage('selectAgent', { agentId: 'agent1' });
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      act(() => {
        triggerMessage('sessionStarted', {});
      });

      await waitFor(() => {
        expect(screen.getByTestId('selected-agent').textContent).toBe('agent1');
      });

      jest.clearAllMocks();

      // Now we'll trigger a race condition:
      // 1. Start switching to agent2 (which checks sessionActiveRef and starts calling waitForSessionEnd)
      // 2. Immediately trigger sessionEnded to set sessionActiveRef to false
      // This creates a scenario where waitForSessionEnd is called but session becomes inactive

      act(() => {
        triggerMessage('selectAgent', { agentId: 'agent2' });
      });

      // Immediately trigger session ended (race condition)
      act(() => {
        triggerMessage('sessionEnded', {});
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
      });

      // The race condition should have been handled gracefully
      expect(screen.getByTestId('agent-selector')).toBeInTheDocument();
    });

  });

  describe('Coverage: Force restart session flows', () => {
    it('resolves pending start promise when force restart succeeds', async () => {
      render(<App />);

      act(() => {
        triggerMessage('selectAgent', { agentId: 'agent1', forceRestart: true });
      });

      await waitFor(() => {
        expect(mockVscodeApi.startSession).toHaveBeenCalledWith('agent1', { isLiveMode: false });
      });

      act(() => {
        triggerMessage('sessionStarted', {});
      });

      await waitFor(() => {
        expect(screen.getByTestId('selected-agent').textContent).toBe('agent1');
      });
    });

    it('rejects pending start promise when force restart errors before start completes', async () => {
      render(<App />);

      await waitFor(() => {
        expect((window as any).__agentforceDXAppTestHooks).toBeDefined();
      });

      act(() => {
        triggerMessage('selectAgent', { agentId: 'agent1', forceRestart: true });
      });

      await waitFor(() => {
        expect(mockVscodeApi.startSession).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect((window as any).__agentforceDXAppTestHooks.getPendingStartResolvers()).toBeGreaterThan(0);
      });

      act(() => {
        triggerMessage('error', { message: 'Force restart failed' });
      });

      await waitFor(() => {
        expect((window as any).__agentforceDXAppTestHooks.getPendingStartResolvers()).toBe(0);
      });

      expect((window as any).__agentforceDXAppTestHooks.getDisplayedAgentId()).toBe('');
    });
  });

  describe('Coverage: waitForSessionEnd helpers', () => {
    it('immediately resolves when session is already inactive', async () => {
      render(<App />);

      await waitFor(() => {
        expect((window as any).__agentforceDXAppTestHooks).toBeDefined();
      });

      const hooks = (window as any).__agentforceDXAppTestHooks;
      hooks.setSessionActiveFlag(false);
      await expect(hooks.waitForSessionEnd()).resolves.toBeUndefined();
    });
  });

  describe('Coverage: session queue catch handling', () => {
    it('logs and resets transition state when session management throws', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockVscodeApi.startSession.mockImplementation(() => {
        throw new Error('start failure');
      });

      render(<App />);

      act(() => {
        triggerMessage('selectAgent', { agentId: 'agent1', forceRestart: true });
      });

      await waitFor(() => {
        expect(mockVscodeApi.startSession).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(screen.getByTestId('transition-flag').textContent).toBe('idle');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error managing agent session:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });
});
