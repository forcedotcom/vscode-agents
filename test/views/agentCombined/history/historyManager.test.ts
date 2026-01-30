/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { HistoryManager } from '../../../../src/views/agentCombined/history/historyManager';
import type { AgentViewState } from '../../../../src/views/agentCombined/state/agentViewState';
import type { WebviewMessageSender } from '../../../../src/views/agentCombined/handlers/webviewMessageSender';

// Mock vscode
jest.mock('vscode', () => ({
  Uri: {
    parse: jest.fn((s: string) => ({ toString: () => s }))
  },
  workspace: {
    openTextDocument: jest.fn(),
    applyEdit: jest.fn()
  },
  window: {
    showTextDocument: jest.fn(),
    showErrorMessage: jest.fn()
  },
  WorkspaceEdit: jest.fn().mockImplementation(() => ({
    insert: jest.fn()
  })),
  Position: jest.fn().mockImplementation((line: number, char: number) => ({ line, character: char }))
}));

// Mock the agents library
jest.mock('@salesforce/agents/lib/utils', () => ({
  getAllHistory: jest.fn()
}));

describe('HistoryManager', () => {
  let historyManager: HistoryManager;
  let mockState: jest.Mocked<AgentViewState>;
  let mockMessageSender: jest.Mocked<WebviewMessageSender>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockState = {
      agentInstance: undefined,
      sessionId: '',
      sessionAgentId: undefined,
      currentPlanId: undefined,
      setConversationDataAvailable: jest.fn()
    } as any;

    mockMessageSender = {
      sendTraceHistory: jest.fn(),
      sendTraceData: jest.fn(),
      sendConversationHistory: jest.fn(),
      sendSetConversation: jest.fn()
    } as any;

    historyManager = new HistoryManager(mockState, mockMessageSender);
  });

  describe('getTraceStartTime', () => {
    it('should extract startExecutionTime from UserInputStep', () => {
      const trace = {
        plan: [
          { type: 'SessionInitialStateStep', startExecutionTime: 1000 },
          { type: 'UserInputStep', startExecutionTime: 2000, message: 'hello' },
          { type: 'AgentResponseStep', startExecutionTime: 3000 }
        ]
      };

      // Access private method via any
      const result = (historyManager as any).getTraceStartTime(trace);
      expect(result).toBe(2000);
    });

    it('should return MAX_SAFE_INTEGER when no UserInputStep exists', () => {
      const trace = {
        plan: [
          { type: 'SessionInitialStateStep', startExecutionTime: 1000 },
          { type: 'AgentResponseStep', startExecutionTime: 3000 }
        ]
      };

      const result = (historyManager as any).getTraceStartTime(trace);
      expect(result).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should return MAX_SAFE_INTEGER when plan is missing', () => {
      const trace = { type: 'PlanSuccessResponse' };

      const result = (historyManager as any).getTraceStartTime(trace);
      expect(result).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should return MAX_SAFE_INTEGER when trace is null', () => {
      const result = (historyManager as any).getTraceStartTime(null);
      expect(result).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should return MAX_SAFE_INTEGER when UserInputStep has no startExecutionTime', () => {
      const trace = {
        plan: [{ type: 'UserInputStep', message: 'hello' }]
      };

      const result = (historyManager as any).getTraceStartTime(trace);
      expect(result).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('extractUserMessageFromTrace', () => {
    it('should extract message from UserInputStep', () => {
      const trace = {
        plan: [
          { type: 'SessionInitialStateStep' },
          { type: 'UserInputStep', message: 'What is the weather?' },
          { type: 'AgentResponseStep' }
        ]
      };

      const result = (historyManager as any).extractUserMessageFromTrace(trace);
      expect(result).toBe('What is the weather?');
    });

    it('should handle stepType instead of type', () => {
      const trace = {
        plan: [{ stepType: 'UserInputStep', message: 'Hello world' }]
      };

      const result = (historyManager as any).extractUserMessageFromTrace(trace);
      expect(result).toBe('Hello world');
    });

    it('should return undefined when no UserInputStep exists', () => {
      const trace = {
        plan: [{ type: 'AgentResponseStep' }]
      };

      const result = (historyManager as any).extractUserMessageFromTrace(trace);
      expect(result).toBeUndefined();
    });

    it('should return undefined when plan is missing', () => {
      const trace = {};

      const result = (historyManager as any).extractUserMessageFromTrace(trace);
      expect(result).toBeUndefined();
    });
  });

  describe('convertTranscriptToMessages', () => {
    it('should convert transcript entries to messages sorted by timestamp', () => {
      const transcriptEntries = [
        { text: 'Third', timestamp: '2024-01-03T00:00:00Z', sessionId: 's1', role: 'user' },
        { text: 'First', timestamp: '2024-01-01T00:00:00Z', sessionId: 's1', role: 'user' },
        { text: 'Second', timestamp: '2024-01-02T00:00:00Z', sessionId: 's1', role: 'assistant' }
      ];

      const result = (historyManager as any).convertTranscriptToMessages(transcriptEntries);

      expect(result).toHaveLength(3);
      expect(result[0].content).toBe('First');
      expect(result[1].content).toBe('Second');
      expect(result[2].content).toBe('Third');
    });

    it('should filter out entries without text', () => {
      const transcriptEntries = [
        { text: 'Has text', timestamp: '2024-01-01T00:00:00Z', sessionId: 's1', role: 'user' },
        { text: '', timestamp: '2024-01-02T00:00:00Z', sessionId: 's1', role: 'user' },
        { text: undefined, timestamp: '2024-01-03T00:00:00Z', sessionId: 's1', role: 'user' }
      ];

      const result = (historyManager as any).convertTranscriptToMessages(transcriptEntries);

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Has text');
    });

    it('should map user role correctly', () => {
      const transcriptEntries = [
        { text: 'User message', timestamp: '2024-01-01T00:00:00Z', sessionId: 's1', role: 'user' }
      ];

      const result = (historyManager as any).convertTranscriptToMessages(transcriptEntries);

      expect(result[0].type).toBe('user');
    });

    it('should map non-user roles to agent', () => {
      const transcriptEntries = [
        { text: 'Assistant message', timestamp: '2024-01-01T00:00:00Z', sessionId: 's1', role: 'assistant' }
      ];

      const result = (historyManager as any).convertTranscriptToMessages(transcriptEntries);

      expect(result[0].type).toBe('agent');
    });
  });

  describe('trace sorting', () => {
    it('should sort traces by UserInputStep startExecutionTime (oldest first)', () => {
      const traces = [
        {
          planId: 'plan-bar',
          plan: [{ type: 'UserInputStep', startExecutionTime: 2000, message: 'bar' }]
        },
        {
          planId: 'plan-foo',
          plan: [{ type: 'UserInputStep', startExecutionTime: 1000, message: 'foo' }]
        },
        {
          planId: 'plan-yea',
          plan: [{ type: 'UserInputStep', startExecutionTime: 3000, message: 'yea' }]
        }
      ];

      // Sort using the same logic as historyManager
      const sortedTraces = [...traces].sort((a, b) => {
        const timeA = (historyManager as any).getTraceStartTime(a);
        const timeB = (historyManager as any).getTraceStartTime(b);
        return timeA - timeB;
      });

      expect(sortedTraces[0].planId).toBe('plan-foo');
      expect(sortedTraces[1].planId).toBe('plan-bar');
      expect(sortedTraces[2].planId).toBe('plan-yea');
    });

    it('should put traces without timestamps at the end', () => {
      const traces = [
        {
          planId: 'plan-no-timestamp',
          plan: [{ type: 'AgentResponseStep' }]
        },
        {
          planId: 'plan-with-timestamp',
          plan: [{ type: 'UserInputStep', startExecutionTime: 1000, message: 'hello' }]
        }
      ];

      const sortedTraces = [...traces].sort((a, b) => {
        const timeA = (historyManager as any).getTraceStartTime(a);
        const timeB = (historyManager as any).getTraceStartTime(b);
        return timeA - timeB;
      });

      expect(sortedTraces[0].planId).toBe('plan-with-timestamp');
      expect(sortedTraces[1].planId).toBe('plan-no-timestamp');
    });
  });
});
