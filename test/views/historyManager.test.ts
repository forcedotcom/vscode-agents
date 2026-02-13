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

import { AgentSource } from '@salesforce/agents';
import { getAllHistory } from '@salesforce/agents/lib/utils';

const MOCK_PROJECT_PATH = '/mock/project/path';

// Mock VS Code
jest.mock('vscode', () => ({
  commands: {
    executeCommand: jest.fn()
  },
  Uri: {
    parse: jest.fn((str: string) => ({ toString: () => str }))
  },
  workspace: {
    openTextDocument: jest.fn()
  },
  window: {
    showTextDocument: jest.fn(),
    showErrorMessage: jest.fn()
  },
  Position: jest.fn()
}));

// Mock @salesforce/agents
jest.mock('@salesforce/agents', () => ({
  AgentSource: {
    SCRIPT: 'script',
    PUBLISHED: 'published'
  }
}));

// Mock @salesforce/agents/lib/utils
jest.mock('@salesforce/agents/lib/utils', () => ({
  getAllHistory: jest.fn()
}));

// Mock @salesforce/core
jest.mock('@salesforce/core', () => ({
  SfProject: {
    getInstance: () => ({
      getPath: () => MOCK_PROJECT_PATH
    })
  }
}));

// Import after mocks are set up
import { HistoryManager } from '../../src/views/agentCombined/history/historyManager';

const mockGetAllHistory = getAllHistory as jest.MockedFunction<typeof getAllHistory>;

// Helper to create mock transcript entries with required fields
function transcript(text: string | undefined, timestamp: string, sessionId: string, role: string) {
  return { text, timestamp, sessionId, role, agentId: 'TestAgent' } as any;
}

// Helper to create mock trace objects
function trace(planId: string, sessionId: string, startTime: number, message?: string) {
  return {
    planId,
    sessionId,
    plan: [{ type: 'UserInputStep', startExecutionTime: startTime, ...(message ? { message } : {}) }]
  } as any;
}

function mockHistory(
  transcripts: any[] = [],
  traces: any[] = []
) {
  return { metadata: null, transcript: transcripts, traces } as any;
}

