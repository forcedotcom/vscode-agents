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

import * as vscode from 'vscode';
import { AgentCombinedViewProvider } from '../../src/views/agentCombinedViewProvider';
import { AgentSource, AgentPreview, AgentSimulate, readTranscriptEntries } from '@salesforce/agents';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { getAvailableClientApps, createConnectionWithClientApp } from '../../src/utils/clientAppUtils';
import { Lifecycle } from '@salesforce/core';
import * as path from 'path';

// Mock VS Code
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    activeTextEditor: null
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(() => true)
    })),
    findFiles: jest.fn(),
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
    fs: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      createDirectory: jest.fn()
    },
    onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() }))
  },
  commands: {
    executeCommand: jest.fn(),
    registerCommand: jest.fn()
  },
  ExtensionContext: jest.fn(),
  WebviewView: jest.fn(),
  Uri: {
    file: jest.fn((p: string) => ({ fsPath: p })),
    joinPath: jest.fn((base: any, ...segments: string[]) => ({
      fsPath: path.join(base.fsPath || base, ...segments)
    }))
  },
  ViewColumn: {},
  CancellationToken: {}
}));

// Mock @salesforce/agents
jest.mock('@salesforce/agents', () => ({
  AgentSource: {
    SCRIPT: 'script',
    PUBLISHED: 'published'
  },
  AgentPreview: jest.fn(),
  AgentSimulate: jest.fn(),
  Agent: {
    listRemote: jest.fn()
  },
  readTranscriptEntries: jest.fn(),
  AgentPreviewBase: class {}
}));

// Mock @salesforce/core
jest.mock('@salesforce/core', () => ({
  Lifecycle: {
    getInstance: jest.fn()
  }
}));

// Mock services
jest.mock('../../src/services/coreExtensionService', () => ({
  CoreExtensionService: {
    getDefaultConnection: jest.fn(),
    getTelemetryService: jest.fn(() => ({
      sendCommandEvent: jest.fn()
    })),
    getChannelService: jest.fn(() => ({
      appendLine: jest.fn(),
      showChannelOutput: jest.fn(),
      clear: jest.fn()
    }))
  }
}));

// Mock utils
jest.mock('../../src/utils/clientAppUtils', () => ({
  getAvailableClientApps: jest.fn(),
  createConnectionWithClientApp: jest.fn()
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}));

