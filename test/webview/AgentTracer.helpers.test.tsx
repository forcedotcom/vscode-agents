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

  it('formatHistoryLabel does not truncate by default', () => {
    const longMessage = 'A'.repeat(200);
    const entry: TraceHistoryEntry = {
      storageKey: 'agent',
      agentId: 'agent',
      sessionId: 'session',
      planId: 'plan',
      userMessage: longMessage,
      trace: { type: 'PlanSuccessResponse', planId: 'plan', sessionId: 'session', plan: [] }
    };
    const result = formatHistoryLabel(entry, 0);
    expect(result).toBe(longMessage);
    expect(result).not.toContain('...');
  });

  it('formatHistoryLabel truncates when maxLength is specified', () => {
    const longMessage = 'B'.repeat(150);
    const entry: TraceHistoryEntry = {
      storageKey: 'agent',
      agentId: 'agent',
      sessionId: 'session',
      planId: 'plan',
      userMessage: longMessage,
      trace: { type: 'PlanSuccessResponse', planId: 'plan', sessionId: 'session', plan: [] }
    };
    const result = formatHistoryLabel(entry, 0, 60);
    expect(result).toContain('...');
    expect(result).toBe('B'.repeat(60) + '...');
  });

  it('formatHistoryLabel does not truncate short messages even with maxLength', () => {
    const shortMessage = 'Short message';
    const entry: TraceHistoryEntry = {
      storageKey: 'agent',
      agentId: 'agent',
      sessionId: 'session',
      planId: 'plan',
      userMessage: shortMessage,
      trace: { type: 'PlanSuccessResponse', planId: 'plan', sessionId: 'session', plan: [] }
    };
    const result = formatHistoryLabel(entry, 0, 60);
    expect(result).toBe(shortMessage);
    expect(result).not.toContain('...');
  });

  it('formatHistoryParts does not truncate messages', () => {
    const longMessage = 'C'.repeat(200);
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
    expect(result.message).toBe(longMessage);
    expect(result.message).not.toContain('...');
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
    expect(items[0].label).toBe('User Input: Greeting');
    items[0].onClick?.();
    expect(indices).toEqual([0]);
  });

  it('shows message as description for UserInputStep', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'UserInputStep', message: 'Hello, how can I help?' }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('User Input');
    expect(items[0].description).toBe('Hello, how can I help?');
  });

  it('shows agent name and latency for LLMStep', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'LLMStep', data: { agent_name: 'topic_selector', execution_latency: 1084 } }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Reasoning');
    expect(items[0].description).toBe('topic_selector (1084ms)');
  });

  it('shows agent name for NodeEntryStateStep', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'NodeEntryStateStep', data: { agent_name: 'share_local_events' } }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Entered Topic');
    expect(items[0].description).toBe('share_local_events');
  });

  it('shows tool count for EnabledToolsStep', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'EnabledToolsStep', data: { agent_name: 'topic_selector', enabled_tools: ['tool1', 'tool2', 'tool3'] } }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Tools Enabled');
    expect(items[0].description).toBe('3 tools for topic_selector');
  });

  it('shows transition details for TransitionStep', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'TransitionStep', data: { from_agent: 'topic_selector', to_agent: 'share_local_events' } }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Topic Transition');
    expect(items[0].description).toBe('topic_selector → share_local_events');
  });

  it('shows variable name for VariableUpdateStep', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'VariableUpdateStep', data: { variable_updates: [{ variable_name: '__next__' }] } }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Variable Update');
    expect(items[0].description).toBe('__next__');
  });

  it('shows reasoning category for ReasoningStep', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'ReasoningStep', reason: 'SMALL_TALK: The response contains no factual claims' }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Reasoning');
    expect(items[0].description).toBe('SMALL_TALK');
  });

  it('shows truncated message for PlannerResponseStep', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'PlannerResponseStep', message: 'Could you please confirm your city?' }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Agent Response');
    expect(items[0].description).toBe('Could you please confirm your city?');
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

  it('returns step data including message and reason properties', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'ReasoningStep', reason: 'SMALL_TALK: Test reason' }]
    };

    const result = getStepData(trace, 0);
    expect(result).toContain('"reason"');
    expect(result).toContain('SMALL_TALK: Test reason');
  });
});
