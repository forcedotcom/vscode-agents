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

// Mock vscodeApi
jest.mock('../../webview/src/services/vscodeApi', () => ({
  vscodeApi: {
    postMessage: jest.fn(),
    onMessage: jest.fn(),
    startSession: jest.fn(),
    endSession: jest.fn(),
    sendChatMessage: jest.fn(),
    clearMessages: jest.fn(),
    selectClientApp: jest.fn(),
    onClientAppReady: jest.fn(),
    sendConversationExport: jest.fn()
  }
}));

import { vscodeApi as mockVscodeApi } from '../../webview/src/services/vscodeApi';
import AgentPreview from '../../webview/src/components/AgentPreview/AgentPreview';

describe('AgentPreview - Placeholder Behavior', () => {
  let messageHandlers: Map<string, Function>;

  beforeEach(() => {
    messageHandlers = new Map();
    jest.clearAllMocks();

    // Setup onMessage to capture handlers
    (mockVscodeApi.onMessage as jest.Mock).mockImplementation((command: string, handler: Function) => {
      messageHandlers.set(command, handler);
      return () => {
        messageHandlers.delete(command);
      };
    });

    // Setup onClientAppReady
    (mockVscodeApi.onClientAppReady as jest.Mock).mockImplementation(() => {
      return () => {};
    });
  });

  describe('noHistoryFound Message Handling', () => {
    it('should show placeholder when noHistoryFound message is received', async () => {
      render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId={null}
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={jest.fn()}
          isLiveMode={false}
        />
      );

      // Trigger noHistoryFound message
      const noHistoryHandler = messageHandlers.get('noHistoryFound');
      expect(noHistoryHandler).toBeDefined();
      noHistoryHandler!({ agentId: 'test-agent' });

      await waitFor(() => {
        expect(screen.getByText(/Agent Preview lets you test an agent by having a conversation/)).toBeInTheDocument();
      });
    });

    it('should show "Start Simulation" button in placeholder when not in live mode', async () => {
      render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId={null}
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={jest.fn()}
          isLiveMode={false}
        />
      );

      const noHistoryHandler = messageHandlers.get('noHistoryFound');
      noHistoryHandler!({ agentId: 'test-agent' });

      await waitFor(() => {
        expect(screen.getByText('Start Simulation')).toBeInTheDocument();
      });
    });

    it('should show "Start Live Test" button in placeholder when in live mode', async () => {
      render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId={null}
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={jest.fn()}
          isLiveMode={true}
        />
      );

      const noHistoryHandler = messageHandlers.get('noHistoryFound');
      noHistoryHandler!({ agentId: 'test-agent' });

      await waitFor(() => {
        expect(screen.getByText('Start Live Test')).toBeInTheDocument();
      });
    });

    it('should start session when placeholder button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId={null}
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={jest.fn()}
          isLiveMode={false}
        />
      );

      const noHistoryHandler = messageHandlers.get('noHistoryFound');
      noHistoryHandler!({ agentId: 'test-agent' });

      await waitFor(() => {
        expect(screen.getByText('Start Simulation')).toBeInTheDocument();
      });

      const startButton = screen.getByText('Start Simulation');
      await user.click(startButton);

      expect(mockVscodeApi.startSession).toHaveBeenCalledWith('test-agent');
    });
  });

  describe('Placeholder State Reset', () => {
    it('should clear placeholder when sessionStarted message is received', async () => {
      render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId={null}
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={jest.fn()}
          isLiveMode={false}
        />
      );

      // Show placeholder
      const noHistoryHandler = messageHandlers.get('noHistoryFound');
      noHistoryHandler!({ agentId: 'test-agent' });

      await waitFor(() => {
        expect(screen.getByText(/Agent Preview lets you test an agent by having a conversation/)).toBeInTheDocument();
      });

      // Trigger session started
      const sessionStartedHandler = messageHandlers.get('sessionStarted');
      sessionStartedHandler!({ content: 'Welcome!' });

      await waitFor(() => {
        expect(screen.queryByText(/Agent Preview lets you test an agent by having a conversation/)).not.toBeInTheDocument();
      });
    });

    it('should clear placeholder when clearMessages is received', async () => {
      render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId={null}
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={jest.fn()}
          isLiveMode={false}
        />
      );

      // Show placeholder
      const noHistoryHandler = messageHandlers.get('noHistoryFound');
      noHistoryHandler!({ agentId: 'test-agent' });

      await waitFor(() => {
        expect(screen.getByText(/Agent Preview lets you test an agent by having a conversation/)).toBeInTheDocument();
      });

      // Clear messages
      const clearMessagesHandler = messageHandlers.get('clearMessages');
      clearMessagesHandler!();

      await waitFor(() => {
        expect(screen.queryByText(/Agent Preview lets you test an agent by having a conversation/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Conversation History Handling', () => {
    it('should not show placeholder when conversationHistory with messages is received', async () => {
      render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId={null}
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={jest.fn()}
          isLiveMode={false}
        />
      );

      // Send conversation history
      const historyHandler = messageHandlers.get('conversationHistory');
      historyHandler!({
        messages: [
          { id: '1', type: 'user', content: 'Hello', timestamp: new Date().toISOString() },
          { id: '2', type: 'agent', content: 'Hi there!', timestamp: new Date().toISOString() }
        ]
      });

      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Hi there!')).toBeInTheDocument();
      });

      // Placeholder should not be shown
      expect(screen.queryByText(/Agent Preview lets you test an agent by having a conversation/)).not.toBeInTheDocument();
    });
  });
});
