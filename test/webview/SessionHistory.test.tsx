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
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

(window as any).AgentSource = {
  SCRIPT: 'script',
  PUBLISHED: 'published'
};

jest.mock('../../webview/src/services/vscodeApi', () => ({
  vscodeApi: {
    onMessage: jest.fn(),
    listSessions: jest.fn(),
    resumeSession: jest.fn()
  },
  AgentSource: {
    SCRIPT: 'script',
    PUBLISHED: 'published'
  }
}));

import SessionHistory from '../../webview/src/components/SessionHistory/SessionHistory';
import { vscodeApi } from '../../webview/src/services/vscodeApi';

describe('SessionHistory', () => {
  let messageHandlers: Map<string, (data: any) => void>;

  beforeEach(() => {
    jest.clearAllMocks();
    messageHandlers = new Map();
    (vscodeApi.onMessage as jest.Mock).mockImplementation((command: string, handler: any) => {
      messageHandlers.set(command, handler);
      return () => messageHandlers.delete(command);
    });
  });

  const emitSessionList = (agentId: string, sessions: any[]) => {
    act(() => {
      messageHandlers.get('sessionList')?.({ agentId, sessions });
    });
  };

  it('renders the placeholder when no agent is selected', () => {
    render(
      <SessionHistory agentId="" isActive={true} isLiveMode={false} onResume={jest.fn()} />
    );

    expect(screen.getByText(/Select an agent/i)).toBeInTheDocument();
    expect(vscodeApi.listSessions).not.toHaveBeenCalled();
  });

  it('requests the session list when activated for an agent', () => {
    render(
      <SessionHistory
        agentId="agent-1"
        agentSource={'script' as any}
        isActive={true}
        isLiveMode={false}
        onResume={jest.fn()}
      />
    );

    expect(vscodeApi.listSessions).toHaveBeenCalledWith('agent-1', 'script');
  });

  it('renders the empty state with a start button when there are no sessions', () => {
    const onGoToPreview = jest.fn();
    render(
      <SessionHistory
        agentId="agent-1"
        agentSource={'script' as any}
        isActive={true}
        isLiveMode={false}
        onResume={jest.fn()}
        onGoToPreview={onGoToPreview}
      />
    );

    emitSessionList('agent-1', []);

    expect(screen.getByText(/History lists your prior conversations/i)).toBeInTheDocument();
    expect(screen.getByText(/Start Simulation/i)).toBeInTheDocument();
  });

  it('renders rows with first message, formatted timestamp and badge', () => {
    render(
      <SessionHistory
        agentId="agent-1"
        agentSource={'script' as any}
        isActive={true}
        isLiveMode={false}
        onResume={jest.fn()}
      />
    );

    emitSessionList('agent-1', [
      {
        sessionId: 'sess-1',
        timestamp: '2026-05-10T15:30:00Z',
        sessionType: 'simulated',
        firstUserMessage: 'Hello agent'
      }
    ]);

    expect(screen.getByText('Hello agent')).toBeInTheDocument();
    expect(screen.getByText('Simulation')).toBeInTheDocument();
  });

  it('clicking a row resumes the session and notifies the parent', async () => {
    const onResume = jest.fn();
    render(
      <SessionHistory
        agentId="agent-1"
        agentSource={'script' as any}
        isActive={true}
        isLiveMode={false}
        onResume={onResume}
      />
    );

    emitSessionList('agent-1', [
      {
        sessionId: 'sess-1',
        timestamp: '2026-05-10T15:30:00Z',
        sessionType: 'simulated',
        firstUserMessage: 'Hello agent'
      }
    ]);

    const user = userEvent.setup();
    await user.click(screen.getByText('Hello agent').closest('button')!);

    expect(vscodeApi.resumeSession).toHaveBeenCalledWith(
      'agent-1',
      'sess-1',
      expect.objectContaining({ isLiveMode: false, agentSource: 'script' })
    );
    expect(onResume).toHaveBeenCalledWith('sess-1');
  });
});
