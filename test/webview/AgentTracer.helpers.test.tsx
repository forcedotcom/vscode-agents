import {
  isTraceErrorMessage,
  formatHistoryLabel,
  formatHistoryParts,
  selectHistoryEntry,
  applyHistorySelection,
  buildTimelineItems,
  getStepData,
  type TraceHistoryEntry
} from '../../webview/src/components/AgentTracer/AgentTracer';

describe('AgentTracer helpers', () => {
  it('detects trace-related error messages', () => {
    expect(isTraceErrorMessage('Trace execution failed')).toBe(true);
    expect(isTraceErrorMessage('plan ID missing')).toBe(true);
    expect(isTraceErrorMessage('session not found')).toBe(true);
    expect(isTraceErrorMessage('other error')).toBe(false);
    expect(isTraceErrorMessage(undefined)).toBe(false);
  });

  it('formats history labels using timestamps when provided', () => {
    const entry: TraceHistoryEntry = {
      storageKey: 'agent',
      agentId: 'agent',
      sessionId: 'session',
      planId: 'plan',
      timestamp: '2024-05-01T12:34:56Z',
      trace: { type: 'PlanSuccessResponse', planId: 'plan', sessionId: 'session', plan: [] }
    };
    const expectedTime = new Date(entry.timestamp!).toLocaleTimeString();
    expect(formatHistoryLabel(entry, 0)).toContain(expectedTime);
    expect(formatHistoryLabel({ ...entry, timestamp: undefined }, 1)).toBe('Trace 2');
  });

  it('truncates long messages with ellipsis', () => {
    const longMessage = 'A'.repeat(100);
    const entry: TraceHistoryEntry = {
      storageKey: 'agent',
      agentId: 'agent',
      sessionId: 'session',
      planId: 'plan',
      userMessage: longMessage,
      trace: { type: 'PlanSuccessResponse', planId: 'plan', sessionId: 'session', plan: [] }
    };
    const result = formatHistoryLabel(entry, 0);
    expect(result).toContain('...');
    expect(result.length).toBeLessThan(longMessage.length);
  });

  it('does not truncate messages shorter than maxLength', () => {
    const shortMessage = 'Short message';
    const entry: TraceHistoryEntry = {
      storageKey: 'agent',
      agentId: 'agent',
      sessionId: 'session',
      planId: 'plan',
      userMessage: shortMessage,
      trace: { type: 'PlanSuccessResponse', planId: 'plan', sessionId: 'session', plan: [] }
    };
    const result = formatHistoryLabel(entry, 0);
    expect(result).toBe(shortMessage);
    expect(result).not.toContain('...');
  });

  it('respects custom maxLength parameter', () => {
    const message = 'A'.repeat(30);
    const entry: TraceHistoryEntry = {
      storageKey: 'agent',
      agentId: 'agent',
      sessionId: 'session',
      planId: 'plan',
      userMessage: message,
      trace: { type: 'PlanSuccessResponse', planId: 'plan', sessionId: 'session', plan: [] }
    };
    const result = formatHistoryLabel(entry, 0, 20);
    expect(result).toBe('A'.repeat(20) + '...');
  });

  it('formatHistoryParts truncates long messages', () => {
    const longMessage = 'B'.repeat(100);
    const entry: TraceHistoryEntry = {
      storageKey: 'agent',
      agentId: 'agent',
      sessionId: 'session',
      planId: 'plan',
      userMessage: longMessage,
      timestamp: '2024-05-01T12:34:56Z',
      trace: { type: 'PlanSuccessResponse', planId: 'plan', sessionId: 'session', plan: [] }
    };
    const result = formatHistoryParts(entry, 0);
    expect(result.message).toContain('...');
    expect(result.message.length).toBeLessThan(longMessage.length);
    expect(result.time).toBeTruthy();
  });

  it('selects trace history entries safely', () => {
    const entries: TraceHistoryEntry[] = [
      {
        storageKey: 'agent',
        agentId: 'agent',
        sessionId: 's1',
        planId: 'p1',
        trace: { type: 'PlanSuccessResponse', planId: 'p1', sessionId: 's1', plan: [] }
      }
    ];
    expect(selectHistoryEntry(entries, 0)).toEqual(entries[0].trace);
    expect(selectHistoryEntry(entries, 2)).toBeNull();
  });

  it('applies history selection with preferred indices', () => {
    const entries: TraceHistoryEntry[] = [
      {
        storageKey: 'agent',
        agentId: 'agent',
        sessionId: 's1',
        planId: 'p1',
        trace: { type: 'PlanSuccessResponse', planId: 'p1', sessionId: 's1', plan: [] }
      },
      {
        storageKey: 'agent',
        agentId: 'agent',
        sessionId: 's2',
        planId: 'p2',
        trace: { type: 'PlanSuccessResponse', planId: 'p2', sessionId: 's2', plan: [] }
      }
    ];
    expect(applyHistorySelection(entries, null)).toEqual({
      nextIndex: 1,
      nextTraceData: entries[1].trace
    });
    expect(applyHistorySelection(entries, 0)).toEqual({
      nextIndex: 0,
      nextTraceData: entries[0].trace
    });
    expect(applyHistorySelection([], null)).toEqual({
      nextIndex: null,
      nextTraceData: null
    });
  });

  it('builds timeline items and exposes click handlers', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'UserInputStep', name: 'Greeting', data: { hello: 'world' } }]
    };

    const indices: number[] = [];
    const items = buildTimelineItems(trace, index => indices.push(index));
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('UserInputStep: Greeting');
    items[0].onClick?.();
    expect(indices).toEqual([0]);
  });

  it('returns selected step data when available', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ data: { foo: 'bar' } }]
    };

    expect(getStepData(trace, 0)).toContain('"foo": "bar"');
    expect(getStepData(trace, null)).toBeNull();
  });
});
