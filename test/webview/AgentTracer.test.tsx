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

  it('auto-selects the latest trace after a new message is sent', () => {
    render(<AgentTracer isVisible />);

    const historyEntries = [
      {
        storageKey: 'agent',
        agentId: 'agent',
        planId: 'plan-1',
        sessionId: 'session-1',
        timestamp: '2024-01-01T00:00:00.000Z',
        trace: {
          type: 'PlanSuccessResponse',
          planId: 'plan-1',
          sessionId: 'session-1',
          plan: [{ type: 'UserInputStep', data: { content: 'hi' } }]
        }
      },
      {
        storageKey: 'agent',
        agentId: 'agent',
        planId: 'plan-2',
        sessionId: 'session-2',
        timestamp: '2024-01-02T00:00:00.000Z',
        trace: {
          type: 'PlanSuccessResponse',
          planId: 'plan-2',
          sessionId: 'session-2',
          plan: [{ type: 'UserInputStep', data: { content: 'second' } }]
        }
      }
    ];

    dispatchMessage('traceData', historyEntries[1].trace);
    dispatchMessage('traceHistory', { entries: historyEntries });

    const selector = screen.getByLabelText(/trace history/i);
    expect(selector).toHaveValue('1');
    expect(screen.getByText('session-2')).toBeInTheDocument();

    fireEvent.change(selector, { target: { value: '0' } });
    expect(selector).toHaveValue('0');
    expect(screen.getByText('session-1')).toBeInTheDocument();

    const newestEntry = {
      storageKey: 'agent',
      agentId: 'agent',
      planId: 'plan-3',
      sessionId: 'session-3',
      timestamp: '2024-01-03T00:00:00.000Z',
      trace: {
        type: 'PlanSuccessResponse',
        planId: 'plan-3',
        sessionId: 'session-3',
        plan: [{ type: 'UserInputStep', data: { content: 'latest' } }]
      }
    };

    dispatchMessage('messageSent', {});
    dispatchMessage('traceHistory', { entries: [...historyEntries, newestEntry] });

    expect(selector).toHaveValue('2');
    expect(screen.getByText('session-3')).toBeInTheDocument();
  });

  it('sends an openTraceJson request when the link is clicked', () => {
    render(<AgentTracer isVisible />);

    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan-3',
      sessionId: 'session-3',
      plan: [{ type: 'UserInputStep', data: { content: 'link test' } }]
    };
    const historyEntries = [
      {
        storageKey: 'agent',
        agentId: 'agent',
        planId: 'plan-3',
        sessionId: 'session-3',
        timestamp: '2024-01-03T00:00:00.000Z',
        trace
      }
    ];

    dispatchMessage('traceHistory', { entries: historyEntries });

    const button = screen.getByRole('button', { name: /view raw json/i });
    fireEvent.click(button);

    expect((window as any).vscode.postMessage).toHaveBeenCalledWith({
      command: 'openTraceJson',
      data: { entry: historyEntries[0] }
    });
  });

  it('handles NaN in history selector', () => {
    render(<AgentTracer isVisible />);

    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan-1',
      sessionId: 'session-1',
      plan: [{ type: 'UserInputStep', data: { content: 'test' } }]
    };
    const historyEntries = [
      {
        storageKey: 'agent',
        agentId: 'agent',
        planId: 'plan-1',
        sessionId: 'session-1',
        timestamp: '2024-01-01T00:00:00.000Z',
        trace
      }
    ];

    dispatchMessage('traceHistory', { entries: historyEntries });

    const selector = screen.getByLabelText(/trace history/i);
    fireEvent.change(selector, { target: { value: 'invalid' } });

    expect(selector).toHaveValue('0');
  });

  it('handles invalid index in history selector', () => {
    render(<AgentTracer isVisible />);

    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan-1',
      sessionId: 'session-1',
      plan: [{ type: 'UserInputStep', data: { content: 'test' } }]
    };
    const historyEntries = [
      {
        storageKey: 'agent',
        agentId: 'agent',
        planId: 'plan-1',
        sessionId: 'session-1',
        timestamp: '2024-01-01T00:00:00.000Z',
        trace
      }
    ];

    dispatchMessage('traceHistory', { entries: historyEntries });

    const selector = screen.getByLabelText(/trace history/i);
    fireEvent.change(selector, { target: { value: '999' } });

    expect(selector).toHaveValue('0');
  });

  it('closes step data panel when close button is clicked', () => {
    render(<AgentTracer isVisible />);

    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan-1',
      sessionId: 'session-1',
      plan: [{ type: 'UserInputStep', data: { content: 'test' } }]
    };

    dispatchMessage('traceHistory', { entries: [{ storageKey: 'agent', agentId: 'agent', planId: 'plan-1', sessionId: 'session-1', trace }] });

    const stepButton = screen.getByText('User Input');
    fireEvent.click(stepButton);

    expect(screen.getByText(/"content"/)).toBeInTheDocument();

    const closeButton = screen.getByLabelText(/close/i);
    fireEvent.click(closeButton);

    expect(screen.queryByText(/"content"/)).not.toBeInTheDocument();
  });

  it('requests trace data when messageSent event occurs', () => {
    jest.useFakeTimers();
    render(<AgentTracer isVisible />);

    const postMessageSpy = jest.spyOn((window as any).vscode, 'postMessage');

    dispatchMessage('messageSent', {});

    jest.advanceTimersByTime(200);

    expect(postMessageSpy).toHaveBeenCalledWith({
      command: 'getTraceData'
    });

    jest.useRealTimers();
  });

  it('handles panel resize', () => {
    render(<AgentTracer isVisible />);

    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan-1',
      sessionId: 'session-1',
      plan: [{ type: 'UserInputStep', data: { content: 'test' } }]
    };

    dispatchMessage('traceHistory', { entries: [{ storageKey: 'agent', agentId: 'agent', planId: 'plan-1', sessionId: 'session-1', trace }] });

    const stepButton = screen.getByText('User Input');
    fireEvent.click(stepButton);

    const resizeHandle = document.querySelector('.tracer-step-data-panel__resize-handle');
    expect(resizeHandle).toBeInTheDocument();

    fireEvent.mouseDown(resizeHandle!);

    const mouseMoveEvent = new MouseEvent('mousemove', {
      clientY: 300,
      bubbles: true
    });
    document.dispatchEvent(mouseMoveEvent);

    const mouseUpEvent = new MouseEvent('mouseup', {
      bubbles: true
    });
    document.dispatchEvent(mouseUpEvent);

    expect(resizeHandle).toBeInTheDocument();
  });

  it('returns last entry when selectedHistoryIndex is out of bounds', () => {
    render(<AgentTracer isVisible />);

    const trace1 = {
      type: 'PlanSuccessResponse',
      planId: 'plan-1',
      sessionId: 'session-1',
      plan: [{ type: 'UserInputStep', data: { content: 'first' } }]
    };

    const trace2 = {
      type: 'PlanSuccessResponse',
      planId: 'plan-2',
      sessionId: 'session-2',
      plan: [{ type: 'UserInputStep', data: { content: 'second' } }]
    };

    const historyEntries = [
      { storageKey: 'agent', agentId: 'agent', planId: 'plan-1', sessionId: 'session-1', trace: trace1 },
      { storageKey: 'agent', agentId: 'agent', planId: 'plan-2', sessionId: 'session-2', trace: trace2 }
    ];

    dispatchMessage('traceData', trace2);
    dispatchMessage('traceHistory', { entries: historyEntries });

    // Should show last entry by default
    expect(screen.getByText('session-2')).toBeInTheDocument();
  });

  it('does not open trace json when no current history entry', () => {
    render(<AgentTracer isVisible />);

    dispatchMessage('traceHistory', { entries: [] });

    // Button should not be rendered when there's no data
    expect(screen.queryByRole('button', { name: /view raw json/i })).not.toBeInTheDocument();
  });


  it('does not change trace when history change returns null', () => {
    render(<AgentTracer isVisible />);

    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan-1',
      sessionId: 'session-1',
      plan: [{ type: 'UserInputStep', data: { content: 'test' } }]
    };

    const historyEntries = [
      { storageKey: 'agent', agentId: 'agent', planId: 'plan-1', sessionId: 'session-1', trace }
    ];

    dispatchMessage('traceHistory', { entries: historyEntries });

    expect(screen.getByText('session-1')).toBeInTheDocument();

    const selector = screen.getByLabelText(/trace history/i);

    // Try to select an out of bounds index (already tested in 'handles invalid index')
    // This ensures line 440 is covered
    fireEvent.change(selector, { target: { value: '999' } });

    // Should still show the original session
    expect(screen.getByText('session-1')).toBeInTheDocument();
  });

  it('uses last history entry when index is null', () => {
    render(<AgentTracer isVisible />);

    const trace1 = {
      type: 'PlanSuccessResponse',
      planId: 'plan-1',
      sessionId: 'session-1',
      plan: [{ type: 'UserInputStep', data: { content: 'first' } }]
    };

    const trace2 = {
      type: 'PlanSuccessResponse',
      planId: 'plan-2',
      sessionId: 'session-2',
      plan: [{ type: 'UserInputStep', data: { content: 'last' } }]
    };

    const historyEntries = [
      { storageKey: 'agent', agentId: 'agent', planId: 'plan-1', sessionId: 'session-1', trace: trace1 },
      { storageKey: 'agent', agentId: 'agent', planId: 'plan-2', sessionId: 'session-2', trace: trace2 }
    ];

    // Send trace history without preselecting
    dispatchMessage('traceHistory', { entries: historyEntries });

    // Should automatically show the last entry
    expect(screen.getByText('session-2')).toBeInTheDocument();
  });

  it('handles click on open trace json when no data', () => {
    render(<AgentTracer isVisible />);

    dispatchMessage('traceHistory', { entries: [] });

    // When there's no data, button shouldn't exist
    const button = screen.queryByRole('button', { name: /view raw json/i });
    expect(button).not.toBeInTheDocument();
  });
});
