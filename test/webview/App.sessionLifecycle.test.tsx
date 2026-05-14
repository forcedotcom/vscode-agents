/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

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
  executeCommand: jest.fn(),
  setSelectedAgentId: jest.fn(),
  loadAgentHistory: jest.fn(),
  setLiveMode: jest.fn(),
  getInitialLiveMode: jest.fn(),
  sendConversationExport: jest.fn()
};

jest.mock('../../webview/src/services/vscodeApi', () => ({
  vscodeApi: mockVscodeApi,
  AgentSource: {
    SCRIPT: 'script',
    PUBLISHED: 'published'
  }
}));

// Capture the props that App passes to AgentSelector and AgentPreview so each
// test can assert on the lifecycle flags as the user clicks Start/Stop and
// the backend sends messages.
const selectorPropsRef: { current?: any } = {};
const previewPropsRef: { current?: any } = {};

jest.mock('../../webview/src/components/AgentPreview/AgentSelector', () => {
  const React = require('react');
  return function MockAgentSelector(props: any) {
    selectorPropsRef.current = props;
    return (
      <div data-testid="agent-selector">
        <button data-testid="start-button" onClick={() => props.onStartSession?.()}>
          Start
        </button>
        <button data-testid="stop-button" onClick={() => props.onStopSession?.()}>
          Stop
        </button>
      </div>
    );
  };
});

jest.mock('../../webview/src/components/AgentPreview/AgentPreview', () => {
  const React = require('react');
  return React.forwardRef(function MockAgentPreview(props: any, ref: any) {
    previewPropsRef.current = props;
    React.useImperativeHandle(ref, () => ({ focusInput: jest.fn() }));
    return <div data-testid="agent-preview" />;
  });
});

jest.mock('../../webview/src/components/AgentTracer/AgentTracer', () => {
  return function MockAgentTracer() {
    return <div data-testid="agent-tracer" />;
  };
});

jest.mock('../../webview/src/components/shared/TabNavigation', () => {
  return function MockTabNavigation() {
    return <div data-testid="tab-navigation" />;
  };
});

import App from '../../webview/src/App';

