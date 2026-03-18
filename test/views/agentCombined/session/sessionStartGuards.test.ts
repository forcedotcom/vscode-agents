import { createSessionStartGuards } from '../../../../src/views/agentCombined/session/sessionStartGuards';
import { SessionStartCancelledError } from '../../../../src/views/agentCombined/types';
import type { AgentViewState } from '../../../../src/views/agentCombined/state/agentViewState';

describe('createSessionStartGuards', () => {
  let mockState: { sessionStartOperationId: number };

  beforeEach(() => {
    mockState = { sessionStartOperationId: 1 };
  });

  describe('ensureActive', () => {
    it('should not throw when operation id matches', () => {
      const guards = createSessionStartGuards(mockState as AgentViewState, 1);
      expect(() => guards.ensureActive()).not.toThrow();
    });

    it('should throw SessionStartCancelledError when operation id does not match', () => {
      const guards = createSessionStartGuards(mockState as AgentViewState, 1);
      mockState.sessionStartOperationId = 2;
      expect(() => guards.ensureActive()).toThrow(SessionStartCancelledError);
    });
  });

  describe('isActive', () => {
    it('should return true when operation id matches', () => {
      const guards = createSessionStartGuards(mockState as AgentViewState, 1);
      expect(guards.isActive()).toBe(true);
    });

    it('should return false when operation id does not match', () => {
      const guards = createSessionStartGuards(mockState as AgentViewState, 1);
      mockState.sessionStartOperationId = 2;
      expect(guards.isActive()).toBe(false);
    });
  });
});

describe('SessionStartCancelledError', () => {
  it('should have correct name and message', () => {
    const error = new SessionStartCancelledError();
    expect(error.name).toBe('SessionStartCancelledError');
    expect(error.message).toBe('Agent session start was cancelled');
    expect(error).toBeInstanceOf(Error);
  });
});
