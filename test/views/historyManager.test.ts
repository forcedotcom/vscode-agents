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

import * as fs from 'fs';
import * as path from 'path';
import { AgentSource } from '@salesforce/agents';

const MOCK_PROJECT_PATH = '/mock/project/path';

// Mock VS Code
jest.mock('vscode', () => ({
  commands: {
    executeCommand: jest.fn()
  }
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
  getAllHistory: jest.fn().mockResolvedValue({
    metadata: null,
    transcript: [],
    traces: []
  })
}));

// Mock @salesforce/core
jest.mock('@salesforce/core', () => ({
  SfProject: {
    getInstance: () => ({
      getPath: () => '/mock/project/path'
    })
  }
}));

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    rm: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }
}));

// Import after mocks are set up
import { HistoryManager } from '../../src/views/agentCombined/history/historyManager';

describe('HistoryManager', () => {
  let historyManager: HistoryManager;
  let mockState: any;
  let mockMessageSender: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockState = {
      agentInstance: undefined,
      sessionId: '',
      currentAgentId: undefined,
      currentAgentSource: undefined,
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

    historyManager = new HistoryManager(mockState, mockMessageSender);
  });

  describe('clearHistory', () => {
    it('should delete the agent history directory for script agents', async () => {
      const agentId = 'TestAgent';
      const agentSource = AgentSource.SCRIPT;

      await historyManager.clearHistory(agentId, agentSource);

      // Should delete the correct directory
      const expectedPath = path.join(MOCK_PROJECT_PATH, '.sfdx', 'agents', 'TestAgent');
      expect(fs.promises.rm).toHaveBeenCalledWith(expectedPath, { recursive: true, force: true });
    });

    it('should delete the agent history directory for published agents', async () => {
      const agentId = '0XtestBotId123456';
      const agentSource = AgentSource.PUBLISHED;

      await historyManager.clearHistory(agentId, agentSource);

      // Should delete the correct directory
      const expectedPath = path.join(MOCK_PROJECT_PATH, '.sfdx', 'agents', '0XtestBotId123456');
      expect(fs.promises.rm).toHaveBeenCalledWith(expectedPath, { recursive: true, force: true });
    });

    it('should set conversation data available to false', async () => {
      await historyManager.clearHistory('TestAgent', AgentSource.SCRIPT);

      expect(mockState.setConversationDataAvailable).toHaveBeenCalledWith(false);
    });

    it('should set reset agent view available to false', async () => {
      await historyManager.clearHistory('TestAgent', AgentSource.SCRIPT);

      expect(mockState.setResetAgentViewAvailable).toHaveBeenCalledWith(false);
    });

    it('should send setConversation with empty messages and showPlaceholder true', async () => {
      await historyManager.clearHistory('TestAgent', AgentSource.SCRIPT);

      expect(mockMessageSender.sendSetConversation).toHaveBeenCalledWith([], true);
    });

    it('should send empty trace history', async () => {
      const agentId = 'TestAgent';
      await historyManager.clearHistory(agentId, AgentSource.SCRIPT);

      expect(mockMessageSender.sendTraceHistory).toHaveBeenCalledWith(agentId, []);
    });

    it('should handle script agent paths with path separators', async () => {
      const agentId = '/path/to/MyAgent';
      const agentSource = AgentSource.SCRIPT;

      await historyManager.clearHistory(agentId, agentSource);

      // Should extract basename for script agents
      const expectedPath = path.join(MOCK_PROJECT_PATH, '.sfdx', 'agents', 'MyAgent');
      expect(fs.promises.rm).toHaveBeenCalledWith(expectedPath, { recursive: true, force: true });
    });

    it('should not throw when directory does not exist (force: true)', async () => {
      // fs.promises.rm with force: true doesn't throw for non-existent directories
      await expect(historyManager.clearHistory('NonExistent', AgentSource.SCRIPT)).resolves.not.toThrow();
    });
  });
});
