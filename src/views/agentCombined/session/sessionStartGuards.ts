import type { SessionStartGuards } from '../types';
import type { AgentViewState } from '../state/agentViewState';
import { SessionStartCancelledError } from '../types';

/**
 * Creates session start guards for cancellation detection
 */
export function createSessionStartGuards(
  state: AgentViewState,
  startId: number
): SessionStartGuards {
  return {
    ensureActive: () => {
      if (state.sessionStartOperationId !== startId) {
        throw new SessionStartCancelledError();
      }
    },
    isActive: () => {
      return state.sessionStartOperationId === startId;
    }
  };
}
