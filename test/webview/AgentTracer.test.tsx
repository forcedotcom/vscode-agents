import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AgentTracer from '../../webview/src/components/AgentTracer/AgentTracer';

const dispatchMessage = (command: string, data: any) => {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { command, data }
      })
    );
  });
};

describe('AgentTracer', () => {
  it('shows the placeholder when no trace history is available', () => {
    render(<AgentTracer isVisible />);

    dispatchMessage('traceHistory', { entries: [] });

    expect(screen.getByText(/Agent Tracer displays/i)).toBeInTheDocument();
    expect(screen.queryByText(/Loading trace data/i)).not.toBeInTheDocument();
  });

  it('should load trace history and allow selecting previous traces', () => {
    render(<AgentTracer isVisible />);

    const firstTrace = {
      type: 'PlanSuccessResponse',
      planId: 'plan-1',
      sessionId: 'session-1',
      plan: [{ type: 'UserInputStep', data: { content: 'hi' } }]
    };
    const latestTrace = {
      type: 'PlanSuccessResponse',
      planId: 'plan-2',
      sessionId: 'session-2',
      plan: [{ type: 'UserInputStep', data: { content: 'second' } }]
    };
    const historyEntries = [
      {
        storageKey: 'agent',
        agentId: 'agent',
        planId: 'plan-1',
        sessionId: 'session-1',
        timestamp: '2024-01-01T00:00:00.000Z',
        trace: firstTrace
      },
      {
        storageKey: 'agent',
        agentId: 'agent',
        planId: 'plan-2',
        sessionId: 'session-2',
        timestamp: '2024-01-02T00:00:00.000Z',
        trace: latestTrace
      }
    ];

    dispatchMessage('traceData', latestTrace);
    dispatchMessage('traceHistory', { entries: historyEntries });

    const selector = screen.getByLabelText(/trace history/i);
    expect(selector).toHaveValue('1');
    expect(screen.getByText('session-2')).toBeInTheDocument();

    fireEvent.change(selector, { target: { value: '0' } });
    expect(selector).toHaveValue('0');
    expect(screen.getByText('session-1')).toBeInTheDocument();
  });
});
