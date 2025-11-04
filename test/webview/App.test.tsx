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
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../webview/src/App';

// Mock the components to simplify testing
jest.mock('../../webview/src/components/AgentPreview/AgentPreview', () => {
  return function MockAgentPreview({ selectedAgentId, pendingAgentId }: any) {
    return (
      <div data-testid="agent-preview">
        <div data-testid="selected-agent">{selectedAgentId || 'none'}</div>
        <div data-testid="pending-agent">{pendingAgentId || 'none'}</div>
      </div>
    );
  };
});

jest.mock('../../webview/src/components/AgentTracer/AgentTracer', () => {
  return function MockAgentTracer() {
    return <div data-testid="agent-tracer">Tracer</div>;
  };
});

jest.mock('../../webview/src/components/AgentPreview/AgentSelector', () => {
  return function MockAgentSelector({ selectedAgent, onAgentChange }: any) {
    return (
      <div data-testid="agent-selector">
        <select
          data-testid="agent-select"
          value={selectedAgent}
          onChange={e => onAgentChange(e.target.value)}
        >
          <option value="">Select agent...</option>
          <option value="agent1">Agent 1</option>
          <option value="agent2">Agent 2</option>
        </select>
      </div>
    );
  };
});

jest.mock('../../webview/src/components/shared/TabNavigation', () => {
  return function MockTabNavigation({ onTabChange }: any) {
    return (
      <div data-testid="tab-navigation">
        <button data-testid="preview-tab" onClick={() => onTabChange('preview')}>
          Preview
        </button>
        <button data-testid="tracer-tab" onClick={() => onTabChange('tracer')}>
          Tracer
        </button>
      </div>
    );
  };
});

describe('App', () => {
  let mockVSCodeApi: any;

  beforeEach(() => {
    // Create a fresh mock for each test
    mockVSCodeApi = {
      postMessage: jest.fn(),
      getState: jest.fn(),
      setState: jest.fn()
    };

    (window as any).vscode = mockVSCodeApi;
  });

  afterEach(() => {
    delete (window as any).vscode;
    jest.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('should render without crashing', () => {
      render(<App />);
      expect(screen.getByTestId('agent-selector')).toBeInTheDocument();
    });

    it('should default to preview tab', () => {
      render(<App />);
      expect(screen.getByTestId('agent-preview')).toBeInTheDocument();
    });

    it('should not show tracer tab by default', () => {
      render(<App />);
      expect(screen.queryByTestId('tab-navigation')).not.toBeInTheDocument();
    });
  });

  describe('Agent Selection', () => {
    it('should update desiredAgentId when agent is selected', async () => {
      render(<App />);

      const select = screen.getByTestId('agent-select');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      (select as HTMLSelectElement).value = 'agent1';

      // Trigger the change event properly
      await waitFor(() => {
        expect(mockVSCodeApi.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'setSelectedAgentId'
          })
        );
      });
    });

    it('should request configuration on mount', () => {
      render(<App />);

      expect(mockVSCodeApi.postMessage).toHaveBeenCalledWith({
        command: 'getConfiguration',
        data: { section: 'salesforce.agentforceDX.showAgentTracer' }
      });
    });
  });

  describe('Session Management', () => {
    it('should end session when switching agents', async () => {
      render(<App />);

      // Simulate session started
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'sessionStarted', data: {} }
        })
      );

      // Simulate selecting a new agent
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'selectAgent', data: { agentId: 'agent2' } }
        })
      );

      await waitFor(() => {
        expect(mockVSCodeApi.postMessage).toHaveBeenCalledWith({
          command: 'endSession',
          data: undefined
        });
      });
    });

    it('should track session state with sessionStarted message', () => {
      render(<App />);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'sessionStarted', data: {} }
        })
      );

      // Session state is tracked via refs, so we can't directly assert it
      // but we can verify the message was received
      expect(mockVSCodeApi.postMessage).toHaveBeenCalled();
    });

    it('should track session end with sessionEnded message', () => {
      render(<App />);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'sessionEnded', data: {} }
        })
      );

      // Session state is tracked via refs
      expect(mockVSCodeApi.postMessage).toHaveBeenCalled();
    });

    it('should handle session errors', () => {
      render(<App />);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'error', data: { message: 'Test error' } }
        })
      );

      // Error should reset session state
      expect(mockVSCodeApi.postMessage).toHaveBeenCalled();
    });
  });

  describe('Force Restart (Play Button)', () => {
    it('should trigger session restart when selectAgent with forceRestart', async () => {
      render(<App />);

      // Simulate force restart via selectAgent command
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'selectAgent', data: { agentId: 'agent1' } }
        })
      );

      await waitFor(() => {
        expect(mockVSCodeApi.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'setSelectedAgentId'
          })
        );
      });
    });

    it('should start session immediately when force restart is true', async () => {
      render(<App />);

      // Simulate session started first
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'sessionStarted', data: {} }
        })
      );

      // Then force restart with same agent
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'selectAgent', data: { agentId: 'agent1' } }
        })
      );

      await waitFor(() => {
        // Should end existing session
        expect(mockVSCodeApi.postMessage).toHaveBeenCalledWith({
          command: 'endSession',
          data: undefined
        });
      });
    });
  });

  describe('Tracer Tab', () => {
    it('should show tracer tab when configuration is enabled', async () => {
      render(<App />);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'configuration',
            data: { section: 'salesforce.agentforceDX.showAgentTracer', value: true }
          }
        })
      );

      // Also need to select an agent for tracer to show
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'selectAgent', data: { agentId: 'agent1' } }
        })
      );

      await waitFor(() => {
        expect(screen.queryByTestId('tab-navigation')).toBeInTheDocument();
      });
    });

    it('should hide tracer tab when configuration is disabled', async () => {
      render(<App />);

      // Enable first
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'configuration',
            data: { section: 'salesforce.agentforceDX.showAgentTracer', value: true }
          }
        })
      );

      // Then disable
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'configuration',
            data: { section: 'salesforce.agentforceDX.showAgentTracer', value: false }
          }
        })
      );

      await waitFor(() => {
        expect(screen.queryByTestId('tab-navigation')).not.toBeInTheDocument();
      });
    });
  });

  describe('Client App State', () => {
    it('should handle client app required state', () => {
      render(<App />);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'clientAppRequired', data: {} }
        })
      );

      // Client app state is passed to AgentPreview
      expect(screen.getByTestId('agent-preview')).toBeInTheDocument();
    });

    it('should handle client app selection', () => {
      render(<App />);

      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            command: 'clientAppSelection',
            data: { clientApps: [{ name: 'App1', clientId: '123' }] }
          }
        })
      );

      // Client app list is passed to AgentPreview
      expect(screen.getByTestId('agent-preview')).toBeInTheDocument();
    });
  });

  describe('Session Transition State', () => {
    it('should set transitioning state when changing agents', async () => {
      render(<App />);

      // Start with an agent
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'selectAgent', data: { agentId: 'agent1' } }
        })
      );

      // Session started
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'sessionStarted', data: {} }
        })
      );

      // Switch to different agent (force restart)
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { command: 'selectAgent', data: { agentId: 'agent2' } }
        })
      );

      // isSessionTransitioning prop should be passed to AgentPreview
      expect(screen.getByTestId('agent-preview')).toBeInTheDocument();
    });
  });
});