describe('App session lifecycle', () => {
  let messageHandlers: Map<string, Function>;

  beforeEach(() => {
    selectorPropsRef.current = undefined;
    previewPropsRef.current = undefined;
    messageHandlers = new Map();
    jest.clearAllMocks();

    mockVscodeApi.onMessage.mockImplementation((command: string, handler: Function) => {
      messageHandlers.set(command, handler);
      return () => messageHandlers.delete(command);
    });
  });

  const trigger = (command: string, data?: any) => {
    const handler = messageHandlers.get(command);
    if (handler) {
      act(() => {
        handler(data);
      });
    }
  };

  const click = async (testId: string) => {
    await act(async () => {
      screen.getByTestId(testId).click();
    });
  };

  describe('Start click', () => {
    it('marks isSessionTransitioning + isSessionStarting synchronously on click', async () => {
      render(<App />);
      // Select an agent so the AgentSelector has something to start.
      trigger('selectAgent', { agentId: 'agent1' });

      await waitFor(() => {
        expect(selectorPropsRef.current?.selectedAgent).toBe('agent1');
      });

      // Sanity: nothing pending yet.
      expect(selectorPropsRef.current?.isSessionStarting).toBe(false);
      expect(selectorPropsRef.current?.isSessionTransitioning).toBe(false);

      await click('start-button');

      // Both flags set immediately, on the next render after the click.
      expect(selectorPropsRef.current?.isSessionStarting).toBe(true);
      expect(selectorPropsRef.current?.isSessionTransitioning).toBe(true);
    });

    it('keeps the transition flag set continuously through the start round-trip', async () => {
      render(<App />);
      trigger('selectAgent', { agentId: 'agent1' });
      await waitFor(() => expect(selectorPropsRef.current?.selectedAgent).toBe('agent1'));

      await click('start-button');
      expect(selectorPropsRef.current?.isSessionTransitioning).toBe(true);

      // Backend sends clearMessages right before sessionStarting. The handler
      // must NOT clear isSessionStarting mid-restart.
      trigger('clearMessages');
      expect(selectorPropsRef.current?.isSessionStarting).toBe(true);
      expect(selectorPropsRef.current?.isSessionTransitioning).toBe(true);

      trigger('sessionStarting');
      expect(selectorPropsRef.current?.isSessionStarting).toBe(true);

      trigger('sessionStarted', { content: 'hi' });
      await waitFor(() => {
        expect(selectorPropsRef.current?.isSessionStarting).toBe(false);
        expect(selectorPropsRef.current?.isSessionActive).toBe(true);
      });
    });
  });

  describe('Stop click', () => {
    it('sets isStopPending synchronously on Stop click and surfaces it via isSessionTransitioning', async () => {
      render(<App />);
      trigger('selectAgent', { agentId: 'agent1' });
      trigger('sessionStarted', { content: 'hi' });

      await waitFor(() => {
        expect(selectorPropsRef.current?.isSessionActive).toBe(true);
      });

      await click('stop-button');

      // Optimistic update: session no longer active, but we're still
      // waiting for the backend to confirm via sessionEnded.
      expect(selectorPropsRef.current?.isSessionActive).toBe(false);
      expect(selectorPropsRef.current?.isSessionStarting).toBe(false);
      // App folds isStopPending into the isSessionTransitioning prop.
      expect(selectorPropsRef.current?.isSessionTransitioning).toBe(true);
    });

    it('clears isStopPending when sessionEnded arrives', async () => {
      render(<App />);
      trigger('selectAgent', { agentId: 'agent1' });
      trigger('sessionStarted', { content: 'hi' });
      await waitFor(() => expect(selectorPropsRef.current?.isSessionActive).toBe(true));

      await click('stop-button');
      expect(selectorPropsRef.current?.isSessionTransitioning).toBe(true);

      trigger('sessionEnded');

      await waitFor(() => {
        expect(selectorPropsRef.current?.isSessionTransitioning).toBe(false);
        expect(selectorPropsRef.current?.isSessionActive).toBe(false);
      });
    });

    it('does not trigger AgentPreview loader during Stop (no transition flag on Preview)', async () => {
      render(<App />);
      trigger('selectAgent', { agentId: 'agent1' });
      trigger('sessionStarted', { content: 'hi' });
      await waitFor(() => expect(selectorPropsRef.current?.isSessionActive).toBe(true));

      await click('stop-button');

      // The AgentSelector sees the merged isSessionTransitioning || isStopPending
      // flag, but the AgentPreview should only see the real isSessionTransitioning
      // (which is still false here) so it doesn't show "Connecting to agent..."
      // while the user is actually stopping.
      expect(previewPropsRef.current?.isSessionTransitioning).toBe(false);
      expect(previewPropsRef.current?.isStopPending).toBe(true);
      expect(previewPropsRef.current?.isSessionActive).toBe(false);
    });
  });

  describe('clearMessages gating', () => {
    it('does not clear isSessionStarting while a transition is in flight', async () => {
      render(<App />);
      trigger('selectAgent', { agentId: 'agent1' });
      await waitFor(() => expect(selectorPropsRef.current?.selectedAgent).toBe('agent1'));

      await click('start-button');
      expect(selectorPropsRef.current?.isSessionStarting).toBe(true);

      // clearMessages during the in-flight start should be a no-op for
      // isSessionStarting.
      trigger('clearMessages');
      expect(selectorPropsRef.current?.isSessionStarting).toBe(true);
    });

    it('clears isSessionStarting when no transition is pending (recovery path)', async () => {
      render(<App />);
      trigger('selectAgent', { agentId: 'agent1' });

      // Manually push the webview into "starting" state (e.g. backend told us
      // it was starting, but never followed up because of a failure).
      trigger('sessionStarting');
      await waitFor(() => expect(selectorPropsRef.current?.isSessionStarting).toBe(true));

      // No restart in flight; clearMessages should reset starting.
      trigger('clearMessages');
      await waitFor(() => expect(selectorPropsRef.current?.isSessionStarting).toBe(false));
    });
  });

  describe('error flows', () => {
    it('clears isStopPending on error', async () => {
      render(<App />);
      trigger('selectAgent', { agentId: 'agent1' });
      trigger('sessionStarted', { content: 'hi' });
      await waitFor(() => expect(selectorPropsRef.current?.isSessionActive).toBe(true));

      await click('stop-button');
      expect(selectorPropsRef.current?.isSessionTransitioning).toBe(true);

      trigger('error', { message: 'boom' });
      await waitFor(() => {
        expect(selectorPropsRef.current?.isSessionTransitioning).toBe(false);
        expect(selectorPropsRef.current?.isSessionStarting).toBe(false);
      });
    });

    it('clears isStopPending on compilationError', async () => {
      render(<App />);
      trigger('selectAgent', { agentId: 'agent1' });
      trigger('sessionStarted', { content: 'hi' });
      await waitFor(() => expect(selectorPropsRef.current?.isSessionActive).toBe(true));

      await click('stop-button');
      expect(selectorPropsRef.current?.isSessionTransitioning).toBe(true);

      trigger('compilationError', { message: 'compile failed' });
      await waitFor(() => {
        expect(selectorPropsRef.current?.isSessionTransitioning).toBe(false);
      });
    });

    it('clears isStopPending on refreshAgents', async () => {
      render(<App />);
      trigger('selectAgent', { agentId: 'agent1' });
      trigger('sessionStarted', { content: 'hi' });
      await waitFor(() => expect(selectorPropsRef.current?.isSessionActive).toBe(true));

      await click('stop-button');
      expect(selectorPropsRef.current?.isSessionTransitioning).toBe(true);

      trigger('refreshAgents');
      await waitFor(() => {
        expect(selectorPropsRef.current?.isSessionTransitioning).toBe(false);
      });
    });
  });

  describe('AgentPreview prop wiring', () => {
    it('passes lifecycle flags to AgentPreview', async () => {
      render(<App />);
      trigger('selectAgent', { agentId: 'agent1' });
      await waitFor(() => expect(previewPropsRef.current?.selectedAgentId).toBe('agent1'));

      // Initial state: not active, nothing pending.
      expect(previewPropsRef.current?.isSessionActive).toBe(false);
      expect(previewPropsRef.current?.isStopPending).toBe(false);
      expect(previewPropsRef.current?.isSessionTransitioning).toBe(false);
      expect(typeof previewPropsRef.current?.onStartSession).toBe('function');

      await click('start-button');
      // Transition flag flows down.
      expect(previewPropsRef.current?.isSessionTransitioning).toBe(true);

      trigger('sessionStarted', { content: 'hi' });
      await waitFor(() => {
        expect(previewPropsRef.current?.isSessionActive).toBe(true);
      });
    });
  });
});
