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
    expect(items[0].label).toBe('Topic Selected');
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
    expect(items[0].label).toBe('Output Evaluation');
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

  it('returns null when step does not exist at index', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ data: { foo: 'bar' } }]
    };

    expect(getStepData(trace, 999)).toBeNull();
  });

  it('includes topic in step data', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ topic: 'greeting', data: { foo: 'bar' } }]
    };

    const result = getStepData(trace, 0);
    expect(result).toContain('"topic"');
    expect(result).toContain('greeting');
  });

  it('includes responseType in step data', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ responseType: 'text', data: { foo: 'bar' } }]
    };

    const result = getStepData(trace, 0);
    expect(result).toContain('"responseType"');
    expect(result).toContain('text');
  });

  it('includes isContentSafe in step data', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ isContentSafe: true, data: { foo: 'bar' } }]
    };

    const result = getStepData(trace, 0);
    expect(result).toContain('"isContentSafe"');
    expect(result).toContain('true');
  });

  it('includes safetyScore in step data', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ safetyScore: 0.95, data: { foo: 'bar' } }]
    };

    const result = getStepData(trace, 0);
    expect(result).toContain('"safetyScore"');
    expect(result).toContain('0.95');
  });

  it('returns null when step has no displayable data', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'SomeStep' }]
    };

    expect(getStepData(trace, 0)).toBeNull();
  });

  it('uses fallback label for steps without type or name', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ data: { foo: 'bar' } }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Step 1');
  });

  it('shows multiple variable updates count', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [
        {
          type: 'VariableUpdateStep',
          data: {
            variable_updates: [{ variable_name: 'var1' }, { variable_name: 'var2' }, { variable_name: 'var3' }]
          }
        }
      ]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('3 variables updated');
  });

  it('shows single tool for EnabledToolsStep', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'EnabledToolsStep', data: { agent_name: 'agent1', enabled_tools: ['tool1'] } }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('1 tool for agent1');
  });

  it('shows full reason text when no colon present', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'ReasoningStep', reason: 'This is a plain reason without category' }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('This is a plain reason without category');
  });

  it('shows topic for UpdateTopicStep', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'UpdateTopicStep', topic: 'new_topic' }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Topic Selected');
    expect(items[0].description).toBe('new_topic');
  });

  it('handles invalid timestamp in formatHistoryLabel', () => {
    const entry: TraceHistoryEntry = {
      storageKey: 'agent',
      agentId: 'agent',
      sessionId: 'session',
      planId: 'plan',
      timestamp: 'invalid-date',
      userMessage: 'Test message',
      trace: { type: 'PlanSuccessResponse', planId: 'plan', sessionId: 'session', plan: [] }
    };

    const result = formatHistoryLabel(entry, 0);
    expect(result).toBe('Test message');
  });

  it('handles invalid timestamp in formatHistoryParts', () => {
    const entry: TraceHistoryEntry = {
      storageKey: 'agent',
      agentId: 'agent',
      sessionId: 'session',
      planId: 'plan',
      timestamp: 'invalid-date',
      userMessage: 'Test message',
      trace: { type: 'PlanSuccessResponse', planId: 'plan', sessionId: 'session', plan: [] }
    };

    const result = formatHistoryParts(entry, 0);
    expect(result.time).toBeNull();
    expect(result.message).toBe('Test message');
  });

  it('shows directive_context for SessionInitialStateStep', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'SessionInitialStateStep', data: { directive_context: 'Context info' } }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('Context info');
  });

  it('shows agent name for EnabledToolsStep without tools', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'EnabledToolsStep', data: { agent_name: 'test_agent' } }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('test_agent');
  });

  it('shows agent name for LLMStep without latency', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'LLMStep', data: { agent_name: 'test_agent' } }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('test_agent');
  });

  it('returns undefined for VariableUpdateStep without variable names', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'VariableUpdateStep', data: { variable_updates: [] } }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].description).toBeUndefined();
  });

  it('returns undefined for TransitionStep without from/to agents', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'TransitionStep', data: { from_agent: 'agent1' } }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].description).toBeUndefined();
  });

  it('shows no description for BeforeReasoningStep', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'BeforeReasoningStep', data: { agent_name: 'test_agent' } }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('test_agent');
  });

  it('returns undefined for ReasoningStep without reason', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'ReasoningStep' }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].description).toBeUndefined();
  });

  it('returns undefined for PlannerResponseStep without message', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ type: 'PlannerResponseStep' }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].description).toBeUndefined();
  });

  it('uses step name as label when present without type', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ name: 'CustomStepName', data: { foo: 'bar' } }]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('CustomStepName');
  });

  it('includes message property in step data', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [{ message: 'Test message', data: { foo: 'bar' } }]
    };

    const result = getStepData(trace, 0);
    expect(result).toContain('"message"');
    expect(result).toContain('Test message');
  });

  it('shows function name for successful FunctionStep with output', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [
        {
          type: 'FunctionStep',
          function: {
            name: 'check_weather',
            input: { dateToCheck: '2024-06-17' },
            output: { maxTemperature: 13.9, minTemperature: 12 }
          }
        }
      ]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Action Executed');
    expect(items[0].description).toBe('check_weather');
    expect(items[0].status).toBe('success');
  });

  it('shows error status for FunctionStep without output', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [
        {
          type: 'FunctionStep',
          function: {
            name: 'check_weather',
            input: { dateToCheck: '2024-06-17' }
          }
        }
      ]
    };

    const items = buildTimelineItems(trace, () => {});
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Action Executed');
    expect(items[0].description).toBe('check_weather');
    expect(items[0].status).toBe('error');
  });

  it('includes function data in step data for FunctionStep', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [
        {
          type: 'FunctionStep',
          function: {
            name: 'check_weather',
            input: { dateToCheck: '2024-06-17' },
            output: { maxTemperature: 13.9 }
          }
        }
      ]
    };

    const result = getStepData(trace, 0);
    expect(result).toContain('"function"');
    expect(result).toContain('check_weather');
    expect(result).toContain('"input"');
    expect(result).toContain('"output"');
  });

  it('makes FunctionStep clickable when function data exists', () => {
    const trace = {
      type: 'PlanSuccessResponse',
      planId: 'plan',
      sessionId: 'session',
      plan: [
        {
          type: 'FunctionStep',
          function: {
            name: 'check_weather',
            input: { dateToCheck: '2024-06-17' }
          }
        }
      ]
    };

    const indices: number[] = [];
    const items = buildTimelineItems(trace, index => indices.push(index));
    expect(items).toHaveLength(1);
    expect(items[0].onClick).toBeDefined();
    items[0].onClick?.();
    expect(indices).toEqual([0]);
  });
});