describe('AgentCombinedViewProvider', () => {
  let provider: AgentCombinedViewProvider;
  let mockContext: vscode.ExtensionContext;
  let mockWebviewView: vscode.WebviewView;

  beforeEach(() => {
    mockContext = {
      extensionUri: { fsPath: '/extension/path' },
      extensionPath: '/extension/path',
      subscriptions: []
    } as any;

    mockWebviewView = {
      webview: {
        postMessage: jest.fn(),
        onDidReceiveMessage: jest.fn(() => ({ dispose: jest.fn() })),
        options: {},
        html: ''
      },
      show: jest.fn()
    } as any;

    provider = new AgentCombinedViewProvider(mockContext);
    provider.webviewView = mockWebviewView;

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAgentSource', () => {
    it('should return AgentSource.SCRIPT for local agent IDs', () => {
      const localAgentId = 'local:/workspace/myAgent.agent';
      const source = (provider as any).getAgentSource(localAgentId);
      expect(source).toBe(AgentSource.SCRIPT);
    });

    it('should return AgentSource.PUBLISHED for Bot IDs', () => {
      const botId = '0X123456789012345';
      const source = (provider as any).getAgentSource(botId);
      expect(source).toBe(AgentSource.PUBLISHED);
    });

    it('should return AgentSource.PUBLISHED for 18-character Bot IDs', () => {
      const botId = '0X123456789012345678';
      const source = (provider as any).getAgentSource(botId);
      expect(source).toBe(AgentSource.PUBLISHED);
    });
  });

  describe('getLocalAgentFilePath', () => {
    it('should extract file path from local agent ID', () => {
      const localAgentId = 'local:/workspace/myAgent.agent';
      const filePath = (provider as any).getLocalAgentFilePath(localAgentId);
      expect(filePath).toBe('/workspace/myAgent.agent');
    });

    it('should return the ID unchanged if it does not start with "local:"', () => {
      const agentId = '/workspace/myAgent.agent';
      const filePath = (provider as any).getLocalAgentFilePath(agentId);
      expect(filePath).toBe(agentId);
    });
  });

  describe('validatePublishedAgentId', () => {
    it('should not throw for valid 15-character Bot ID', () => {
      const validBotId = '0X1234567890123'; // 15 characters (0X + 13 digits)
      expect(() => {
        (provider as any).validatePublishedAgentId(validBotId);
      }).not.toThrow();
    });

    it('should not throw for valid 18-character Bot ID', () => {
      const validBotId = '0X1234567890123456'; // 18 characters (0X + 16 digits)
      expect(() => {
        (provider as any).validatePublishedAgentId(validBotId);
      }).not.toThrow();
    });

    it('should throw for Bot ID that does not start with "0X"', () => {
      const invalidBotId = '0A123456789012345';
      expect(() => {
        (provider as any).validatePublishedAgentId(invalidBotId);
      }).toThrow('The Bot ID provided must begin with "0X"');
    });

    it('should throw for Bot ID with incorrect length', () => {
      const invalidBotId = '0X12345678901234'; // 16 characters
      expect(() => {
        (provider as any).validatePublishedAgentId(invalidBotId);
      }).toThrow('The Bot ID provided must begin with "0X" and be either 15 or 18 characters');
    });

    it('should throw for Bot ID that is too short', () => {
      const invalidBotId = '0X123456789012'; // 14 characters
      expect(() => {
        (provider as any).validatePublishedAgentId(invalidBotId);
      }).toThrow();
    });

    it('should throw for Bot ID that is too long', () => {
      const invalidBotId = '0X1234567890123456789'; // 19 characters
      expect(() => {
        (provider as any).validatePublishedAgentId(invalidBotId);
      }).toThrow();
    });
  });

  describe('loadAndSendConversationHistory', () => {
    const mockWebviewView = {
      webview: {
        postMessage: jest.fn()
      }
    } as any;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should load history for script agent using file name with .agent extension', async () => {
      const localAgentId = 'local:/workspace/myAgent.agent';
      const mockTranscriptEntries = [
        {
          timestamp: '2025-01-01T00:00:00Z',
          sessionId: 'session1',
          role: 'user' as const,
          text: 'Hello'
        },
        {
          timestamp: '2025-01-01T00:01:00Z',
          sessionId: 'session1',
          role: 'agent' as const,
          text: 'Hi there!'
        }
      ];

      (readTranscriptEntries as jest.Mock).mockResolvedValue(mockTranscriptEntries);

      await (provider as any).loadAndSendConversationHistory(
        localAgentId,
        AgentSource.SCRIPT,
        mockWebviewView
      );

      // Should call readTranscriptEntries with the file name (including .agent extension)
      expect(readTranscriptEntries).toHaveBeenCalledWith('myAgent.agent');
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'conversationHistory',
        data: {
          messages: [
            {
              id: '2025-01-01T00:00:00Z-session1',
              type: 'user',
              content: 'Hello',
              timestamp: '2025-01-01T00:00:00Z'
            },
            {
              id: '2025-01-01T00:01:00Z-session1',
              type: 'agent',
              content: 'Hi there!',
              timestamp: '2025-01-01T00:01:00Z'
            }
          ]
        }
      });
    });

    it('should load history for published agent using Bot ID', async () => {
      const botId = '0X123456789012345';
      const mockTranscriptEntries = [
        {
          timestamp: '2025-01-01T00:00:00Z',
          sessionId: 'session1',
          role: 'user' as const,
          text: 'Hello'
        }
      ];

      (readTranscriptEntries as jest.Mock).mockResolvedValue(mockTranscriptEntries);

      await (provider as any).loadAndSendConversationHistory(
        botId,
        AgentSource.PUBLISHED,
        mockWebviewView
      );

      // Should call readTranscriptEntries with the Bot ID
      expect(readTranscriptEntries).toHaveBeenCalledWith(botId);
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalled();
    });

    it('should filter out entries without text content', async () => {
      const localAgentId = 'local:/workspace/myAgent.agent';
      const mockTranscriptEntries = [
        {
          timestamp: '2025-01-01T00:00:00Z',
          sessionId: 'session1',
          role: 'user' as const,
          text: 'Hello'
        },
        {
          timestamp: '2025-01-01T00:01:00Z',
          sessionId: 'session1',
          role: 'agent' as const,
          // No text property
          raw: { someData: 'value' }
        }
      ];

      (readTranscriptEntries as jest.Mock).mockResolvedValue(mockTranscriptEntries);

      await (provider as any).loadAndSendConversationHistory(
        localAgentId,
        AgentSource.SCRIPT,
        mockWebviewView
      );

      // Should only send messages with text content
      const postMessageCall = mockWebviewView.webview.postMessage.mock.calls[0][0];
      expect(postMessageCall.data.messages).toHaveLength(1);
      expect(postMessageCall.data.messages[0].content).toBe('Hello');
    });

    it('should not send message if no transcript entries found', async () => {
      const localAgentId = 'local:/workspace/myAgent.agent';
      (readTranscriptEntries as jest.Mock).mockResolvedValue([]);

      await (provider as any).loadAndSendConversationHistory(
        localAgentId,
        AgentSource.SCRIPT,
        mockWebviewView
      );

      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalled();
    });

    it('should not send message if transcript entries is null', async () => {
      const localAgentId = 'local:/workspace/myAgent.agent';
      (readTranscriptEntries as jest.Mock).mockResolvedValue(null);

      await (provider as any).loadAndSendConversationHistory(
        localAgentId,
        AgentSource.SCRIPT,
        mockWebviewView
      );

      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const localAgentId = 'local:/workspace/myAgent.agent';
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (readTranscriptEntries as jest.Mock).mockRejectedValue(new Error('History read failed'));

      await (provider as any).loadAndSendConversationHistory(
        localAgentId,
        AgentSource.SCRIPT,
        mockWebviewView
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('discoverLocalAgents', () => {
    it('should discover .agent files in workspace', async () => {
      const mockAgentFiles = [
        { fsPath: '/workspace/agent1.agent' },
        { fsPath: '/workspace/agent2.agent' }
      ];

      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue(mockAgentFiles as any);

      const localAgents = await (provider as any).discoverLocalAgents();

      expect(localAgents).toHaveLength(2);
      expect(localAgents[0].name).toBe('agent1');
      expect(localAgents[0].id).toBe('local:/workspace/agent1.agent');
      expect(localAgents[0].filePath).toBe('/workspace/agent1.agent');
      expect(localAgents[1].name).toBe('agent2');
      expect(localAgents[1].id).toBe('local:/workspace/agent2.agent');
    });

    it('should sort discovered agents alphabetically by name', async () => {
      const mockAgentFiles = [
        { fsPath: '/workspace/zebra.agent' },
        { fsPath: '/workspace/alpha.agent' },
        { fsPath: '/workspace/beta.agent' }
      ];

      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue(mockAgentFiles as any);

      const localAgents = await (provider as any).discoverLocalAgents();

      expect(localAgents).toHaveLength(3);
      expect(localAgents[0].name).toBe('alpha');
      expect(localAgents[1].name).toBe('beta');
      expect(localAgents[2].name).toBe('zebra');
    });

    it('should handle errors when discovering agents', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      (vscode.workspace.findFiles as jest.Mock).mockRejectedValue(new Error('Discovery failed'));

      const localAgents = await (provider as any).discoverLocalAgents();

      expect(localAgents).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('should return empty array when no .agent files found', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);

      const localAgents = await (provider as any).discoverLocalAgents();

      expect(localAgents).toEqual([]);
    });
  });

  describe('Agent Source Integration', () => {
    it('should correctly identify script vs published agents based on agent ID format', () => {
      const localAgentId = 'local:/workspace/myAgent.agent';
      const botId = '0X1234567890123';

      // Test getAgentSource directly
      const scriptSource = (provider as any).getAgentSource(localAgentId);
      const publishedSource = (provider as any).getAgentSource(botId);

      expect(scriptSource).toBe(AgentSource.SCRIPT);
      expect(publishedSource).toBe(AgentSource.PUBLISHED);
    });

    it('should use correct file path extraction for script agents', () => {
      const localAgentId = 'local:/workspace/myAgent.agent';
      const filePath = (provider as any).getLocalAgentFilePath(localAgentId);
      
      expect(filePath).toBe('/workspace/myAgent.agent');
    });

    it('should validate published agent IDs correctly', () => {
      const valid15CharBotId = '0X1234567890123';
      const valid18CharBotId = '0X1234567890123456';
      const invalidBotId = '0A1234567890123';

      expect(() => {
        (provider as any).validatePublishedAgentId(valid15CharBotId);
      }).not.toThrow();
      
      expect(() => {
        (provider as any).validatePublishedAgentId(valid18CharBotId);
      }).not.toThrow();
      
      expect(() => {
        (provider as any).validatePublishedAgentId(invalidBotId);
      }).toThrow();
    });
  });
});

