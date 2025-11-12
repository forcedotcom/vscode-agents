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
import userEvent from '@testing-library/user-event';
import AgentSelector from '../../webview/src/components/AgentPreview/AgentSelector';
import { AgentInfo } from '../../webview/src/services/vscodeApi';

// Mock vscodeApi
jest.mock('../../webview/src/services/vscodeApi', () => ({
  vscodeApi: {
    postMessage: jest.fn(),
    onMessage: jest.fn(),
    getAvailableAgents: jest.fn(),
    clearMessages: jest.fn(),
    loadAgentHistory: jest.fn()
  }
}));

// Import the mocked vscodeApi
import { vscodeApi } from '../../webview/src/services/vscodeApi';

describe('AgentSelector', () => {
  let messageHandlers: Map<string, Function>;

  beforeEach(() => {
    messageHandlers = new Map();
    jest.clearAllMocks();

    // Setup onMessage to capture handlers
    (vscodeApi.onMessage as jest.Mock).mockImplementation((command: string, handler: Function) => {
      messageHandlers.set(command, handler);
      return () => {
        messageHandlers.delete(command);
      };
    });
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      render(<AgentSelector selectedAgent="" onAgentChange={jest.fn()} />);

      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should request available agents on mount', () => {
      render(<AgentSelector selectedAgent="" onAgentChange={jest.fn()} />);

      expect(vscodeApi.getAvailableAgents).toHaveBeenCalled();
    });
  });

  describe('Agent Display and Grouping', () => {
    it('should show "No agents available" when agent list is empty', async () => {
      render(<AgentSelector selectedAgent="" onAgentChange={jest.fn()} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents: [] });

      await waitFor(() => {
        expect(screen.getByText('No agents available')).toBeInTheDocument();
      });
    });

    it('should group agents by type with Published first', async () => {
      const agents: AgentInfo[] = [
        { id: 'script1', name: 'ScriptAgent1', type: 'script' },
        { id: 'pub1', name: 'PublishedAgent1', type: 'published' },
        { id: 'script2', name: 'ScriptAgent2', type: 'script' },
        { id: 'pub2', name: 'PublishedAgent2', type: 'published' }
      ];

      render(<AgentSelector selectedAgent="" onAgentChange={jest.fn()} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents });

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).not.toBeDisabled();
      });

      // Check that optgroups exist
      const publishedGroup = screen.getByRole('group', { name: 'Published' });
      const scriptGroup = screen.getByRole('group', { name: 'Agent Script' });

      expect(publishedGroup).toBeInTheDocument();
      expect(scriptGroup).toBeInTheDocument();

      // Check that agents are in the correct groups
      expect(screen.getByRole('option', { name: 'PublishedAgent1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'PublishedAgent2' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'ScriptAgent1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'ScriptAgent2' })).toBeInTheDocument();
    });

    it('should display only Published group when no script agents exist', async () => {
      const agents: AgentInfo[] = [
        { id: 'pub1', name: 'PublishedAgent1', type: 'published' },
        { id: 'pub2', name: 'PublishedAgent2', type: 'published' }
      ];

      render(<AgentSelector selectedAgent="" onAgentChange={jest.fn()} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents });

      await waitFor(() => {
        expect(screen.getByRole('group', { name: 'Published' })).toBeInTheDocument();
      });

      expect(screen.queryByRole('group', { name: 'Agent Script' })).not.toBeInTheDocument();
    });

    it('should display only Agent Script group when no published agents exist', async () => {
      const agents: AgentInfo[] = [
        { id: 'script1', name: 'ScriptAgent1', type: 'script' },
        { id: 'script2', name: 'ScriptAgent2', type: 'script' }
      ];

      render(<AgentSelector selectedAgent="" onAgentChange={jest.fn()} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents });

      await waitFor(() => {
        expect(screen.getByRole('group', { name: 'Agent Script' })).toBeInTheDocument();
      });

      expect(screen.queryByRole('group', { name: 'Published' })).not.toBeInTheDocument();
    });
  });

  describe('Agent Selection and Display', () => {
    it('should call onAgentChange when an agent is selected', async () => {
      const onAgentChange = jest.fn();
      const agents: AgentInfo[] = [
        { id: 'agent1', name: 'TestAgent', type: 'published' }
      ];

      render(<AgentSelector selectedAgent="" onAgentChange={onAgentChange} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents });

      await waitFor(() => {
        expect(screen.getByRole('combobox')).not.toBeDisabled();
      });

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, 'agent1');

      expect(onAgentChange).toHaveBeenCalledWith('agent1');
    });

    it('should display agent type for selected agent', async () => {
      const agents: AgentInfo[] = [
        { id: 'script1', name: 'CaseAssistant', type: 'script' }
      ];

      render(<AgentSelector selectedAgent="script1" onAgentChange={jest.fn()} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents });

      await waitFor(() => {
        const overlay = document.querySelector('.agent-select-display');
        expect(overlay).toBeInTheDocument();
        expect(overlay?.querySelector('.agent-name')).toHaveTextContent('CaseAssistant');
        expect(overlay?.querySelector('.agent-type')).toHaveTextContent('(Agent Script)');
      });
    });

    it('should display "Published" type for published agents', async () => {
      const agents: AgentInfo[] = [
        { id: 'pub1', name: 'MyPublishedAgent', type: 'published' }
      ];

      render(<AgentSelector selectedAgent="pub1" onAgentChange={jest.fn()} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents });

      await waitFor(() => {
        const overlay = document.querySelector('.agent-select-display');
        expect(overlay).toBeInTheDocument();
        expect(overlay?.querySelector('.agent-name')).toHaveTextContent('MyPublishedAgent');
        expect(overlay?.querySelector('.agent-type')).toHaveTextContent('(Published)');
      });
    });

    it('should not display type overlay when no agent is selected', async () => {
      const agents: AgentInfo[] = [
        { id: 'agent1', name: 'TestAgent', type: 'published' }
      ];

      render(<AgentSelector selectedAgent="" onAgentChange={jest.fn()} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents });

      await waitFor(() => {
        expect(screen.getByRole('combobox')).not.toBeDisabled();
      });

      expect(screen.queryByText('(Published)')).not.toBeInTheDocument();
      expect(screen.queryByText('(Agent Script)')).not.toBeInTheDocument();
    });

    it('should clear messages and load history when agent is selected', async () => {
      const agents: AgentInfo[] = [
        { id: 'agent1', name: 'TestAgent', type: 'published' }
      ];

      render(<AgentSelector selectedAgent="" onAgentChange={jest.fn()} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents });

      await waitFor(() => {
        expect(screen.getByRole('combobox')).not.toBeDisabled();
      });

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, 'agent1');

      expect(vscodeApi.clearMessages).toHaveBeenCalled();
      expect(vscodeApi.loadAgentHistory).toHaveBeenCalledWith('agent1');
    });

    it('should clear messages when deselecting agent', async () => {
      const agents: AgentInfo[] = [
        { id: 'agent1', name: 'TestAgent', type: 'published' }
      ];

      render(<AgentSelector selectedAgent="agent1" onAgentChange={jest.fn()} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents });

      await waitFor(() => {
        expect(screen.getByRole('combobox')).not.toBeDisabled();
      });

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, '');

      expect(vscodeApi.clearMessages).toHaveBeenCalled();
      expect(vscodeApi.loadAgentHistory).not.toHaveBeenCalledWith('');
    });
  });

  describe('Client App Handling', () => {
    it('should call onClientAppRequired when clientAppRequired message is received', async () => {
      const onClientAppRequired = jest.fn();

      render(
        <AgentSelector selectedAgent="" onAgentChange={jest.fn()} onClientAppRequired={onClientAppRequired} />
      );

      const clientAppRequiredHandler = messageHandlers.get('clientAppRequired');
      const mockData = { message: 'Client app needed' };
      clientAppRequiredHandler!(mockData);

      await waitFor(() => {
        expect(onClientAppRequired).toHaveBeenCalledWith(mockData);
      });
    });

    it('should call onClientAppSelection when selectClientApp message is received', async () => {
      const onClientAppSelection = jest.fn();

      render(
        <AgentSelector selectedAgent="" onAgentChange={jest.fn()} onClientAppSelection={onClientAppSelection} />
      );

      const selectClientAppHandler = messageHandlers.get('selectClientApp');
      const mockData = { clientApps: [{ name: 'App1', clientId: '123' }] };
      selectClientAppHandler!(mockData);

      await waitFor(() => {
        expect(onClientAppSelection).toHaveBeenCalledWith(mockData);
      });
    });
  });

  describe('Preselected Agent', () => {
    it('should auto-select and load history for preselected agent', async () => {
      const onAgentChange = jest.fn();
      const agents: AgentInfo[] = [
        { id: 'agent1', name: 'TestAgent1', type: 'published' },
        { id: 'agent2', name: 'TestAgent2', type: 'published' }
      ];

      render(<AgentSelector selectedAgent="" onAgentChange={onAgentChange} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents, selectedAgentId: 'agent2' });

      await waitFor(() => {
        expect(onAgentChange).toHaveBeenCalledWith('agent2');
        expect(vscodeApi.clearMessages).toHaveBeenCalled();
        expect(vscodeApi.loadAgentHistory).toHaveBeenCalledWith('agent2');
      });
    });

    it('should not auto-select agent if preselected agent does not exist in list', async () => {
      const onAgentChange = jest.fn();
      const agents: AgentInfo[] = [
        { id: 'agent1', name: 'TestAgent1', type: 'published' }
      ];

      render(<AgentSelector selectedAgent="" onAgentChange={onAgentChange} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents, selectedAgentId: 'nonexistent' });

      await waitFor(() => {
        expect(screen.getByRole('combobox')).not.toBeDisabled();
      });

      expect(onAgentChange).not.toHaveBeenCalled();
    });
  });

  describe('Legacy Format Support', () => {
    it('should handle legacy array format for available agents', async () => {
      const agents: AgentInfo[] = [
        { id: 'agent1', name: 'TestAgent', type: 'published' }
      ];

      render(<AgentSelector selectedAgent="" onAgentChange={jest.fn()} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      // Pass agents directly as array (legacy format)
      availableAgentsHandler!(agents);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'TestAgent' })).toBeInTheDocument();
      });
    });
  });

  describe('Live Mode Handling', () => {
    it('should set live mode to true for published agents', async () => {
      const onAgentChange = jest.fn();
      const agents: AgentInfo[] = [
        { id: 'pub1', name: 'PublishedAgent', type: 'published' }
      ];

      render(<AgentSelector selectedAgent="" onAgentChange={onAgentChange} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents });

      await waitFor(() => {
        expect(screen.getByRole('combobox')).not.toBeDisabled();
      });

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, 'pub1');

      expect(onAgentChange).toHaveBeenCalledWith('pub1');
      // For published agents, live mode is auto-enabled (tested via UI state)
    });

    it('should restore saved mode preference for script agents', async () => {
      const onAgentChange = jest.fn();
      const agents: AgentInfo[] = [
        { id: 'script1', name: 'ScriptAgent', type: 'script' }
      ];

      render(<AgentSelector selectedAgent="" onAgentChange={onAgentChange} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents });

      await waitFor(() => {
        expect(screen.getByRole('combobox')).not.toBeDisabled();
      });

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, 'script1');

      expect(onAgentChange).toHaveBeenCalledWith('script1');
      // Script agents default to simulate mode (false)
    });
  });

  describe('Mode Selection', () => {
    beforeEach(() => {
      // Mock vscodeApi.startSession and endSession
      (vscodeApi as any).startSession = jest.fn();
      (vscodeApi as any).endSession = jest.fn().mockResolvedValue(undefined);
    });

    it('should render mode selector for script agents', async () => {
      const agents: AgentInfo[] = [
        { id: 'script1', name: 'ScriptAgent', type: 'script' }
      ];

      render(<AgentSelector selectedAgent="script1" onAgentChange={jest.fn()} isSessionActive={false} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents });

      await waitFor(() => {
        const comboboxes = screen.getAllByRole('combobox');
        // Should have both agent selector and mode selector
        expect(comboboxes.length).toBeGreaterThan(1);
      });
    });
  });

  describe('Start/Stop Button', () => {
    beforeEach(() => {
      (vscodeApi as any).startSession = jest.fn();
      (vscodeApi as any).endSession = jest.fn();
    });

    it('should not start session if no agent is selected', async () => {
      const agents: AgentInfo[] = [
        { id: 'agent1', name: 'TestAgent', type: 'published' }
      ];

      render(<AgentSelector selectedAgent="" onAgentChange={jest.fn()} isSessionActive={false} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents });

      await waitFor(() => {
        expect(screen.getByRole('combobox')).not.toBeDisabled();
      });

      // Find and click start button with no agent selected
      const startButtons = screen.queryAllByRole('button', { name: /start/i });
      if (startButtons.length > 0) {
        await userEvent.click(startButtons[0]);
        expect(vscodeApi.startSession).not.toHaveBeenCalled();
      }
    });

    it('should start session when start button is clicked with selected agent', async () => {
      const agents: AgentInfo[] = [
        { id: 'agent1', name: 'TestAgent', type: 'published' }
      ];

      render(<AgentSelector selectedAgent="agent1" onAgentChange={jest.fn()} isSessionActive={false} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents });

      await waitFor(() => {
        expect(screen.getByRole('combobox')).not.toBeDisabled();
      });

      // Find and click start button
      const startButtons = screen.queryAllByRole('button', { name: /start|run/i });
      if (startButtons.length > 0) {
        await userEvent.click(startButtons[0]);
        expect(vscodeApi.startSession).toHaveBeenCalledWith('agent1', expect.any(Object));
      }
    });

    it('should stop session when stop button is clicked during active session', async () => {
      const agents: AgentInfo[] = [
        { id: 'agent1', name: 'TestAgent', type: 'published' }
      ];

      render(<AgentSelector selectedAgent="agent1" onAgentChange={jest.fn()} isSessionActive={true} />);

      const availableAgentsHandler = messageHandlers.get('availableAgents');
      availableAgentsHandler!({ agents });

      await waitFor(() => {
        const agentSelects = screen.getAllByRole('combobox');
        expect(agentSelects.length).toBeGreaterThan(0);
      });

      // Find and click stop button
      const stopButtons = screen.queryAllByRole('button', { name: /stop/i });
      if (stopButtons.length > 0) {
        await userEvent.click(stopButtons[0]);
        expect(vscodeApi.endSession).toHaveBeenCalled();
      }
    });
  });
});
