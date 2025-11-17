import '@testing-library/jest-dom';
import {
  normalizeHistoryMessage,
  pruneStartingSessionMessages,
  createSystemMessage,
  shouldShowTransitionLoader,
  hasAgentSelection
} from '../../webview/src/components/AgentPreview/AgentPreview';

describe('AgentPreview helpers', () => {
  describe('normalizeHistoryMessage', () => {
    it('fills missing id, content, and timestamp', () => {
      const result = normalizeHistoryMessage({
        type: 'user'
      });

      expect(result.id).toContain('history');
      expect(result.type).toBe('user');
      expect(result.content).toBe('');
      expect(result.timestamp).toEqual(expect.any(String));
    });
  });

  describe('pruneStartingSessionMessages', () => {
    it('removes placeholder system messages', () => {
      const filtered = pruneStartingSessionMessages([
        { id: '1', type: 'system', content: 'Starting session...', timestamp: '', systemType: 'session' },
        { id: '2', type: 'agent', content: 'Hello', timestamp: '' }
      ] as any);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });
  });

  describe('createSystemMessage', () => {
    it('returns null when message is missing', () => {
      expect(createSystemMessage()).toBeNull();
    });

    it('returns a formatted system message', () => {
      const msg = createSystemMessage('Debug info', 'debug');
      expect(msg).not.toBeNull();
      expect(msg?.content).toBe('Debug info');
      expect(msg?.systemType).toBe('debug');
      expect(msg?.type).toBe('system');
    });
  });

  describe('shouldShowTransitionLoader', () => {
    it('returns true when there is no pending agent', () => {
      expect(shouldShowTransitionLoader(undefined, 'agent')).toBe(true);
    });

    it('returns false when pending agent differs from selection', () => {
      expect(shouldShowTransitionLoader('other', 'selected')).toBe(false);
    });
  });

  describe('hasAgentSelection', () => {
    it('detects when an agent is selected', () => {
      expect(hasAgentSelection('agent')).toBe(true);
      expect(hasAgentSelection('')).toBe(false);
    });
  });
});
