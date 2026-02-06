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

  it('should load trace history and display collapsible rows', () => {
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
        userMessage: 'First message',
        trace: firstTrace
      },
      {
        storageKey: 'agent',
        agentId: 'agent',
        planId: 'plan-2',
        sessionId: 'session-2',
        timestamp: '2024-01-02T00:00:00.000Z',
        userMessage: 'Second message',
        trace: latestTrace
      }
    ];

    dispatchMessage('traceData', latestTrace);
    dispatchMessage('traceHistory', { entries: historyEntries });

    // Both rows should be visible
    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();

    // The latest entry should be expanded by default, showing plan-2
    expect(screen.getByText('plan-2')).toBeInTheDocument();
  });

  it('allows expanding and collapsing rows', () => {
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
      {
        storageKey: 'agent',
        agentId: 'agent',
        planId: 'plan-1',
        sessionId: 'session-1',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'First message',
        trace: trace1
      },
      {
        storageKey: 'agent',
        agentId: 'agent',
        planId: 'plan-2',
        sessionId: 'session-2',
        timestamp: '2024-01-02T00:00:00.000Z',
        userMessage: 'Second message',
        trace: trace2
      }
    ];

    dispatchMessage('traceHistory', { entries: historyEntries });

    // Latest entry should be expanded by default
    expect(screen.getByText('plan-2')).toBeInTheDocument();

    // First entry should be collapsed - click to expand
    const firstRowButton = screen.getByRole('button', { name: /first message/i });
    expect(firstRowButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(firstRowButton);
    expect(firstRowButton).toHaveAttribute('aria-expanded', 'true');

    // Now plan-1 should be visible
    expect(screen.getByText('plan-1')).toBeInTheDocument();

    // Both plans should be visible (multi-expand)
    expect(screen.getByText('plan-2')).toBeInTheDocument();

    // Collapse first row
    fireEvent.click(firstRowButton);
    expect(firstRowButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('plan-1')).not.toBeInTheDocument();
  });

  it('auto-expands the latest trace after a new message is sent', () => {
    render(<AgentTracer isVisible />);

    const historyEntries = [
      {
        storageKey: 'agent',
        agentId: 'agent',
        planId: 'plan-1',
        sessionId: 'session-1',
        timestamp: '2024-01-01T00:00:00.000Z',
        userMessage: 'First message',
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
        userMessage: 'Second message',
        trace: {
          type: 'PlanSuccessResponse',
          planId: 'plan-2',
          sessionId: 'session-2',
          plan: [{ type: 'UserInputStep', data: { content: 'second' } }]
        }
      }
    ];

    dispatchMessage('traceHistory', { entries: historyEntries });

    // Latest entry should be expanded
    expect(screen.getByText('plan-2')).toBeInTheDocument();

    // Send a new message
    const newestEntry = {
      storageKey: 'agent',
      agentId: 'agent',
      planId: 'plan-3',
      sessionId: 'session-3',
      timestamp: '2024-01-03T00:00:00.000Z',
      userMessage: 'Third message',
      trace: {
        type: 'PlanSuccessResponse',
        planId: 'plan-3',
        sessionId: 'session-3',
        plan: [{ type: 'UserInputStep', data: { content: 'latest' } }]
      }
    };

    dispatchMessage('messageSent', {});
    dispatchMessage('traceHistory', { entries: [...historyEntries, newestEntry] });

    // Now plan-3 should be visible (auto-expanded)
    expect(screen.getByText('plan-3')).toBeInTheDocument();
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
        userMessage: 'Test message',
        trace
      }
    ];

    dispatchMessage('traceHistory', { entries: historyEntries });

    const button = screen.getByRole('button', { name: /open json/i });
    fireEvent.click(button);

    expect((window as any).vscode.postMessage).toHaveBeenCalledWith({
      command: 'openTraceJson',
      data: { entry: historyEntries[0] }
    });
  });

  it('closes step data panel when close button is clicked', () => {
    render(<AgentTracer isVisible />);

    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan-1',
      sessionId: 'session-1',
      plan: [{ type: 'UserInputStep', data: { content: 'test' } }]
    };

    dispatchMessage('traceHistory', {
      entries: [
        {
          storageKey: 'agent',
          agentId: 'agent',
          planId: 'plan-1',
          sessionId: 'session-1',
          userMessage: 'Test message',
          trace
        }
      ]
    });

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

    dispatchMessage('traceHistory', {
      entries: [
        {
          storageKey: 'agent',
          agentId: 'agent',
          planId: 'plan-1',
          sessionId: 'session-1',
          userMessage: 'Test message',
          trace
        }
      ]
    });

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

  it('shows last entry expanded by default when selectedHistoryIndex is null', () => {
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
      { storageKey: 'agent', agentId: 'agent', planId: 'plan-1', sessionId: 'session-1', userMessage: 'First', trace: trace1 },
      { storageKey: 'agent', agentId: 'agent', planId: 'plan-2', sessionId: 'session-2', userMessage: 'Second', trace: trace2 }
    ];

    dispatchMessage('traceData', trace2);
    dispatchMessage('traceHistory', { entries: historyEntries });

    // Should show last entry expanded by default
    expect(screen.getByText('plan-2')).toBeInTheDocument();
  });

  it('does not open trace json when no current history entry', () => {
    render(<AgentTracer isVisible />);

    dispatchMessage('traceHistory', { entries: [] });

    // Button should not be rendered when there's no data
    expect(screen.queryByRole('button', { name: /open json/i })).not.toBeInTheDocument();
  });

  it('handles click on open trace json when no data', () => {
    render(<AgentTracer isVisible />);

    dispatchMessage('traceHistory', { entries: [] });

    // When there's no data, button shouldn't exist
    const button = screen.queryByRole('button', { name: /open json/i });
    expect(button).not.toBeInTheDocument();
  });

  it('supports keyboard navigation for expand/collapse', () => {
    render(<AgentTracer isVisible />);

    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan-1',
      sessionId: 'session-1',
      plan: [{ type: 'UserInputStep', data: { content: 'test' } }]
    };

    dispatchMessage('traceHistory', {
      entries: [
        {
          storageKey: 'agent',
          agentId: 'agent',
          planId: 'plan-1',
          sessionId: 'session-1',
          userMessage: 'Test message',
          trace
        }
      ]
    });

    const rowButton = screen.getByRole('button', { name: /test message/i });

    // First row should be expanded by default (it's the latest/only one)
    expect(rowButton).toHaveAttribute('aria-expanded', 'true');

    // Press Enter to collapse
    fireEvent.keyDown(rowButton, { key: 'Enter' });
    expect(rowButton).toHaveAttribute('aria-expanded', 'false');

    // Press Space to expand
    fireEvent.keyDown(rowButton, { key: ' ' });
    expect(rowButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('allows multiple rows to be expanded simultaneously', () => {
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
      { storageKey: 'agent', agentId: 'agent', planId: 'plan-1', sessionId: 'session-1', userMessage: 'First', trace: trace1 },
      { storageKey: 'agent', agentId: 'agent', planId: 'plan-2', sessionId: 'session-2', userMessage: 'Second', trace: trace2 }
    ];

    dispatchMessage('traceHistory', { entries: historyEntries });

    // Latest entry should be expanded by default
    const secondRowButton = screen.getByRole('button', { name: /second/i });
    expect(secondRowButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('plan-2')).toBeInTheDocument();

    // Expand first row as well
    const firstRowButton = screen.getByRole('button', { name: /first/i });
    fireEvent.click(firstRowButton);

    // Both rows should now be expanded
    expect(firstRowButton).toHaveAttribute('aria-expanded', 'true');
    expect(secondRowButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('plan-1')).toBeInTheDocument();
    expect(screen.getByText('plan-2')).toBeInTheDocument();
  });

  it('clicking a step in any row shows the step panel', () => {
    render(<AgentTracer isVisible />);

    const trace1 = {
      type: 'PlanSuccessResponse',
      planId: 'plan-1',
      sessionId: 'session-1',
      plan: [{ type: 'UserInputStep', data: { content: 'first-content' } }]
    };

    const trace2 = {
      type: 'PlanSuccessResponse',
      planId: 'plan-2',
      sessionId: 'session-2',
      plan: [{ type: 'UserInputStep', data: { content: 'second-content' } }]
    };

    // Test data: First is older (index 0), Second is newer (index 1)
    // Display order: First appears first in DOM (top), Second appears second (bottom)
    const historyEntries = [
      { storageKey: 'agent', agentId: 'agent', planId: 'plan-1', sessionId: 'session-1', userMessage: 'First', trace: trace1 },
      { storageKey: 'agent', agentId: 'agent', planId: 'plan-2', sessionId: 'session-2', userMessage: 'Second', trace: trace2 }
    ];

    dispatchMessage('traceHistory', { entries: historyEntries });

    // Expand First row (which appears first in DOM - older messages at top)
    const firstRowButton = screen.getByRole('button', { name: /first/i });
    fireEvent.click(firstRowButton);

    // Get step buttons - DOM order: First (top), Second (bottom)
    const stepButtons = screen.getAllByText('User Input');
    // stepButtons[0] is from "First" row, stepButtons[1] is from "Second" row
    fireEvent.click(stepButtons[0]); // Click First row's step

    // Step panel should show first content
    expect(screen.getByText(/"first-content"/)).toBeInTheDocument();

    // Close the panel
    const closeButton = screen.getByLabelText(/close/i);
    fireEvent.click(closeButton);

    // Click on step in Second row
    fireEvent.click(stepButtons[1]);

    // Step panel should show second content
    expect(screen.getByText(/"second-content"/)).toBeInTheDocument();
  });

  it('clears trace history when session starts', () => {
    render(<AgentTracer isVisible />);

    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan-1',
      sessionId: 'session-1',
      plan: [{ type: 'UserInputStep', data: { content: 'test' } }]
    };

    dispatchMessage('traceHistory', {
      entries: [
        {
          storageKey: 'agent',
          agentId: 'agent',
          planId: 'plan-1',
          sessionId: 'session-1',
          userMessage: 'Test message',
          trace
        }
      ]
    });

    // Verify trace is displayed
    expect(screen.getByText('Test message')).toBeInTheDocument();

    // Start a new session
    dispatchMessage('sessionStarted', {});

    // Trace history should be cleared, showing placeholder
    expect(screen.queryByText('Test message')).not.toBeInTheDocument();
    expect(screen.getByText(/Agent Tracer displays/i)).toBeInTheDocument();
  });

  it('displays entries in backend order (backend sorts by startExecutionTime)', () => {
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

    const trace3 = {
      type: 'PlanSuccessResponse',
      planId: 'plan-3',
      sessionId: 'session-3',
      plan: [{ type: 'UserInputStep', data: { content: 'third' } }]
    };

    // Backend sends entries sorted by startExecutionTime (oldest first)
    dispatchMessage('traceHistory', {
      entries: [
        { storageKey: 'agent', agentId: 'agent', planId: 'plan-1', sessionId: 'session-1', userMessage: 'First', trace: trace1 },
        { storageKey: 'agent', agentId: 'agent', planId: 'plan-2', sessionId: 'session-2', userMessage: 'Second', trace: trace2 },
        { storageKey: 'agent', agentId: 'agent', planId: 'plan-3', sessionId: 'session-3', userMessage: 'Third', trace: trace3 }
      ]
    });

    // Frontend displays entries in the exact order received from backend
    const buttons = screen.getAllByRole('button', { name: /first|second|third/i });
    expect(buttons[0]).toHaveTextContent('First');
    expect(buttons[1]).toHaveTextContent('Second');
    expect(buttons[2]).toHaveTextContent('Third');

    // Latest entry (last in list) should be expanded
    expect(buttons[2]).toHaveAttribute('aria-expanded', 'true');
  });

  it('preserves expanded state by planId when new entries arrive', () => {
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

    dispatchMessage('traceHistory', {
      entries: [
        { storageKey: 'agent', agentId: 'agent', planId: 'plan-1', sessionId: 'session-1', userMessage: 'First', trace: trace1 },
        { storageKey: 'agent', agentId: 'agent', planId: 'plan-2', sessionId: 'session-2', userMessage: 'Second', trace: trace2 }
      ]
    });

    // Latest (Second) should be expanded
    const secondButton = screen.getByRole('button', { name: /second/i });
    expect(secondButton).toHaveAttribute('aria-expanded', 'true');

    // Manually expand First
    const firstButton = screen.getByRole('button', { name: /first/i });
    fireEvent.click(firstButton);
    expect(firstButton).toHaveAttribute('aria-expanded', 'true');

    // New entry arrives - only the newest should be expanded now
    const trace3 = {
      type: 'PlanSuccessResponse',
      planId: 'plan-3',
      sessionId: 'session-3',
      plan: [{ type: 'UserInputStep', data: { content: 'third' } }]
    };

    dispatchMessage('traceHistory', {
      entries: [
        { storageKey: 'agent', agentId: 'agent', planId: 'plan-1', sessionId: 'session-1', userMessage: 'First', trace: trace1 },
        { storageKey: 'agent', agentId: 'agent', planId: 'plan-2', sessionId: 'session-2', userMessage: 'Second', trace: trace2 },
        { storageKey: 'agent', agentId: 'agent', planId: 'plan-3', sessionId: 'session-3', userMessage: 'Third', trace: trace3 }
      ]
    });

    // Only Third (newest) should be expanded, others collapsed
    const thirdButton = screen.getByRole('button', { name: /third/i });
    expect(thirdButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /first/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /second/i })).toHaveAttribute('aria-expanded', 'false');
  });
});
