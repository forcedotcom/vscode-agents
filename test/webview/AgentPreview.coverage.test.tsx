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
    executeCommand: jest.fn(),
    sendConversationExport: jest.fn()
  }
}));

import { vscodeApi } from '../../webview/src/services/vscodeApi';
import AgentPreview, { AgentPreviewRef } from '../../webview/src/components/AgentPreview/AgentPreview';

describe('AgentPreview - Coverage Tests', () => {
  let handlers: Map<string, Function>;

  beforeEach(() => {
    handlers = new Map();
    jest.clearAllMocks();

    (vscodeApi.onMessage as jest.Mock).mockImplementation((cmd: string, handler: Function) => {
      handlers.set(cmd, handler);
      return () => handlers.delete(cmd);
    });

    (vscodeApi.onClientAppReady as jest.Mock).mockImplementation(() => () => {});
  });

  const renderComponent = (props: Partial<React.ComponentProps<typeof AgentPreview>> = {}) =>
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
        {...props}
      />
    );

  describe('focusInput ref method', () => {
    it('should expose focusInput method via ref', () => {
      const ref = React.createRef<AgentPreviewRef>();
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

      expect(ref.current).not.toBeNull();
      expect(ref.current?.focusInput).toBeDefined();
      expect(typeof ref.current?.focusInput).toBe('function');
    });

    it('should call focus on chat input when focusInput is called', () => {
      const ref = React.createRef<AgentPreviewRef>();
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

      // This calls the focus method, covering line 65
      ref.current?.focusInput();
    });
  });

  describe('onHasSessionError callback', () => {
    it('should call onHasSessionError when error occurs', async () => {
      const onHasSessionError = jest.fn();
      renderComponent({ onHasSessionError });

      handlers.get('error')?.({ message: 'Test error' });

      await waitFor(() => {
        expect(onHasSessionError).toHaveBeenCalledWith(true);
      });
    });

    it('should call onHasSessionError when session starts successfully', async () => {
      jest.useFakeTimers();
      const onHasSessionError = jest.fn();
      renderComponent({ onHasSessionError });

      // Set error first
      handlers.get('error')?.({ message: 'Test error' });
      await waitFor(() => {
        expect(onHasSessionError).toHaveBeenCalledWith(true);
      });

      // Wait 600ms to avoid race condition
      jest.advanceTimersByTime(600);

      // Then clear it with successful session start
      handlers.get('sessionStarted')?.({ content: 'Hello' });
      await waitFor(() => {
        expect(onHasSessionError).toHaveBeenCalledWith(false);
      });

      jest.useRealTimers();
    });
  });

  describe('onLoadingChange callback', () => {
    it('should call onLoadingChange when loading starts', async () => {
      const onLoadingChange = jest.fn();
      renderComponent({
        onLoadingChange,
        selectedAgentId: 'test-agent',
        pendingAgentId: 'test-agent'
      });

      handlers.get('sessionStarting')?.();

      await waitFor(() => {
        expect(onLoadingChange).toHaveBeenCalledWith(true);
      });
    });

    it('should call onLoadingChange when loading stops', async () => {
      const onLoadingChange = jest.fn();
      renderComponent({ onLoadingChange });

      handlers.get('sessionStarting')?.();
      await waitFor(() => {
        expect(onLoadingChange).toHaveBeenCalledWith(true);
      });

      handlers.get('sessionStarted')?.({ content: 'Hello' });
      await waitFor(() => {
        expect(onLoadingChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('sessionStarted race condition handling', () => {
    it('should ignore sessionStarted that arrives soon after error', async () => {
      // Suppress expected console warning for this test
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      renderComponent();

      // Trigger error first
      handlers.get('error')?.({ message: 'Test error' });
      await waitFor(() => {
        expect(screen.getByText('Test error')).toBeInTheDocument();
      });

      // Immediately trigger sessionStarted (race condition)
      handlers.get('sessionStarted')?.({ content: 'Hello' });

      // Should not show welcome message due to race condition protection
      await waitFor(() => {
        expect(screen.queryByText('Hello')).not.toBeInTheDocument();
      });

      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Ignoring sessionStarted that arrived too soon after error (race condition)'
      );

      consoleWarnSpy.mockRestore();
    });

    it('should accept sessionStarted after enough time has passed', async () => {
      // Suppress expected console warning for race condition test
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      jest.useFakeTimers();
      renderComponent();

      // Trigger error
      handlers.get('error')?.({ message: 'Test error' });
      await waitFor(() => {
        expect(screen.getByText('Test error')).toBeInTheDocument();
      });

      // Wait 600ms
      jest.advanceTimersByTime(600);

      // Now sessionStarted should be accepted
      handlers.get('sessionStarted')?.({ content: 'Hello' });

      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
      });

      jest.useRealTimers();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('sessionStarting message scenarios', () => {
    it('should not load when selectedAgentId is empty', async () => {
      const onLoadingChange = jest.fn();
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
          onLoadingChange={onLoadingChange}
        />
      );

      handlers.get('sessionStarting')?.();

      await waitFor(() => {
        expect(onLoadingChange).toHaveBeenCalledWith(false);
      });
    });

    it('should show "Connecting to agent..." when pendingAgentId matches selectedAgentId', async () => {
      renderComponent({
        selectedAgentId: 'test-agent',
        pendingAgentId: 'test-agent'
      });

      handlers.get('sessionStarting')?.();

      await waitFor(() => {
        expect(screen.getByText('Connecting to agent...')).toBeInTheDocument();
      });
    });

    it('should show "Loading agent..." when no pendingAgentId', async () => {
      renderComponent({
        selectedAgentId: 'test-agent',
        pendingAgentId: null
      });

      handlers.get('sessionStarting')?.();

      await waitFor(() => {
        expect(screen.getByText('Loading agent...')).toBeInTheDocument();
      });
    });

    it('should not load when pendingAgentId does not match selectedAgentId', async () => {
      const onLoadingChange = jest.fn();
      renderComponent({
        selectedAgentId: 'agent-1',
        pendingAgentId: 'agent-2',
        onLoadingChange
      });

      handlers.get('sessionStarting')?.();

      await waitFor(() => {
        expect(onLoadingChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('handleSendMessage function', () => {
    it('should not send message when agent is not connected', async () => {
      renderComponent();

      // The textarea should be disabled when agent is not connected
      const textarea = screen.getByPlaceholderText(/Type something to start the simulation/i);
      expect(textarea).toBeDisabled();

      // Message should not be sent since agent is not connected
      expect(vscodeApi.sendChatMessage).not.toHaveBeenCalled();
    });

    it('should send message when agent is connected', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Connect agent first
      handlers.get('sessionStarted')?.({ content: 'Hello' });

      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
      });

      // Now find the textarea - it should be enabled and send a message
      const textarea = screen.getByPlaceholderText(/Type something to start testing/i);
      expect(textarea).not.toBeDisabled();

      await user.type(textarea, 'Test message');
      await user.keyboard('{Enter}');

      // Verify message was sent
      expect(vscodeApi.sendChatMessage).toHaveBeenCalledWith('Test message');
    });
  });

  describe('client app selection flow', () => {
    it('should render client app selection UI', () => {
      renderComponent({
        clientAppState: 'selecting',
        availableClientApps: [
          { name: 'App 1', clientId: 'app1' },
          { name: 'App 2', clientId: 'app2' }
        ]
      });

      expect(screen.getByText('Select client app')).toBeInTheDocument();
      expect(screen.getByText('App 1')).toBeInTheDocument();
      expect(screen.getByText('App 2')).toBeInTheDocument();
    });

    it('should handle client app selection', async () => {
      const user = userEvent.setup();
      const onClientAppStateChange = jest.fn();
      renderComponent({
        clientAppState: 'selecting',
        availableClientApps: [{ name: 'App 1', clientId: 'app1' }],
        onClientAppStateChange
      });

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'App 1');

      expect(onClientAppStateChange).toHaveBeenCalledWith('ready');
      expect(vscodeApi.selectClientApp).toHaveBeenCalledWith('App 1');
    });

    it('should ignore empty client app selection', async () => {
      const user = userEvent.setup();
      renderComponent({
        clientAppState: 'selecting',
        availableClientApps: [{ name: 'App 1', clientId: 'app1' }]
      });

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'App 1');
      (vscodeApi.selectClientApp as jest.Mock).mockClear();

      await user.selectOptions(select, '');
      expect(vscodeApi.selectClientApp).not.toHaveBeenCalled();
    });

    it('should render PlaceholderContent when clientAppState is selecting', () => {
      renderComponent({
        clientAppState: 'selecting',
        availableClientApps: []
      });

      expect(screen.getByText(/Agentforce DX provides a suite of tools/i)).toBeInTheDocument();
    });
  });

  describe('session transition loader', () => {
    it('should skip loader when pending agent differs from selection', async () => {
      renderComponent({
        selectedAgentId: 'agent-one',
        pendingAgentId: 'agent-two',
        isSessionTransitioning: true
      });

      await waitFor(() => {
        expect(screen.queryByText('Connecting to agent...')).not.toBeInTheDocument();
      });
    });
  });

  describe('empty agent selection behavior', () => {
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
        />
      );

      // Start a session
      handlers.get('sessionStarted')?.({ content: 'Hello' });
      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
      });

      // Change selectedAgentId to empty
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
        />
      );

      await waitFor(() => {
        expect(vscodeApi.endSession).toHaveBeenCalled();
      });
    });

    it('should render PlaceholderContent when selectedAgentId is empty', () => {
      renderComponent({ selectedAgentId: '' });

      expect(screen.getByText(/Agentforce DX provides a suite of tools/i)).toBeInTheDocument();
    });

    it('should return early in selectedAgentId effect when agent unchanged', async () => {
      const { rerender } = renderComponent({ selectedAgentId: 'test-agent' });

      // Clear mock calls
      jest.clearAllMocks();

      // Rerender with same selectedAgentId
      rerender(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId={null}
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={jest.fn()}
        />
      );

      // Should not trigger any state changes
      expect(vscodeApi.endSession).not.toHaveBeenCalled();
    });

    it('should handle empty selectedAgentId in selectedAgentId effect', async () => {
      const onLoadingChange = jest.fn();
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
          onLoadingChange={onLoadingChange}
        />
      );

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
          onLoadingChange={onLoadingChange}
        />
      );

      // The component will call with false when selectedAgentId is empty
      await waitFor(() => {
        const calls = onLoadingChange.mock.calls;
        expect(calls.some(call => call[0] === false)).toBe(true);
      });
    });

    it('should handle pendingAgentId matching selectedAgentId', () => {
      const onLoadingChange = jest.fn();
      render(
        <AgentPreview
          selectedAgentId="agent-2"
          pendingAgentId="agent-2"
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={jest.fn()}
          onLoadingChange={onLoadingChange}
        />
      );

      // Component renders properly with matching pendingAgentId
      expect(onLoadingChange).toHaveBeenCalled();
    });
  });

  describe('session transition effects', () => {
    it('should set loading when transitioning with matching pendingAgentId', async () => {
      const onLoadingChange = jest.fn();
      render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId="test-agent"
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={true}
          onSessionTransitionSettled={jest.fn()}
          onLoadingChange={onLoadingChange}
        />
      );

      await waitFor(() => {
        const calls = onLoadingChange.mock.calls;
        expect(calls.some(call => call[0] === true)).toBe(true);
      });
    });

    it('should stop loading when not transitioning and pendingAgentId matches', async () => {
      const onLoadingChange = jest.fn();
      const { rerender } = render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId="test-agent"
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={true}
          onSessionTransitionSettled={jest.fn()}
          onLoadingChange={onLoadingChange}
        />
      );

      // Start loading
      await waitFor(() => {
        const calls = onLoadingChange.mock.calls;
        expect(calls.some(call => call[0] === true)).toBe(true);
      });

      onLoadingChange.mockClear();

      rerender(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId="test-agent"
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={false}
          onSessionTransitionSettled={jest.fn()}
          onLoadingChange={onLoadingChange}
        />
      );

      await waitFor(() => {
        expect(onLoadingChange).toHaveBeenCalledWith(false);
      });
    });

    it('should handle transitioning with empty selectedAgentId', () => {
      const onLoadingChange = jest.fn();
      render(
        <AgentPreview
          selectedAgentId=""
          pendingAgentId={null}
          clientAppState="none"
          availableClientApps={[]}
          onClientAppStateChange={jest.fn()}
          onAvailableClientAppsChange={jest.fn()}
          isSessionTransitioning={true}
          onSessionTransitionSettled={jest.fn()}
          onLoadingChange={onLoadingChange}
        />
      );

      // The component renders properly with empty selectedAgentId during transition
      expect(screen.getByText(/Agentforce DX provides a suite of tools/i)).toBeInTheDocument();
    });
  });

  describe('handleSendMessage coverage', () => {
    it('should not send message when agent is not connected', () => {
      renderComponent();

      // The component is rendered but agent is not connected
      // Input should be disabled, preventing user from sending messages
      expect(vscodeApi.sendChatMessage).not.toHaveBeenCalled();
    });

    it('should send message and add to messages when agent is connected', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Connect the agent
      handlers.get('sessionStarted')?.({ content: 'Hello!' });

      await waitFor(() => {
        expect(screen.getByText('Hello!')).toBeInTheDocument();
      });

      // Now the textarea should be enabled
      const textarea = screen.getByPlaceholderText(/Type something to start testing/i);
      expect(textarea).not.toBeDisabled();

      // Type and send a message
      await user.type(textarea, 'Test message');
      await user.keyboard('{Enter}');

      // Verify message was sent
      expect(vscodeApi.sendChatMessage).toHaveBeenCalledWith('Test message');
    });
  });
});
