import '@testing-library/jest-dom';
import React from 'react';
import { render, waitFor } from '@testing-library/react';

const mockVscodeApi = {
  postMessage: jest.fn(),
  onMessage: jest.fn(),
  startSession: jest.fn(),
  endSession: jest.fn(),
  sendChatMessage: jest.fn(),
  clearMessages: jest.fn(),
  executeCommand: jest.fn(),
  sendConversationExport: jest.fn()
};

jest.mock('../../webview/src/services/vscodeApi', () => ({
  vscodeApi: mockVscodeApi
}));

const formPropsRef: { current?: any } = {};

jest.mock('../../webview/src/components/AgentPreview/FormContainer', () => {
  const React = require('react');
  return React.forwardRef((props: any, _ref: any) => {
    formPropsRef.current = props;
    return <div data-testid="form-container" />;
  });
});

import AgentPreview from '../../webview/src/components/AgentPreview/AgentPreview';

describe('AgentPreview send message guard', () => {
  let messageHandlers: Map<string, Function>;

  beforeEach(() => {
    formPropsRef.current = undefined;
    messageHandlers = new Map();
    jest.clearAllMocks();

    mockVscodeApi.onMessage.mockImplementation((command: string, handler: Function) => {
      messageHandlers.set(command, handler);
      return () => messageHandlers.delete(command);
    });

  });

  const renderPreview = (overrides: Partial<React.ComponentProps<typeof AgentPreview>> = {}) => {
    const buildElement = (props: Partial<React.ComponentProps<typeof AgentPreview>>) => (
      <AgentPreview
        selectedAgentId="agent-one"
        pendingAgentId={null}
        isSessionTransitioning={false}
        onSessionTransitionSettled={jest.fn()}
        isLiveMode={false}
        isSessionActive
        {...props}
      />
    );
    const utils = render(buildElement(overrides));
    return {
      ...utils,
      update: (next: Partial<React.ComponentProps<typeof AgentPreview>>) => utils.rerender(buildElement(next))
    };
  };

  it('does not send messages when agent is not connected', async () => {
    renderPreview();

    await waitFor(() => {
      expect(formPropsRef.current?.onSendMessage).toBeDefined();
    });

    formPropsRef.current.onSendMessage('Test message');

    expect(mockVscodeApi.sendChatMessage).not.toHaveBeenCalled();
  });

  it('sends messages once the agent is connected', async () => {
    renderPreview();

    await waitFor(() => {
      expect(formPropsRef.current?.onSendMessage).toBeDefined();
    });

    messageHandlers.get('sessionStarted')?.({ content: 'hello' });

    // Wait for React to re-render with agentConnected=true so handleSendMessage updates
    await waitFor(() => {
      expect(formPropsRef.current?.sessionActive).toBe(true);
    });

    formPropsRef.current.onSendMessage('Hello agent');

    expect(mockVscodeApi.sendChatMessage).toHaveBeenCalledWith('Hello agent');
  });

  it('does not send messages when parent reports session as inactive', async () => {
    renderPreview({ isSessionActive: false });

    await waitFor(() => {
      expect(formPropsRef.current?.onSendMessage).toBeDefined();
    });

    // Connect locally so agentConnected is true.
    messageHandlers.get('sessionStarted')?.({ content: 'hello' });

    formPropsRef.current.onSendMessage('Hello agent');

    expect(mockVscodeApi.sendChatMessage).not.toHaveBeenCalled();
  });

  it('does not send messages while a stop is pending', async () => {
    const { update } = renderPreview({ isSessionActive: true });

    await waitFor(() => {
      expect(formPropsRef.current?.onSendMessage).toBeDefined();
    });

    messageHandlers.get('sessionStarted')?.({ content: 'hello' });

    await waitFor(() => {
      expect(formPropsRef.current?.sessionActive).toBe(true);
    });

    // Simulate the parent flipping isStopPending after the user clicked Stop.
    update({ isSessionActive: true, isStopPending: true });

    formPropsRef.current.onSendMessage('Hello agent');

    expect(mockVscodeApi.sendChatMessage).not.toHaveBeenCalled();
    expect(formPropsRef.current?.sessionActive).toBe(false);
  });

  it('does not send messages while a session transition is in flight', async () => {
    const { update } = renderPreview({ isSessionActive: true });

    await waitFor(() => {
      expect(formPropsRef.current?.onSendMessage).toBeDefined();
    });

    messageHandlers.get('sessionStarted')?.({ content: 'hello' });

    await waitFor(() => {
      expect(formPropsRef.current?.sessionActive).toBe(true);
    });

    update({ isSessionActive: true, isSessionTransitioning: true });

    formPropsRef.current.onSendMessage('Hello agent');

    expect(mockVscodeApi.sendChatMessage).not.toHaveBeenCalled();
    expect(formPropsRef.current?.sessionActive).toBe(false);
  });

  it('disables the input the moment the parent reports session inactive after a stop', async () => {
    const { update } = renderPreview({ isSessionActive: true });

    await waitFor(() => {
      expect(formPropsRef.current?.onSendMessage).toBeDefined();
    });

    messageHandlers.get('sessionStarted')?.({ content: 'hello' });

    await waitFor(() => {
      expect(formPropsRef.current?.sessionActive).toBe(true);
    });

    // App optimistically flips isSessionActive to false on Stop click,
    // before the backend confirms with sessionEnded. The input should
    // disable immediately.
    update({ isSessionActive: false, isStopPending: true });

    expect(formPropsRef.current?.sessionActive).toBe(false);
  });

});
