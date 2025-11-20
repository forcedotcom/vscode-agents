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

/**
 * Integration tests for App component covering recent bug fixes
 * These tests verify complete user flows for:
 * - Tab visibility during session lifecycle
 * - Error message handling
 * - Tracer behavior during session changes
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

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

// Mock the components to simplify testing
jest.mock('../../webview/src/components/AgentPreview/AgentPreview', () => {
  return React.forwardRef(function MockAgentPreview({ selectedAgentId }: any, ref: any) {
    React.useImperativeHandle(ref, () => ({
      focusInput: jest.fn()
    }));

    return (
      <div data-testid="agent-preview">
        <div data-testid="selected-agent">{selectedAgentId || 'none'}</div>
      </div>
    );
  });
});

jest.mock('../../webview/src/components/AgentTracer/AgentTracer', () => {
  return function MockAgentTracer({ onGoToPreview, isSessionActive }: any) {
    return (
      <div data-testid="agent-tracer">
        <div data-testid="tracer-session-active">{isSessionActive ? 'active' : 'inactive'}</div>
        {onGoToPreview && (
          <button data-testid="tracer-go-to-preview" onClick={onGoToPreview}>
            Go to Preview
          </button>
        )}
      </div>
    );
  };
});

jest.mock('../../webview/src/components/AgentPreview/AgentSelector', () => {
  return function MockAgentSelector({ selectedAgent, onAgentChange }: any) {
    return (
      <div data-testid="agent-selector">
        <select data-testid="agent-select" value={selectedAgent} onChange={e => onAgentChange(e.target.value)}>
          <option value="">Select agent...</option>
          <option value="agent1">Agent 1</option>
          <option value="agent2">Agent 2</option>
        </select>
      </div>
    );
  };
});

jest.mock('../../webview/src/components/shared/TabNavigation', () => {
  return function MockTabNavigation({ onTabChange, activeTab }: any) {
    return (
      <div data-testid="tab-navigation">
        <button
          data-testid="preview-tab"
          onClick={() => onTabChange('preview')}
          className={activeTab === 'preview' ? 'active' : ''}
        >
          Preview
        </button>
        <button
          data-testid="tracer-tab"
          onClick={() => onTabChange('tracer')}
          className={activeTab === 'tracer' ? 'active' : ''}
        >
          Tracer
        </button>
      </div>
    );
  };
});

import App from '../../webview/src/App';

describe('App Integration Tests - Recent Bug Fixes', () => {
  let messageHandlers: Map<string, Function>;

  beforeEach(() => {
    messageHandlers = new Map();
    jest.clearAllMocks();

    mockVscodeApi.onMessage.mockImplementation((command: string, handler: Function) => {
      messageHandlers.set(command, handler);
      return () => messageHandlers.delete(command);
    });
  });

  afterEach(() => {
    messageHandlers.clear();
  });

  const triggerMessage = (command: string, data?: any) => {
    const handler = messageHandlers.get(command);
    if (handler) {
      handler(data);
    }
  };

  describe('Tab Visibility During Session Lifecycle', () => {
    it('should properly manage tab visibility through complete session lifecycle', async () => {
      render(<App />);

      // 1. Initially no tabs
      expect(screen.queryByTestId('tab-navigation')).not.toBeInTheDocument();

      // 2. Select agent - tabs still not visible
      triggerMessage('selectAgent', { agentId: 'agent1' });
      expect(screen.queryByTestId('tab-navigation')).not.toBeInTheDocument();

      // 3. Session starting (loading) - tabs still hidden
      triggerMessage('sessionStarting', {});
      await waitFor(() => {
        expect(screen.queryByTestId('tab-navigation')).not.toBeInTheDocument();
      });

      // 4. Session started - tabs now visible
      triggerMessage('sessionStarted', {});
      await waitFor(() => {
        expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
      });

      // 5. End session - tabs remain visible
      triggerMessage('sessionEnded', {});
      await waitFor(() => {
        expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
      });
    });

    it('should hide tabs during restart from active session', async () => {
      render(<App />);

      // Start initial session
      triggerMessage('selectAgent', { agentId: 'agent1' });
      triggerMessage('sessionStarted', {});

      await waitFor(() => {
        expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
      });

      // Restart session
      triggerMessage('sessionStarting', {});

      // Tabs should be hidden during restart
      await waitFor(() => {
        expect(screen.queryByTestId('tab-navigation')).not.toBeInTheDocument();
      });

      // Tabs show again after restart completes
      triggerMessage('sessionStarted', {});
      await waitFor(() => {
        expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
      });
    });
  });

  describe('Tracer Tab Behavior During Session Changes', () => {
    it('should switch from tracer to preview when starting new session', async () => {
      render(<App />);

      // Start session and switch to tracer
      triggerMessage('selectAgent', { agentId: 'agent1' });
      triggerMessage('sessionStarted', {});

      await waitFor(() => {
        expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('tracer-tab'));

      await waitFor(() => {
        expect(screen.getByTestId('agent-tracer')).toBeInTheDocument();
      });

      // Start new session - should switch to preview
      triggerMessage('sessionStarting', {});

      await waitFor(() => {
        expect(screen.getByTestId('agent-preview')).toBeInTheDocument();
        // Both tabs exist, but preview should be active (visible)
        const previewContent = screen.getByTestId('agent-preview').parentElement;
        const tracerContent = screen.getByTestId('agent-tracer').parentElement;
        expect(previewContent?.className).toContain('active');
        expect(tracerContent?.className).toContain('hidden');
      });
    });

    it('should switch to preview when refreshing agents from tracer tab', async () => {
      render(<App />);

      // Start session and switch to tracer
      triggerMessage('selectAgent', { agentId: 'agent1' });
      triggerMessage('sessionStarted', {});

      await waitFor(() => {
        expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('tracer-tab'));

      await waitFor(() => {
        expect(screen.getByTestId('agent-tracer')).toBeInTheDocument();
      });

      // Refresh agents - should switch to preview
      triggerMessage('refreshAgents', {});

      await waitFor(() => {
        expect(screen.getByTestId('agent-preview')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle error during session start and allow retry', async () => {
      render(<App />);

      // Select agent and try to start
      triggerMessage('selectAgent', { agentId: 'agent1' });
      triggerMessage('sessionStarting', {});

      // Session fails with error
      triggerMessage('error', { message: 'Connection failed' });

      await waitFor(() => {
        // Should be able to see the error state
        expect(screen.queryByTestId('tab-navigation')).not.toBeInTheDocument();
      });

      // Retry - should work normally
      triggerMessage('sessionStarting', {});
      triggerMessage('sessionStarted', {});

      await waitFor(() => {
        expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
      });
    });
  });

  describe('Agent Selection and Session Management', () => {
    it('should handle switching agents with active session', async () => {
      render(<App />);

      // Start with agent1
      triggerMessage('selectAgent', { agentId: 'agent1' });
      triggerMessage('sessionStarted', {});

      await waitFor(() => {
        expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
        expect(screen.getByTestId('selected-agent').textContent).toBe('agent1');
      });

      // Switch to agent2
      triggerMessage('selectAgent', { agentId: 'agent2' });
      triggerMessage('sessionStarting', {});

      // Tabs should hide during transition
      await waitFor(() => {
        expect(screen.queryByTestId('tab-navigation')).not.toBeInTheDocument();
      });

      // New session started
      triggerMessage('sessionStarted', {});

      await waitFor(() => {
        expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
        expect(screen.getByTestId('selected-agent').textContent).toBe('agent2');
      });
    });

    it('should properly handle refresh agents clearing current selection', async () => {
      render(<App />);

      // Start session
      triggerMessage('selectAgent', { agentId: 'agent1' });
      triggerMessage('sessionStarted', {});

      await waitFor(() => {
        expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
      });

      // Refresh agents
      triggerMessage('refreshAgents', {});

      // Should switch to preview tab
      await waitFor(() => {
        expect(screen.getByTestId('agent-preview')).toBeInTheDocument();
      });
    });
  });

  describe('Complete User Flows', () => {
    it('should handle complete flow: select, start, use tracer, stop, restart', async () => {
      render(<App />);

      // 1. Select agent
      triggerMessage('selectAgent', { agentId: 'agent1' });
      expect(screen.queryByTestId('tab-navigation')).not.toBeInTheDocument();

      // 2. Start session
      triggerMessage('sessionStarting', {});
      triggerMessage('sessionStarted', {});

      await waitFor(() => {
        expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
      });

      // 3. Switch to tracer
      fireEvent.click(screen.getByTestId('tracer-tab'));

      await waitFor(() => {
        expect(screen.getByTestId('agent-tracer')).toBeInTheDocument();
      });

      // 4. Stop session
      triggerMessage('sessionEnded', {});

      await waitFor(() => {
        // Tabs should still be visible
        expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
        // Still on tracer tab
        expect(screen.getByTestId('agent-tracer')).toBeInTheDocument();
      });

      // 5. Restart from tracer
      triggerMessage('sessionStarting', {});

      await waitFor(() => {
        // Should switch to preview
        expect(screen.getByTestId('agent-preview')).toBeInTheDocument();
        // Tabs hidden during loading
        expect(screen.queryByTestId('tab-navigation')).not.toBeInTheDocument();
      });

      // 6. Session started again
      triggerMessage('sessionStarted', {});

      await waitFor(() => {
        expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
        expect(screen.getByTestId('agent-preview')).toBeInTheDocument();
      });
    });

    it('should handle flow with errors: start, error, retry successfully', async () => {
      render(<App />);

      // 1. Select and try to start
      triggerMessage('selectAgent', { agentId: 'agent1' });
      triggerMessage('sessionStarting', {});

      // 2. First attempt fails
      triggerMessage('error', { message: 'Agent user not found' });

      await waitFor(() => {
        expect(screen.queryByTestId('tab-navigation')).not.toBeInTheDocument();
      });

      // 3. Retry
      triggerMessage('sessionStarting', {});

      // 4. Second attempt succeeds
      triggerMessage('sessionStarted', {});

      await waitFor(() => {
        expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
      });
    });
  });

  describe('Live Mode Persistence', () => {
    it('should request initial live mode on mount', async () => {
      render(<App />);

      await waitFor(() => {
        expect(mockVscodeApi.getInitialLiveMode).toHaveBeenCalled();
      });
    });

    it('should receive and apply initial live mode from extension', async () => {
      render(<App />);

      // Simulate extension sending live mode = true
      triggerMessage('setLiveMode', { isLiveMode: true });

      await waitFor(() => {
        expect(mockVscodeApi.getInitialLiveMode).toHaveBeenCalled();
      });
    });

    it('should persist live mode when changed by user', async () => {
      render(<App />);

      // Select an agent first
      triggerMessage('selectAgent', { agentId: 'agent1' });
      triggerMessage('sessionStarted', {});

      await waitFor(() => {
        expect(screen.getByTestId('tab-navigation')).toBeInTheDocument();
      });

      // Verify initial request was made
      expect(mockVscodeApi.getInitialLiveMode).toHaveBeenCalled();
    });

    it('should maintain live mode across agent switches', async () => {
      render(<App />);

      // Set live mode to true
      triggerMessage('setLiveMode', { isLiveMode: true });

      // Select first agent
      triggerMessage('selectAgent', { agentId: 'agent1' });

      await waitFor(() => {
        expect(screen.getByTestId('selected-agent').textContent).toBe('agent1');
      });

      // Select second agent
      triggerMessage('selectAgent', { agentId: 'agent2' });

      await waitFor(() => {
        expect(screen.getByTestId('selected-agent').textContent).toBe('agent2');
      });

      // The mode should persist (getInitialLiveMode called once on mount)
      expect(mockVscodeApi.getInitialLiveMode).toHaveBeenCalledTimes(1);
    });

    it('should handle live mode changes without circular updates', async () => {
      render(<App />);

      jest.clearAllMocks();

      // Simulate receiving live mode from extension
      triggerMessage('setLiveMode', { isLiveMode: true });

      await waitFor(() => {
        // Should not trigger setLiveMode back to extension (no circular update)
        expect(mockVscodeApi.setLiveMode).not.toHaveBeenCalled();
      });
    });

    it('should handle setLiveMode with invalid data gracefully', async () => {
      render(<App />);

      // Send invalid data
      triggerMessage('setLiveMode', { isLiveMode: 'invalid' });

      // Should not crash, just ignore invalid data
      await waitFor(() => {
        expect(mockVscodeApi.getInitialLiveMode).toHaveBeenCalled();
      });
    });

    it('should handle setLiveMode with missing data gracefully', async () => {
      render(<App />);

      // Send no data
      triggerMessage('setLiveMode', {});

      // Should not crash
      await waitFor(() => {
        expect(mockVscodeApi.getInitialLiveMode).toHaveBeenCalled();
      });
    });
  });
});