describe('HistoryManager', () => {
  let historyManager: HistoryManager;
  let mockState: any;
  let mockMessageSender: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockState = {
      agentInstance: undefined,
      sessionId: '',
      sessionAgentId: undefined,
      currentAgentId: undefined,
      currentAgentSource: undefined,
      currentPlanId: undefined,
      setConversationDataAvailable: jest.fn().mockResolvedValue(undefined),
      setResetAgentViewAvailable: jest.fn().mockResolvedValue(undefined)
    };

    mockMessageSender = {
      sendSetConversation: jest.fn(),
      sendTraceHistory: jest.fn(),
      sendConversationHistory: jest.fn(),
      sendTraceData: jest.fn(),
      sendNoHistoryFound: jest.fn(),
      sendClearMessages: jest.fn()
    };

    mockGetAllHistory.mockResolvedValue(mockHistory());

    historyManager = new HistoryManager(mockState, mockMessageSender);
  });

  describe('loadAndSendConversationHistory', () => {
    it('should send conversation history when transcript entries exist', async () => {
      mockGetAllHistory.mockResolvedValue(mockHistory([
        transcript('Hello', '2025-01-01T00:00:00Z', 'session1', 'user'),
        transcript('Hi there', '2025-01-01T00:00:01Z', 'session1', 'agent')
      ]));

      const result = await historyManager.loadAndSendConversationHistory('TestAgent', AgentSource.SCRIPT);

      expect(result).toBe(true);
      expect(mockMessageSender.sendConversationHistory).toHaveBeenCalledWith([
        { id: '2025-01-01T00:00:00Z-session1', type: 'user', content: 'Hello', timestamp: expect.any(Number) },
        { id: '2025-01-01T00:00:01Z-session1', type: 'agent', content: 'Hi there', timestamp: expect.any(Number) }
      ]);
      expect(mockState.setConversationDataAvailable).toHaveBeenCalledWith(true);
    });

    it('should return false when no transcript entries exist', async () => {
      const result = await historyManager.loadAndSendConversationHistory('TestAgent', AgentSource.SCRIPT);

      expect(result).toBe(false);
      expect(mockMessageSender.sendConversationHistory).not.toHaveBeenCalled();
      expect(mockState.setConversationDataAvailable).toHaveBeenCalledWith(false);
    });

    it('should filter out entries without text', async () => {
      mockGetAllHistory.mockResolvedValue(mockHistory([
        transcript('Hello', '2025-01-01T00:00:00Z', 'session1', 'user'),
        transcript(undefined, '2025-01-01T00:00:01Z', 'session1', 'agent')
      ]));

      const result = await historyManager.loadAndSendConversationHistory('TestAgent', AgentSource.SCRIPT);

      expect(result).toBe(true);
      expect(mockMessageSender.sendConversationHistory).toHaveBeenCalledWith([
        expect.objectContaining({ content: 'Hello', type: 'user' })
      ]);
    });

    it('should sort messages chronologically', async () => {
      mockGetAllHistory.mockResolvedValue(mockHistory([
        transcript('Second', '2025-01-01T00:00:02Z', 'session1', 'agent'),
        transcript('First', '2025-01-01T00:00:00Z', 'session1', 'user')
      ]));

      await historyManager.loadAndSendConversationHistory('TestAgent', AgentSource.SCRIPT);

      const messages = mockMessageSender.sendConversationHistory.mock.calls[0][0];
      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');
    });

    it('should map user role to user type and other roles to agent type', async () => {
      mockGetAllHistory.mockResolvedValue(mockHistory([
        transcript('User msg', '2025-01-01T00:00:00Z', 'session1', 'user'),
        transcript('Agent msg', '2025-01-01T00:00:01Z', 'session1', 'agent')
      ]));

      await historyManager.loadAndSendConversationHistory('TestAgent', AgentSource.SCRIPT);

      const messages = mockMessageSender.sendConversationHistory.mock.calls[0][0];
      expect(messages[0].type).toBe('user');
      expect(messages[1].type).toBe('agent');
    });

    it('should return false and not throw on error', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      mockGetAllHistory.mockRejectedValue(new Error('Network error'));

      const result = await historyManager.loadAndSendConversationHistory('TestAgent', AgentSource.SCRIPT);

      expect(result).toBe(false);
      expect(mockState.setConversationDataAvailable).toHaveBeenCalledWith(false);
    });

    it('should use agent instance when session belongs to the requested agent', async () => {
      const history = mockHistory([
        transcript('Hello', '2025-01-01T00:00:00Z', 'session1', 'user')
      ]);
      mockState.agentInstance = { getHistoryFromDisc: jest.fn().mockResolvedValue(history) };
      mockState.sessionId = 'session1';
      mockState.sessionAgentId = 'TestAgent';

      await historyManager.loadAndSendConversationHistory('TestAgent', AgentSource.SCRIPT);

      expect(mockState.agentInstance.getHistoryFromDisc).toHaveBeenCalledWith('session1');
      expect(mockGetAllHistory).not.toHaveBeenCalled();
    });

    it('should use getAllHistory when session belongs to a different agent', async () => {
      mockState.agentInstance = { getHistoryFromDisc: jest.fn() };
      mockState.sessionId = 'session1';
      mockState.sessionAgentId = 'OtherAgent';

      await historyManager.loadAndSendConversationHistory('TestAgent', AgentSource.SCRIPT);

      expect(mockState.agentInstance.getHistoryFromDisc).not.toHaveBeenCalled();
      expect(mockGetAllHistory).toHaveBeenCalledWith('TestAgent', undefined);
    });

    it('should return false when all entries are filtered out (no text)', async () => {
      mockGetAllHistory.mockResolvedValue(mockHistory([
        transcript(undefined, '2025-01-01T00:00:00Z', 'session1', 'user')
      ]));

      const result = await historyManager.loadAndSendConversationHistory('TestAgent', AgentSource.SCRIPT);

      expect(result).toBe(false);
      expect(mockState.setConversationDataAvailable).toHaveBeenCalledWith(false);
    });
  });

  describe('loadAndSendTraceHistory', () => {
    it('should send trace history entries to the webview', async () => {
      mockGetAllHistory.mockResolvedValue(mockHistory([], [
        trace('plan-1', 'session1', 1000, 'Hi')
      ]));

      await historyManager.loadAndSendTraceHistory('TestAgent', AgentSource.SCRIPT);

      expect(mockMessageSender.sendTraceHistory).toHaveBeenCalledWith(
        'TestAgent',
        [expect.objectContaining({ planId: 'plan-1', agentId: 'TestAgent' })]
      );
    });

    it('should send the latest trace data when entries exist', async () => {
      const trace1 = trace('plan-1', 'session1', 1000);
      const trace2 = trace('plan-2', 'session1', 2000);
      mockGetAllHistory.mockResolvedValue(mockHistory([], [trace1, trace2]));

      await historyManager.loadAndSendTraceHistory('TestAgent', AgentSource.SCRIPT);

      expect(mockMessageSender.sendTraceData).toHaveBeenCalledWith(trace2);
    });

    it('should send the current plan trace data when currentPlanId matches', async () => {
      const trace1 = trace('plan-1', 'session1', 1000);
      const trace2 = trace('plan-2', 'session1', 2000);
      mockGetAllHistory.mockResolvedValue(mockHistory([], [trace1, trace2]));
      mockState.currentPlanId = 'plan-1';

      await historyManager.loadAndSendTraceHistory('TestAgent', AgentSource.SCRIPT);

      expect(mockMessageSender.sendTraceData).toHaveBeenCalledWith(trace1);
    });

    it('should send empty trace history on error', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      mockGetAllHistory.mockRejectedValue(new Error('Read error'));

      await historyManager.loadAndSendTraceHistory('TestAgent', AgentSource.SCRIPT);

      expect(mockMessageSender.sendTraceHistory).toHaveBeenCalledWith('TestAgent', []);
    });

    it('should not send trace data when no entries exist', async () => {
      await historyManager.loadAndSendTraceHistory('TestAgent', AgentSource.SCRIPT);

      expect(mockMessageSender.sendTraceData).not.toHaveBeenCalled();
    });

    it('should sort traces by startExecutionTime', async () => {
      const trace1 = trace('plan-1', 'session1', 2000);
      const trace2 = trace('plan-2', 'session1', 1000);
      mockGetAllHistory.mockResolvedValue(mockHistory([], [trace1, trace2]));

      await historyManager.loadAndSendTraceHistory('TestAgent', AgentSource.SCRIPT);

      const entries = mockMessageSender.sendTraceHistory.mock.calls[0][1];
      expect(entries[0].planId).toBe('plan-2');
      expect(entries[1].planId).toBe('plan-1');
    });

    it('should extract user message from trace', async () => {
      mockGetAllHistory.mockResolvedValue(mockHistory([], [
        trace('plan-1', 'session1', 1000, 'What is the weather?')
      ]));

      await historyManager.loadAndSendTraceHistory('TestAgent', AgentSource.SCRIPT);

      const entries = mockMessageSender.sendTraceHistory.mock.calls[0][1];
      expect(entries[0].userMessage).toBe('What is the weather?');
    });

    it('should handle NoSessionFound error gracefully', async () => {
      const error = new Error('No sessions found');
      error.name = 'NoSessionFound';
      mockGetAllHistory.mockRejectedValue(error);

      await historyManager.loadAndSendTraceHistory('TestAgent', AgentSource.SCRIPT);

      expect(mockMessageSender.sendTraceHistory).toHaveBeenCalledWith('TestAgent', []);
    });
  });

  describe('showHistoryOrPlaceholder', () => {
    it('should load both histories and send them', async () => {
      mockGetAllHistory.mockResolvedValue(mockHistory(
        [transcript('Hello', '2025-01-01T00:00:00Z', 'session1', 'user')],
        [trace('plan-1', 'session1', 1000)]
      ));

      await historyManager.showHistoryOrPlaceholder('TestAgent', AgentSource.SCRIPT);

      expect(mockMessageSender.sendTraceHistory).toHaveBeenCalled();
      expect(mockMessageSender.sendSetConversation).toHaveBeenCalledWith(
        [expect.objectContaining({ content: 'Hello' })],
        false
      );
      expect(mockState.setConversationDataAvailable).toHaveBeenCalledWith(true);
    });

    it('should show placeholder when no history exists', async () => {
      await historyManager.showHistoryOrPlaceholder('TestAgent', AgentSource.SCRIPT);

      expect(mockMessageSender.sendSetConversation).toHaveBeenCalledWith([], true);
      expect(mockState.setConversationDataAvailable).toHaveBeenCalledWith(false);
    });

    it('should send trace data for the latest entry', async () => {
      const t = trace('plan-1', 'session1', 1000);
      mockGetAllHistory.mockResolvedValue(mockHistory([], [t]));

      await historyManager.showHistoryOrPlaceholder('TestAgent', AgentSource.SCRIPT);

      expect(mockMessageSender.sendTraceData).toHaveBeenCalledWith(t);
    });

    it('should send trace data for currentPlanId when set', async () => {
      const trace1 = trace('plan-1', 'session1', 1000);
      const trace2 = trace('plan-2', 'session1', 2000);
      mockGetAllHistory.mockResolvedValue(mockHistory([], [trace1, trace2]));
      mockState.currentPlanId = 'plan-1';

      await historyManager.showHistoryOrPlaceholder('TestAgent', AgentSource.SCRIPT);

      expect(mockMessageSender.sendTraceData).toHaveBeenCalledWith(trace1);
    });

    it('should show placeholder and set conversationDataAvailable to false on error', async () => {
      jest.spyOn(console, 'error').mockImplementation();
      mockGetAllHistory.mockRejectedValue(new Error('Disk error'));

      await historyManager.showHistoryOrPlaceholder('TestAgent', AgentSource.SCRIPT);

      expect(mockState.setConversationDataAvailable).toHaveBeenCalledWith(false);
      expect(mockMessageSender.sendSetConversation).toHaveBeenCalledWith([], true);
    });
  });

  describe('openTraceJsonEntry', () => {
    it('should show error when entry data is undefined', async () => {
      const vscode = require('vscode');

      await historyManager.openTraceJsonEntry(undefined);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Unable to open trace JSON: Missing trace details.'
      );
    });

    it('should show error when entry data has no trace', async () => {
      const vscode = require('vscode');

      await historyManager.openTraceJsonEntry({ trace: undefined } as any);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Unable to open trace JSON: Missing trace details.'
      );
    });
  });
});
