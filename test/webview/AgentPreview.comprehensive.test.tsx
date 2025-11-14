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
    executeCommand: jest.fn()
  }
}));

import { vscodeApi as mockVscodeApi } from '../../webview/src/services/vscodeApi';
import AgentPreview from '../../webview/src/components/AgentPreview/AgentPreview';

describe('AgentPreview - Comprehensive Coverage', () => {
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

  describe('Session Starting Message Handler', () => {
    it('should handle sessionStarting when selectedAgentId is empty', async () => {
      render(
        <AgentPreview
          selectedAgentId=""
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

      const sessionStartingHandler = messageHandlers.get('sessionStarting');
      sessionStartingHandler!();

      await waitFor(() => {
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
    });

    it('should show loading when selectedAgentId matches pendingAgentId', async () => {
      render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId="test-agent"
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={jest.fn()}
          isLiveMode={false}
        />
      );

      const sessionStartingHandler = messageHandlers.get('sessionStarting');
      sessionStartingHandler!();

      await waitFor(() => {
        expect(screen.getByText(/Connecting to agent/)).toBeInTheDocument();
      });
    });

    it('should show loading when pendingAgentId is null', async () => {
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

      const sessionStartingHandler = messageHandlers.get('sessionStarting');
      sessionStartingHandler!();

      await waitFor(() => {
        expect(screen.getByText(/Loading agent/)).toBeInTheDocument();
      });
    });

    it('should not show loading when pendingAgentId does not match', async () => {
      render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId="other-agent"
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={jest.fn()}
          isLiveMode={false}
        />
      );

      const sessionStartingHandler = messageHandlers.get('sessionStarting');
      sessionStartingHandler!();

      await waitFor(() => {
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Compilation Messages', () => {
    it('should handle compilationStarting message', async () => {
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

      const compilationStartingHandler = messageHandlers.get('compilationStarting');
      compilationStartingHandler!({ message: 'Compiling agent code...' });

      await waitFor(() => {
        expect(screen.getByText(/Compiling agent code/)).toBeInTheDocument();
      });
    });

    it('should handle compilationStarting with default message', async () => {
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

      const compilationStartingHandler = messageHandlers.get('compilationStarting');
      compilationStartingHandler!({});

      await waitFor(() => {
        expect(screen.getByText(/Compiling agent/)).toBeInTheDocument();
      });
    });

    it('should handle compilationError message', async () => {
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

      const compilationErrorHandler = messageHandlers.get('compilationError');
      compilationErrorHandler!({ message: 'Syntax error on line 42' });

      await waitFor(() => {
        expect(screen.getByText('Syntax error on line 42')).toBeInTheDocument();
      });
    });

    it('should handle compilationError with default message', async () => {
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

      const compilationErrorHandler = messageHandlers.get('compilationError');
      compilationErrorHandler!({});

      await waitFor(() => {
        expect(screen.getByText('Failed to compile agent')).toBeInTheDocument();
      });
    });
  });

  describe('Simulation Messages', () => {
    it('should handle simulationStarting message', async () => {
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

      const simulationStartingHandler = messageHandlers.get('simulationStarting');
      simulationStartingHandler!({ message: 'Initializing simulation...' });

      await waitFor(() => {
        expect(screen.getByText(/Initializing simulation/)).toBeInTheDocument();
      });
    });

    it('should handle simulationStarting with default message', async () => {
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

      const simulationStartingHandler = messageHandlers.get('simulationStarting');
      simulationStartingHandler!({});

      await waitFor(() => {
        expect(screen.getByText(/Starting simulation/)).toBeInTheDocument();
      });
    });
  });

  describe('Preview Disclaimer', () => {
    it('should queue disclaimer and show with session start', async () => {
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

      // Send disclaimer
      const disclaimerHandler = messageHandlers.get('previewDisclaimer');
      disclaimerHandler!({ message: 'Custom disclaimer text' });

      // Start session
      const sessionStartedHandler = messageHandlers.get('sessionStarted');
      sessionStartedHandler!({ content: 'Hello!' });

      await waitFor(() => {
        expect(screen.getByText('Custom disclaimer text')).toBeInTheDocument();
        expect(screen.getByText('Hello!')).toBeInTheDocument();
      });
    });

    it('should clear pending disclaimer on error', async () => {
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

      // Send disclaimer
      const disclaimerHandler = messageHandlers.get('previewDisclaimer');
      disclaimerHandler!({ message: 'Custom disclaimer text' });

      // Trigger error
      const errorHandler = messageHandlers.get('error');
      errorHandler!({ message: 'Connection failed' });

      await waitFor(() => {
        expect(screen.getByText('Connection failed')).toBeInTheDocument();
      });

      // Start session - disclaimer should not appear
      const sessionStartedHandler = messageHandlers.get('sessionStarted');
      sessionStartedHandler!({ content: 'Hello!' });

      await waitFor(() => {
        expect(screen.queryByText('Custom disclaimer text')).not.toBeInTheDocument();
      });
    });

    it('should clear pending disclaimer on clearMessages', async () => {
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

      // Send disclaimer
      const disclaimerHandler = messageHandlers.get('previewDisclaimer');
      disclaimerHandler!({ message: 'Custom disclaimer text' });

      // Clear messages
      const clearMessagesHandler = messageHandlers.get('clearMessages');
      clearMessagesHandler!();

      // Start session - disclaimer should not appear
      const sessionStartedHandler = messageHandlers.get('sessionStarted');
      sessionStartedHandler!({ content: 'Hello!' });

      await waitFor(() => {
        expect(screen.queryByText('Custom disclaimer text')).not.toBeInTheDocument();
      });
    });
  });

  describe('Debug Messages', () => {
    it('should handle debugModeChanged message', async () => {
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

      const debugModeChangedHandler = messageHandlers.get('debugModeChanged');
      debugModeChangedHandler!({ message: 'Debug mode enabled' });

      await waitFor(() => {
        expect(screen.getByText('Debug mode enabled')).toBeInTheDocument();
      });
    });

    it('should handle debugLogProcessed message', async () => {
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

      const debugLogProcessedHandler = messageHandlers.get('debugLogProcessed');
      debugLogProcessedHandler!({ message: 'Processing log entry...' });

      await waitFor(() => {
        expect(screen.getByText('Processing log entry...')).toBeInTheDocument();
      });
    });

    it('should handle debugLogError message', async () => {
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

      const debugLogErrorHandler = messageHandlers.get('debugLogError');
      debugLogErrorHandler!({ message: 'Debug error occurred' });

      await waitFor(() => {
        expect(screen.getByText('Debug error occurred')).toBeInTheDocument();
      });
    });

    it('should handle debugLogInfo message', async () => {
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

      const debugLogInfoHandler = messageHandlers.get('debugLogInfo');
      debugLogInfoHandler!({ message: 'Info: Connection established' });

      await waitFor(() => {
        expect(screen.getByText('Info: Connection established')).toBeInTheDocument();
      });
    });
  });

  describe('Message Handling', () => {
    it('should handle messageStarting', async () => {
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

      const messageStartingHandler = messageHandlers.get('messageStarting');
      messageStartingHandler!();

      await waitFor(() => {
        expect(screen.getByText(/Agent is thinking/)).toBeInTheDocument();
      });
    });

    it('should handle messageSent without content', async () => {
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

      const messageSentHandler = messageHandlers.get('messageSent');
      messageSentHandler!({});

      // Should just stop loading without adding a message
      await waitFor(() => {
        expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Session State Changes', () => {
    it('should handle sessionEnded message', async () => {
      const onSessionTransitionSettled = jest.fn();

      render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId={null}
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={onSessionTransitionSettled}
          isLiveMode={false}
        />
      );

      // Start a session first
      const sessionStartedHandler = messageHandlers.get('sessionStarted');
      sessionStartedHandler!({ content: 'Hello!' });

      await waitFor(() => {
        expect(screen.getByText('Hello!')).toBeInTheDocument();
      });

      // End the session
      const sessionEndedHandler = messageHandlers.get('sessionEnded');
      sessionEndedHandler!();

      expect(onSessionTransitionSettled).toHaveBeenCalled();
    });

    it('should ignore sessionStarted that arrives too soon after error', async () => {
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

      // Trigger error
      const errorHandler = messageHandlers.get('error');
      errorHandler!({ message: 'Connection failed' });

      await waitFor(() => {
        expect(screen.getByText('Connection failed')).toBeInTheDocument();
      });

      // Immediately trigger sessionStarted (race condition)
      const sessionStartedHandler = messageHandlers.get('sessionStarted');
      sessionStartedHandler!({ content: 'Hello!' });

      // Should not show the welcome message due to race condition prevention
      await waitFor(() => {
        expect(screen.queryByText('Hello!')).not.toBeInTheDocument();
      });
    });
  });

  describe('Client App Selection', () => {
    it('should render client app selection UI', async () => {
      const clientApps = [
        { name: 'App1', clientId: '1' },
        { name: 'App2', clientId: '2' }
      ];

      render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId={null}
          clientAppState="selecting"
          availableClientApps={clientApps}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={jest.fn()}
          isLiveMode={false}
        />
      );

      expect(screen.getByText('Select Client App:')).toBeInTheDocument();
      expect(screen.getByText('App1')).toBeInTheDocument();
      expect(screen.getByText('App2')).toBeInTheDocument();
    });

    it('should call selectClientApp when app is selected', async () => {
      const user = userEvent.setup();
      const onClientAppStateChange = jest.fn();
      const clientApps = [
        { name: 'App1', clientId: '1' },
        { name: 'App2', clientId: '2' }
      ];

      render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId={null}
          clientAppState="selecting"
          availableClientApps={clientApps}
          onClientAppStateChange={onClientAppStateChange}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={jest.fn()}
          isLiveMode={false}
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'App1');

      expect(onClientAppStateChange).toHaveBeenCalledWith('ready');
      expect(mockVscodeApi.selectClientApp).toHaveBeenCalledWith('App1');
    });
  });

  describe('Empty Agent State', () => {
    it('should end session when selectedAgentId becomes empty', async () => {
      const { rerender } = render(
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

      // Start a session
      const sessionStartedHandler = messageHandlers.get('sessionStarted');
      sessionStartedHandler!({ content: 'Hello!' });

      await waitFor(() => {
        expect(screen.getByText('Hello!')).toBeInTheDocument();
      });

      // Change to empty agent
      rerender(
        <AgentPreview
          selectedAgentId=""
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

      expect(mockVscodeApi.endSession).toHaveBeenCalled();
    });
  });

  describe('Sending Messages', () => {
    it('should not send message when agent is not connected', async () => {
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

      // Try to send a message without being connected
      const textarea = screen.queryByRole('textbox');
      if (textarea) {
        await userEvent.type(textarea, 'Test message{Enter}');
      }

      expect(mockVscodeApi.sendChatMessage).not.toHaveBeenCalled();
    });
  });

  describe('Callback Props', () => {
    it('should call onHasSessionError when error state changes', async () => {
      const onHasSessionError = jest.fn();

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
          onHasSessionError={onHasSessionError}
          isLiveMode={false}
        />
      );

      const errorHandler = messageHandlers.get('error');
      errorHandler!({ message: 'Test error' });

      await waitFor(() => {
        expect(onHasSessionError).toHaveBeenCalledWith(true);
      });
    });

    it('should call onLoadingChange when loading state changes', async () => {
      const onLoadingChange = jest.fn();

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
          onLoadingChange={onLoadingChange}
          isLiveMode={false}
        />
      );

      const sessionStartingHandler = messageHandlers.get('sessionStarting');
      sessionStartingHandler!();

      await waitFor(() => {
        expect(onLoadingChange).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('Imperative Handle (Focus)', () => {
    it('should expose focusInput method via ref', () => {
      const ref = React.createRef<any>();
      render(
        <AgentPreview
          ref={ref}
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

      expect(ref.current).toBeTruthy();
      expect(typeof ref.current.focusInput).toBe('function');
    });
  });

  describe('Error Message Filtering', () => {
    it('should filter out "Starting session..." message when error occurs', async () => {
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

      const errorHandler = messageHandlers.get('error');
      errorHandler!({ message: 'Connection failed' });

      await waitFor(() => {
        expect(screen.getByText('Connection failed')).toBeInTheDocument();
        expect(screen.queryByText('Starting session...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Session Transition', () => {
    it('should handle isSessionTransitioning prop changes', async () => {
      const { rerender } = render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId="test-agent"
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={jest.fn()}
          isLiveMode={false}
        />
      );

      // Set transitioning to true
      rerender(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId="test-agent"
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={true}
          onSessionTransitionSettled={jest.fn()}
          isLiveMode={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Connecting to agent/)).toBeInTheDocument();
      });
    });

    it('should handle pendingAgentId change with session transitioning', async () => {
      const { rerender } = render(
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

      // Change pendingAgentId and set transitioning to true
      rerender(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId="test-agent"
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={true}
          onSessionTransitionSettled={jest.fn()}
          isLiveMode={false}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Connecting to agent/)).toBeInTheDocument();
      });
    });
  });

  describe('Conversation History with Disclaimer', () => {
    it('should add default disclaimer when loading conversation history', async () => {
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

      const historyHandler = messageHandlers.get('conversationHistory');
      historyHandler!({
        messages: [
          { id: '1', type: 'user', content: 'Hello', timestamp: new Date().toISOString() }
        ]
      });

      await waitFor(() => {
        expect(screen.getByText(/Agent preview does not provide strict adherence/)).toBeInTheDocument();
        expect(screen.getByText('Hello')).toBeInTheDocument();
      });
    });

    it('should use pending disclaimer when loading conversation history', async () => {
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

      // Set pending disclaimer
      const disclaimerHandler = messageHandlers.get('previewDisclaimer');
      disclaimerHandler!({ message: 'Custom disclaimer for history' });

      // Load history
      const historyHandler = messageHandlers.get('conversationHistory');
      historyHandler!({
        messages: [
          { id: '1', type: 'user', content: 'Hello', timestamp: new Date().toISOString() }
        ]
      });

      await waitFor(() => {
        expect(screen.getByText('Custom disclaimer for history')).toBeInTheDocument();
        expect(screen.getByText('Hello')).toBeInTheDocument();
      });
    });

    it('should handle empty conversation history', async () => {
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

      const historyHandler = messageHandlers.get('conversationHistory');
      historyHandler!({ messages: [] });

      await waitFor(() => {
        expect(screen.queryByText(/Agent preview does not provide strict adherence/)).not.toBeInTheDocument();
      });
    });
  });
});
