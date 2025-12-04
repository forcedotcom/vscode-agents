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
import * as fs from 'fs';
import { AgentCombinedViewProvider } from '../../src/views/agentCombinedViewProvider';
import { AgentSource, AgentPreview, AgentSimulate, readTranscriptEntries } from '@salesforce/agents';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { getAvailableClientApps, createConnectionWithClientApp } from '../../src/utils/clientAppUtils';
import { Lifecycle } from '@salesforce/core';
import * as path from 'path';
import {
  appendTraceHistoryEntry,
  readTraceHistoryEntries,
  clearTraceHistory,
  writeTraceEntryToFile
} from '../../src/utils/traceHistory';

// Mock VS Code
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showQuickPick: jest.fn(),
    showSaveDialog: jest.fn(),
    showTextDocument: jest.fn(),
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
      createDirectory: jest.fn(),
      stat: jest.fn()
    },
    onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() })),
    openTextDocument: jest.fn()
  },
  commands: {
    executeCommand: jest.fn(),
    registerCommand: jest.fn()
  },
  debug: {
    onDidStartDebugSession: jest.fn(() => ({ dispose: jest.fn() })),
    activeDebugSession: undefined
  },
  ExtensionContext: jest.fn(),
  WebviewView: jest.fn(),
  Uri: {
    file: jest.fn((p: string) => ({ fsPath: p })),
    joinPath: jest.fn((base: any, ...segments: string[]) => ({
      fsPath: path.join(base.fsPath || base, ...segments),
      path: path.join(base.fsPath || base, ...segments)
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
const mockChannelServiceInstance = {
  appendLine: jest.fn(),
  showChannelOutput: jest.fn(),
  clear: jest.fn()
};

jest.mock('../../src/services/coreExtensionService', () => {
  return {
    CoreExtensionService: {
      getDefaultConnection: jest.fn(),
      getTelemetryService: jest.fn(() => ({
        sendCommandEvent: jest.fn()
      })),
      getChannelService: jest.fn(() => mockChannelServiceInstance)
    }
  };
});

// Mock utils
jest.mock('../../src/utils/clientAppUtils', () => ({
  getAvailableClientApps: jest.fn(),
  createConnectionWithClientApp: jest.fn()
}));

jest.mock('../../src/utils/traceHistory', () => ({
  appendTraceHistoryEntry: jest.fn(),
  readTraceHistoryEntries: jest.fn().mockResolvedValue([]),
  clearTraceHistory: jest.fn(),
  writeTraceEntryToFile: jest.fn().mockResolvedValue('/tmp/trace.json')
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
    (CoreExtensionService.getChannelService as jest.Mock).mockReturnValue(mockChannelServiceInstance);
    mockContext = {
      extensionUri: { fsPath: '/extension/path' },
      extensionPath: '/extension/path',
      subscriptions: [],
      globalState: {
        get: jest.fn().mockReturnValue(false),
        update: jest.fn().mockResolvedValue(undefined),
        keys: jest.fn().mockReturnValue([]),
        setKeysForSync: jest.fn()
      }
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
    // Reset the shared channel service mock
    mockChannelServiceInstance.appendLine.mockClear();
    mockChannelServiceInstance.showChannelOutput.mockClear();
    mockChannelServiceInstance.clear.mockClear();
    // CRITICAL: Restore getChannelService mock after clearAllMocks
    // since channelService is required and may be accessed later
    (CoreExtensionService.getChannelService as jest.Mock).mockReturnValue(mockChannelServiceInstance);
    (readTraceHistoryEntries as jest.Mock).mockResolvedValue([]);
    (writeTraceEntryToFile as jest.Mock).mockResolvedValue('/tmp/trace.json');
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

      const result = await (provider as any).loadAndSendConversationHistory(
        localAgentId,
        AgentSource.SCRIPT,
        mockWebviewView
      );

      expect(result).toBe(true);
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
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:hasConversationData',
        true
      );
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

      const result = await (provider as any).loadAndSendConversationHistory(
        botId,
        AgentSource.PUBLISHED,
        mockWebviewView
      );

      // Should call readTranscriptEntries with the Bot ID
      expect(readTranscriptEntries).toHaveBeenCalledWith(botId);
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalled();
      expect(result).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:hasConversationData',
        true
      );
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

      const result = await (provider as any).loadAndSendConversationHistory(
        localAgentId,
        AgentSource.SCRIPT,
        mockWebviewView
      );

      // Should only send messages with text content
      const postMessageCall = mockWebviewView.webview.postMessage.mock.calls[0][0];
      expect(postMessageCall.data.messages).toHaveLength(1);
      expect(postMessageCall.data.messages[0].content).toBe('Hello');
      expect(result).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:hasConversationData',
        true
      );
    });

    it('should not send message if no transcript entries found', async () => {
      const localAgentId = 'local:/workspace/myAgent.agent';
      (readTranscriptEntries as jest.Mock).mockResolvedValue([]);

      const result = await (provider as any).loadAndSendConversationHistory(
        localAgentId,
        AgentSource.SCRIPT,
        mockWebviewView
      );

      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalled();
      expect(result).toBe(false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:hasConversationData',
        false
      );
    });

    it('should not send message if transcript entries is null', async () => {
      const localAgentId = 'local:/workspace/myAgent.agent';
      (readTranscriptEntries as jest.Mock).mockResolvedValue(null);

      const result = await (provider as any).loadAndSendConversationHistory(
        localAgentId,
        AgentSource.SCRIPT,
        mockWebviewView
      );

      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalled();
      expect(result).toBe(false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:hasConversationData',
        false
      );
    });

    it('should handle errors gracefully', async () => {
      const localAgentId = 'local:/workspace/myAgent.agent';
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (readTranscriptEntries as jest.Mock).mockRejectedValue(new Error('History read failed'));

      const result = await (provider as any).loadAndSendConversationHistory(
        localAgentId,
        AgentSource.SCRIPT,
        mockWebviewView
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalled();
      expect(result).toBe(false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:hasConversationData',
        false
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error exceptions in loadAndSendConversationHistory', async () => {
      const localAgentId = 'local:/workspace/myAgent.agent';
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (readTranscriptEntries as jest.Mock).mockRejectedValue('string error');

      const result = await (provider as any).loadAndSendConversationHistory(
        localAgentId,
        AgentSource.SCRIPT,
        mockWebviewView
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith('Could not load conversation history:', 'string error');
      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalled();
      expect(result).toBe(false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:hasConversationData',
        false
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle transcript entries with empty text field', async () => {
      const localAgentId = 'local:/workspace/myAgent.agent';
      (readTranscriptEntries as jest.Mock).mockResolvedValue([
        { timestamp: '2025', sessionId: 's1', role: 'user' as const, text: '' as any }
      ]);

      const result = await (provider as any).loadAndSendConversationHistory(
        localAgentId,
        AgentSource.SCRIPT,
        mockWebviewView
      );

      // Should filter out entries with empty text
      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalled();
      expect(result).toBe(false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:hasConversationData',
        false
      );
    });

    it('should avoid posting history when all entries are filtered out', async () => {
      const localAgentId = 'local:/workspace/myAgent.agent';
      (readTranscriptEntries as jest.Mock).mockResolvedValue([
        { timestamp: '2025', sessionId: 's1', role: 'user' as const, text: '' },
        { timestamp: '2025', sessionId: 's1', role: 'agent' as const }
      ]);

      const result = await (provider as any).loadAndSendConversationHistory(
        localAgentId,
        AgentSource.SCRIPT,
        mockWebviewView
      );

      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalled();
      expect(result).toBe(false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:hasConversationData',
        false
      );
    });
  });

  describe('discoverLocalAgents', () => {
    it('should discover .agent files in workspace', async () => {
      const mockAgentFiles = [{ fsPath: '/workspace/agent1.agent' }, { fsPath: '/workspace/agent2.agent' }];

      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue(mockAgentFiles as any);
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({} as any);

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
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({} as any);

      const localAgents = await (provider as any).discoverLocalAgents();

      expect(localAgents).toHaveLength(3);
      expect(localAgents[0].name).toBe('alpha');
      expect(localAgents[1].name).toBe('beta');
      expect(localAgents[2].name).toBe('zebra');
    });

    it('should return empty array when no .agent files found', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);

      const localAgents = await (provider as any).discoverLocalAgents();

      expect(localAgents).toEqual([]);
    });
  });

  describe('resolveClientAppConnection', () => {
    it('should return handled when no client apps exist and no handler is provided', async () => {
      (getAvailableClientApps as jest.Mock).mockResolvedValue({ type: 'none' });

      const result = await (provider as any).resolveClientAppConnection();

      expect(result).toEqual({ status: 'handled' });
      expect(createConnectionWithClientApp).not.toHaveBeenCalled();
    });

    it('should return handled when multiple client apps exist but no handler provided', async () => {
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'multiple',
        clientApps: [{ name: 'AppA' }, { name: 'AppB' }]
      });

      const result = await (provider as any).resolveClientAppConnection();

      expect(result).toEqual({ status: 'handled' });
      expect(createConnectionWithClientApp).not.toHaveBeenCalled();
    });
  });

  describe('getAgentsForCommandPalette', () => {
    const localAgents = [{ name: 'LocalOne', id: 'local:/tmp/one.agent', type: 'script', filePath: '/tmp/one.agent' }];

    let discoverSpy: jest.SpyInstance;

    beforeEach(() => {
      discoverSpy = jest.spyOn(provider as any, 'discoverLocalAgents').mockResolvedValue(localAgents);
      (vscode.window.showQuickPick as jest.Mock).mockReset();
      (vscode.window.showInformationMessage as jest.Mock).mockReset();
    });

    afterEach(() => {
      discoverSpy.mockRestore();
    });

    it('should return only local agents when no client apps are configured', async () => {
      (getAvailableClientApps as jest.Mock).mockResolvedValue({ type: 'none' });

      const agents = await provider.getAgentsForCommandPalette();

      expect(agents).toEqual(localAgents);
      expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
    });

    it('should show information message and return locals when client app selection is cancelled', async () => {
      const clientApps = [{ name: 'AppOne', clientId: '123' }];
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'multiple',
        clientApps
      });
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue(undefined);

      const agents = await provider.getAgentsForCommandPalette();

      expect(agents).toEqual(localAgents);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Client app selection cancelled. Showing Agent Script files only.'
      );
      expect(createConnectionWithClientApp).not.toHaveBeenCalled();
    });

    it('should return local and remote agents when client app is selected', async () => {
      const clientApps = [{ name: 'AppOne', clientId: '123' }];
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'multiple',
        clientApps
      });
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({
        label: 'AppOne',
        description: '123',
        app: clientApps[0]
      });
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({ instanceUrl: 'https://test.salesforce.com' });

      const remoteRecords = [
        {
          Id: '0X123',
          MasterLabel: 'Remote One',
          BotVersions: { records: [{ Status: 'Active' }] }
        }
      ];
      const { Agent } = require('@salesforce/agents');
      Agent.listRemote = jest.fn().mockResolvedValue(remoteRecords);

      const agents = await provider.getAgentsForCommandPalette();

      expect(createConnectionWithClientApp).toHaveBeenCalledWith('AppOne');
      expect(Agent.listRemote).toHaveBeenCalled();
      expect(agents).toEqual([...localAgents, { name: 'Remote One', id: '0X123', type: 'published' }]);
      expect((provider as any).selectedClientApp).toBe('AppOne');
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

  describe('getInstance', () => {
    it('should return the singleton instance', () => {
      const instance = AgentCombinedViewProvider.getInstance();
      expect(instance).toBe(provider);
    });
  });

  describe('getCurrentAgentId', () => {
    it('should return undefined when no agent is selected', () => {
      expect(provider.getCurrentAgentId()).toBeUndefined();
    });

    it('should return the current agent ID when set', () => {
      (provider as any).currentAgentId = '0X123456789012345';
      expect(provider.getCurrentAgentId()).toBe('0X123456789012345');
    });
  });

  describe('selectAndStartAgent', () => {
    it('should post message to webview when webview exists', () => {
      const agentId = '0X123456789012345';
      provider.selectAndStartAgent(agentId);

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'selectAgent',
        data: { agentId, forceRestart: true }
      });
    });

    it('should not throw when webview does not exist', () => {
      provider.webviewView = undefined;
      expect(() => {
        provider.selectAndStartAgent('0X123456789012345');
      }).not.toThrow();
    });
  });

  describe('toggleDebugMode', () => {
    it('should toggle debug mode from false to true', async () => {
      (provider as any).isApexDebuggingEnabled = false;

      await provider.toggleDebugMode();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:debugMode', true);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Debug mode activated.');
    });

    it('should toggle debug mode from true to false', async () => {
      (provider as any).isApexDebuggingEnabled = true;

      await provider.toggleDebugMode();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:debugMode', false);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Debug mode deactivated.');
    });

    it('should update agent preview debug mode when agent preview exists', async () => {
      const mockAgentPreview = {
        setApexDebugMode: jest.fn()
      };
      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).isApexDebuggingEnabled = false;

      await provider.toggleDebugMode();

      expect(mockAgentPreview.setApexDebugMode).toHaveBeenCalledWith(true);
    });

    it('should work when webview does not exist', async () => {
      provider.webviewView = undefined;
      (provider as any).isApexDebuggingEnabled = false;

      await expect(provider.toggleDebugMode()).resolves.not.toThrow();
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });
  });

  describe('endSession', () => {
    it('should end AgentSimulate session', async () => {
      const mockAgentSimulate = {
        end: jest.fn().mockResolvedValue(undefined)
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      (provider as any).agentPreview = Object.assign(mockAgentSimulate, {
        constructor: { name: 'AgentSimulate' }
      });
      (provider as any).sessionId = 'test-session';
      (provider as any).currentAgentName = 'TestAgent';

      // Mock instanceof check
      Object.setPrototypeOf((provider as any).agentPreview, AgentSimulate.prototype);

      await provider.endSession();

      expect(mockAgentSimulate.end).toHaveBeenCalled();
      expect((provider as any).agentPreview).toBeUndefined();
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'sessionEnded',
        data: {}
      });
      const channelService = CoreExtensionService.getChannelService();
      expect(channelService.appendLine).toHaveBeenCalledWith('Simulation ended.');
    });

    it('should end AgentPreview session', async () => {
      const mockAgentPreview = {
        end: jest.fn().mockResolvedValue(undefined)
      };
      (AgentPreview as any).mockImplementation(() => mockAgentPreview);

      (provider as any).agentPreview = Object.assign(mockAgentPreview, {
        constructor: { name: 'AgentPreview' }
      });
      (provider as any).sessionId = 'test-session';
      (provider as any).currentAgentName = 'TestAgent';

      // Mock instanceof check - NOT an AgentSimulate
      Object.setPrototypeOf((provider as any).agentPreview, AgentPreview.prototype);

      const channelService = CoreExtensionService.getChannelService();
      await provider.endSession();

      expect(mockAgentPreview.end).toHaveBeenCalledWith('test-session', 'UserRequest');
      expect((provider as any).agentPreview).toBeUndefined();
      expect(channelService.appendLine).toHaveBeenCalledWith('Simulation ended.');
    });

    it('should not throw when no active session', async () => {
      (provider as any).agentPreview = undefined;
      const channelService = CoreExtensionService.getChannelService();
      await expect(provider.endSession()).resolves.not.toThrow();
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
      // channelService.appendLine is always called at the end of endSession()
      expect(channelService.appendLine).toHaveBeenCalledWith('Simulation ended.');
      expect(channelService.appendLine).toHaveBeenCalledWith('---------------------');
    });

    it('should skip notification when agent name is not set', async () => {
      const mockAgentSimulate = {
        end: jest.fn().mockResolvedValue(undefined)
      };
      Object.setPrototypeOf(mockAgentSimulate, AgentSimulate.prototype);
      (provider as any).agentPreview = mockAgentSimulate;
      (provider as any).sessionId = 'test-session';
      (provider as any).currentAgentName = undefined;

      const channelService = CoreExtensionService.getChannelService();
      await provider.endSession();

      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'sessionEnded',
        data: {}
      });
      // channelService.appendLine is always called at the end of endSession()
      expect(channelService.appendLine).toHaveBeenCalledWith('Simulation ended.');
      expect(channelService.appendLine).toHaveBeenCalledWith('---------------------');
    });

    it('should reset session state after ending', async () => {
      const mockAgentSimulate = {
        end: jest.fn().mockResolvedValue(undefined)
      };
      (provider as any).agentPreview = mockAgentSimulate;
      (provider as any).sessionId = 'test-session';
      (provider as any).currentAgentName = 'TestAgent';
      Object.setPrototypeOf((provider as any).agentPreview, AgentSimulate.prototype);

      await provider.endSession();

      expect((provider as any).agentPreview).toBeUndefined();
      expect((provider as any).currentAgentName).toBeUndefined();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:sessionActive', false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:sessionStarting', false);
      // Debug mode should persist across session ends, so it should NOT be reset to false
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('setContext', 'agentforceDX:debugMode', false);
    });

    it('should handle endSession when webviewView is null', async () => {
      const mockAgentSimulate = {
        end: jest.fn().mockResolvedValue(undefined)
      };
      Object.setPrototypeOf(mockAgentSimulate, AgentSimulate.prototype);
      (provider as any).agentPreview = mockAgentSimulate;
      (provider as any).sessionId = 'test-session';
      (provider as any).currentAgentName = 'TestAgent';
      provider.webviewView = undefined as any;

      await provider.endSession();

      expect(mockAgentSimulate.end).toHaveBeenCalled();
      expect((provider as any).agentPreview).toBeUndefined();
    });

    it('should notify webview when cancelling a session during startup', async () => {
      (provider as any).agentPreview = undefined;
      (provider as any).isSessionStarting = true;
      (provider as any).pendingStartAgentId = 'local:/workspace/testAgent.agent';
      (provider as any).pendingStartAgentSource = AgentSource.SCRIPT;
      const loadHistorySpy = jest.spyOn(provider as any, 'loadAndSendConversationHistory').mockResolvedValue(true);
      (mockWebviewView.webview.postMessage as jest.Mock).mockClear();

      await provider.endSession();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:sessionActive', false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:sessionStarting', false);
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'sessionEnded',
        data: {}
      });
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'clearMessages'
      });
      expect(loadHistorySpy).toHaveBeenCalledWith(
        'local:/workspace/testAgent.agent',
        AgentSource.SCRIPT,
        mockWebviewView
      );
      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ command: 'noHistoryFound' })
      );
      loadHistorySpy.mockRestore();
    });

    it('should show placeholder when cancelling session start with no history', async () => {
      (provider as any).agentPreview = undefined;
      (provider as any).isSessionStarting = true;
      (provider as any).pendingStartAgentId = '0X1234567890123';
      (provider as any).pendingStartAgentSource = AgentSource.PUBLISHED;
      const loadHistorySpy = jest.spyOn(provider as any, 'loadAndSendConversationHistory').mockResolvedValue(false);
      (mockWebviewView.webview.postMessage as jest.Mock).mockClear();

      await provider.endSession();

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'sessionEnded',
        data: {}
      });
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'clearMessages'
      });
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'noHistoryFound',
        data: { agentId: '0X1234567890123' }
      });
      loadHistorySpy.mockRestore();
    });

    it('should attempt to restore view when preview exists but session was still starting', async () => {
      const mockAgentSimulate = {
        end: jest.fn().mockResolvedValue(undefined)
      };
      Object.setPrototypeOf(mockAgentSimulate, AgentSimulate.prototype);
      (provider as any).agentPreview = mockAgentSimulate;
      (provider as any).sessionId = 'test-session';
      (provider as any).isSessionStarting = true;
      const restoreSpy = jest.spyOn(provider as any, 'restoreViewAfterCancelledStart').mockResolvedValue(undefined);

      await provider.endSession();

      expect(restoreSpy).toHaveBeenCalled();
      restoreSpy.mockRestore();
    });
  });

  describe('resetCurrentAgentView', () => {
    it('should throw when webview is not ready', async () => {
      provider.webviewView = undefined;
      (provider as any).currentAgentId = '0X1234567890123';

      await expect(provider.resetCurrentAgentView()).rejects.toThrow('Agent view is not ready to reset.');
    });

    it('should throw when no agent is selected', async () => {
      (provider as any).currentAgentId = undefined;

      await expect(provider.resetCurrentAgentView()).rejects.toThrow('No agent selected to reset.');
    });

    it('should request history or placeholder for the current agent', async () => {
      (provider as any).currentAgentId = 'local:/workspace/example.agent';
      const showHistorySpy = jest.spyOn(provider as any, 'showHistoryOrPlaceholder').mockResolvedValue(undefined);
      const executeCommandMock = vscode.commands.executeCommand as jest.Mock;
      executeCommandMock.mockClear();

      await provider.resetCurrentAgentView();

      expect(showHistorySpy).toHaveBeenCalledWith(
        'local:/workspace/example.agent',
        AgentSource.SCRIPT,
        mockWebviewView
      );
      expect(executeCommandMock).toHaveBeenCalledWith('setContext', 'agentforceDX:canResetAgentView', false);
      expect(executeCommandMock).toHaveBeenCalledWith('setContext', 'agentforceDX:sessionError', false);
      showHistorySpy.mockRestore();
    });
  });

  describe('postErrorMessage', () => {
    it('should set session error context before notifying webview', async () => {
      const executeCommandMock = vscode.commands.executeCommand as jest.Mock;
      executeCommandMock.mockClear();

      await (provider as any).postErrorMessage(mockWebviewView, 'Sample error');

      expect(executeCommandMock).toHaveBeenCalledWith('setContext', 'agentforceDX:sessionError', true);
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: { message: 'Sample error' }
      });
    });

    it('should strip HTML tags from error messages', async () => {
      const htmlError =
        '<div class="system-message error"><center><br><table bgcolor="white" cellpadding="0" cellspacing="0" width="758"><tbody><tr><td><span style="font-family: Verdana; font-size: medium; font-weight: bold;">This application is down for maintenance</span><br><br>Sorry for the inconvenience. We\'ll be back shortly.</td></tr></tbody></table></center></div>';

      await (provider as any).postErrorMessage(mockWebviewView, htmlError);

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: {
          message: "This application is down for maintenance Sorry for the inconvenience. We'll be back shortly."
        }
      });
    });

    it('should handle plain text errors without modification', async () => {
      const plainError = 'This is a plain text error';

      await (provider as any).postErrorMessage(mockWebviewView, plainError);

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: { message: 'This is a plain text error' }
      });
    });

    it('should strip nested HTML tags and preserve text content', async () => {
      const nestedHtmlError = '<div><span>Error:</span> <strong>Connection failed</strong></div>';

      await (provider as any).postErrorMessage(mockWebviewView, nestedHtmlError);

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: { message: 'Error: Connection failed' }
      });
    });
  });

  describe('exportConversation', () => {
    it('should throw when webview view is missing', async () => {
      provider.webviewView = undefined;
      (provider as any).currentAgentId = '0X123';

      await expect(provider.exportConversation()).rejects.toThrow('Agent view is not ready.');
    });

    it('should throw when no agent is selected', async () => {
      (provider as any).currentAgentId = undefined;

      await expect(provider.exportConversation()).rejects.toThrow('No agent selected to export.');
    });

    it('should post export request to the webview', async () => {
      (provider as any).currentAgentId = '0X1234567890123';
      (provider as any).currentAgentName = 'Exportable Agent';
      const postMessageMock = mockWebviewView.webview.postMessage as jest.Mock;
      postMessageMock.mockClear();

      await provider.exportConversation();

      expect(postMessageMock).toHaveBeenCalledWith({
        command: 'requestConversationExport',
        data: {
          agentId: '0X1234567890123',
          agentName: 'Exportable Agent'
        }
      });
    });
  });

  describe('setAgentId', () => {
    it('should set agent ID', () => {
      provider.setAgentId('0X123456789012345');
      expect((provider as any).currentAgentId).toBe('0X123456789012345');
    });

    it('should update agent ID when called multiple times', () => {
      provider.setAgentId('0X111111111111111');
      expect((provider as any).currentAgentId).toBe('0X111111111111111');

      provider.setAgentId('0X222222222222222');
      expect((provider as any).currentAgentId).toBe('0X222222222222222');
    });
  });

  describe('refreshAvailableAgents', () => {
    it('should clear pending preselected agent IDs so refresh does not immediately reselect', async () => {
      provider.setAgentId('0X123456789012345');
      (provider as any).currentAgentId = '0X123456789012345';
      const postMessageMock = mockWebviewView.webview.postMessage as jest.Mock;
      postMessageMock.mockClear();
      const endSessionSpy = jest.spyOn(provider, 'endSession').mockResolvedValue();

      await provider.refreshAvailableAgents();

      expect((provider as any).preselectedAgentId).toBeUndefined();
      expect(postMessageMock).toHaveBeenCalledWith({
        command: 'selectAgent',
        data: { agentId: '' }
      });
      endSessionSpy.mockRestore();
    });

    it('should set agentSelected to false to keep reload button visible', async () => {
      const executeCommandMock = vscode.commands.executeCommand as jest.Mock;
      executeCommandMock.mockClear();
      const endSessionSpy = jest.spyOn(provider, 'endSession').mockResolvedValue();

      await provider.refreshAvailableAgents();

      expect(executeCommandMock).toHaveBeenCalledWith('setContext', 'agentforceDX:agentSelected', false);
      endSessionSpy.mockRestore();
    });

    it('should set sessionActive to false for reload button visibility', async () => {
      const executeCommandMock = vscode.commands.executeCommand as jest.Mock;
      executeCommandMock.mockClear();
      const endSessionSpy = jest.spyOn(provider, 'endSession').mockResolvedValue();

      await provider.refreshAvailableAgents();

      expect(executeCommandMock).toHaveBeenCalledWith('setContext', 'agentforceDX:sessionActive', false);
      endSessionSpy.mockRestore();
    });

    it('should set sessionStarting to false for reload button visibility', async () => {
      const executeCommandMock = vscode.commands.executeCommand as jest.Mock;
      executeCommandMock.mockClear();
      const endSessionSpy = jest.spyOn(provider, 'endSession').mockResolvedValue();

      await provider.refreshAvailableAgents();

      expect(executeCommandMock).toHaveBeenCalledWith('setContext', 'agentforceDX:sessionStarting', false);
      endSessionSpy.mockRestore();
    });

    it('should set canResetAgentView to false for reload button visibility', async () => {
      const executeCommandMock = vscode.commands.executeCommand as jest.Mock;
      executeCommandMock.mockClear();
      const endSessionSpy = jest.spyOn(provider, 'endSession').mockResolvedValue();

      await provider.refreshAvailableAgents();

      expect(executeCommandMock).toHaveBeenCalledWith('setContext', 'agentforceDX:canResetAgentView', false);
      endSessionSpy.mockRestore();
    });

    it('should maintain reload button visibility even without agent selection', async () => {
      // Simulate state where no agent was ever selected
      (provider as any).currentAgentId = undefined;
      (provider as any).currentAgentName = undefined;
      const executeCommandMock = vscode.commands.executeCommand as jest.Mock;
      executeCommandMock.mockClear();
      const endSessionSpy = jest.spyOn(provider, 'endSession').mockResolvedValue();

      await provider.refreshAvailableAgents();

      // Verify all context variables are set to values that allow reload button visibility
      expect(executeCommandMock).toHaveBeenCalledWith('setContext', 'agentforceDX:agentSelected', false);
      expect(executeCommandMock).toHaveBeenCalledWith('setContext', 'agentforceDX:sessionActive', false);
      expect(executeCommandMock).toHaveBeenCalledWith('setContext', 'agentforceDX:sessionStarting', false);
      expect(executeCommandMock).toHaveBeenCalledWith('setContext', 'agentforceDX:canResetAgentView', false);
      endSessionSpy.mockRestore();
    });

    it('should clear current agent and reset all session state', async () => {
      provider.setAgentId('0X123456789012345');
      (provider as any).currentAgentId = '0X123456789012345';
      (provider as any).currentAgentName = 'TestAgent';
      const endSessionSpy = jest.spyOn(provider, 'endSession').mockResolvedValue();

      await provider.refreshAvailableAgents();

      expect((provider as any).currentAgentId).toBeUndefined();
      expect((provider as any).currentAgentName).toBeUndefined();
      expect((provider as any).pendingStartAgentId).toBeUndefined();
      expect((provider as any).pendingStartAgentSource).toBeUndefined();
      endSessionSpy.mockRestore();
    });

    it('should send refresh commands to webview', async () => {
      const postMessageMock = mockWebviewView.webview.postMessage as jest.Mock;
      postMessageMock.mockClear();
      const endSessionSpy = jest.spyOn(provider, 'endSession').mockResolvedValue();

      await provider.refreshAvailableAgents();

      expect(postMessageMock).toHaveBeenCalledWith({ command: 'selectAgent', data: { agentId: '' } });
      expect(postMessageMock).toHaveBeenCalledWith({ command: 'clearMessages' });
      expect(postMessageMock).toHaveBeenCalledWith({
        command: 'noHistoryFound',
        data: { agentId: 'refresh-placeholder' }
      });
      expect(postMessageMock).toHaveBeenCalledWith({ command: 'refreshAgents' });
      endSessionSpy.mockRestore();
    });
  });

  describe('resolveWebviewView', () => {
    it('should set webview options with correct settings', () => {
      // Mock getHtmlForWebview to avoid file system operations
      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><head></head><body>Test</body></html>');

      const mockWebviewView = {
        webview: {
          options: {},
          onDidReceiveMessage: jest.fn(() => ({ dispose: jest.fn() })),
          html: '',
          postMessage: jest.fn()
        }
      } as any;

      const mockToken = {} as vscode.CancellationToken;

      provider.resolveWebviewView(mockWebviewView, {} as any, mockToken);

      expect(mockWebviewView.webview.options).toHaveProperty('enableScripts', true);
      expect(mockWebviewView.webview.options).toHaveProperty('localResourceRoots');
      expect(mockWebviewView.webview.onDidReceiveMessage).toHaveBeenCalled();
    });

    it('should register message handler', () => {
      // Mock getHtmlForWebview to avoid file system operations
      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><head></head><body>Test</body></html>');

      const mockWebviewView = {
        webview: {
          options: {},
          onDidReceiveMessage: jest.fn(() => ({ dispose: jest.fn() })),
          html: '',
          postMessage: jest.fn()
        }
      } as any;

      const mockToken = {} as vscode.CancellationToken;

      provider.resolveWebviewView(mockWebviewView, {} as any, mockToken);

      expect(mockWebviewView.webview.onDidReceiveMessage).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Message Handlers', () => {
    let messageHandler: (message: any) => Promise<void>;
    let mockWebviewView: any;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      // Suppress console.error for expected error scenarios in tests
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      mockWebviewView = {
        webview: {
          options: {},
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          html: '',
          postMessage: jest.fn()
        }
      };

      // Initialize the webview to register message handlers
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as vscode.CancellationToken);
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should handle startSession with invalid agentId', async () => {
      await messageHandler({ command: 'startSession', data: {} });

      // Should post error back to webview
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: expect.stringMatching(/error|sessionError/)
        })
      );
    });

    it('should rollback session state when startSession fails', async () => {
      // Set up initial state to simulate a partially started session
      const mockAgentPreview = {
        end: jest.fn().mockResolvedValue(undefined)
      };
      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'existing-session';
      (provider as any).sessionActive = true;
      (provider as any).currentAgentName = 'TestAgent';
      (provider as any).currentPlanId = 'test-plan-id';

      // Mock Agent.listRemote to throw an error during session start
      const { Agent } = require('@salesforce/agents');
      Agent.listRemote = jest.fn().mockRejectedValueOnce(new Error('Connection failed'));

      await messageHandler({
        command: 'startSession',
        data: { agentId: '0Xx000000000001' } // Valid Bot ID format
      });

      // Verify the old session was properly ended before attempting new connection
      expect(mockAgentPreview.end).toHaveBeenCalledWith('existing-session', 'UserRequest');

      // Verify session state was rolled back after connection error
      expect((provider as any).agentPreview).toBeUndefined();
      expect((provider as any).isSessionActive).toBe(false);
      expect((provider as any).currentAgentName).toBeUndefined();
      expect((provider as any).currentPlanId).toBeUndefined();

      // Verify error was sent to webview
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'error',
          data: expect.objectContaining({
            message: expect.any(String)
          })
        })
      );
    });

    it('should handle getConfiguration command', async () => {
      jest.clearAllMocks();
      const configGet = jest.fn().mockReturnValue('test-value');
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({ get: configGet });

      await messageHandler({
        command: 'getConfiguration',
        data: { section: 'salesforce.agentforceDX.someSetting' }
      });

      expect(vscode.workspace.getConfiguration).toHaveBeenCalled();
      expect(configGet).toHaveBeenCalledWith('salesforce.agentforceDX.someSetting');
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'configuration',
        data: { section: 'salesforce.agentforceDX.someSetting', value: 'test-value' }
      });
    });

    it('should handle clearChat command', async () => {
      jest.clearAllMocks();
      await expect(messageHandler({ command: 'clearChat' })).resolves.not.toThrow();
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalled();
    });

    it('should handle setSelectedAgentId command', async () => {
      jest.clearAllMocks();
      await messageHandler({ command: 'setSelectedAgentId', data: { agentId: '0X123' } });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:agentSelected', true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:canResetAgentView',
        false
      );
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:sessionError', false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:hasConversationData',
        false
      );
    });

    it('should ignore executeCommand messages without commandId', async () => {
      jest.clearAllMocks();
      await expect(
        messageHandler({ command: 'executeCommand', data: { command: 'test.command' } })
      ).resolves.not.toThrow();
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should handle sendChatMessage without active session', async () => {
      await expect(messageHandler({ command: 'sendChatMessage', data: { message: 'Hello' } })).resolves.not.toThrow();
    });

    it('should surface errors when saving apex debug log fails', async () => {
      const sendMock = jest.fn().mockResolvedValue({
        messages: [{ message: 'Agent reply' }],
        apexDebugLog: { Id: '07L123' }
      });
      (provider as any).agentPreview = { send: sendMock, setApexDebugMode: jest.fn() };
      (provider as any).sessionId = 'session-123';
      (provider as any).isApexDebuggingEnabled = true;

      const saveSpy = jest.spyOn(provider as any, 'saveApexDebugLog').mockRejectedValue(new Error('write failed'));

      await messageHandler({ command: 'sendChatMessage', data: { message: 'Hello' } });

      expect(sendMock).toHaveBeenCalledWith('session-123', 'Hello');
      expect(saveSpy).toHaveBeenCalledWith({ Id: '07L123' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error handling apex debug log:', expect.any(Error));
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Error processing debug log: write failed');

      const debugErrorCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any[]) => call[0].command === 'debugLogError'
      );
      expect(debugErrorCall?.[0].data?.message).toContain('write failed');

      saveSpy.mockRestore();
    });

    it('should notify when debug mode produces no apex log', async () => {
      const sendMock = jest.fn().mockResolvedValue({
        messages: [{ message: 'Agent reply' }],
        apexDebugLog: undefined
      });
      (provider as any).agentPreview = { send: sendMock, setApexDebugMode: jest.fn() };
      (provider as any).sessionId = 'session-123';
      (provider as any).isApexDebuggingEnabled = true;

      await messageHandler({ command: 'sendChatMessage', data: { message: 'Hello' } });

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Debug mode is enabled but no Apex was executed.'
      );
    });

    it('should handle endSession when no session active', async () => {
      await expect(messageHandler({ command: 'endSession' })).resolves.not.toThrow();
    });

    it('should terminate active session from endSession message', async () => {
      const mockAgentSimulate = {
        end: jest.fn().mockResolvedValue(undefined),
        setApexDebugMode: jest.fn()
      };
      Object.setPrototypeOf(mockAgentSimulate, AgentSimulate.prototype);
      (provider as any).agentPreview = mockAgentSimulate;
      (provider as any).sessionId = 'session-123';
      (provider as any).currentAgentName = 'Agent Under Test';

      const endSessionSpy = jest.spyOn(provider, 'endSession');

      await messageHandler({ command: 'endSession' });

      expect(endSessionSpy).toHaveBeenCalled();
      expect(mockAgentSimulate.end).toHaveBeenCalled();

      endSessionSpy.mockRestore();
    });

    it('should handle getAvailableAgents command', async () => {
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'none',
        username: 'test@example.com',
        error: 'No apps'
      });
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);

      await expect(messageHandler({ command: 'getAvailableAgents' })).resolves.not.toThrow();
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalled();
    });

    it('should notify webview when no client apps are available', async () => {
      const discoverSpy = jest
        .spyOn(provider as any, 'discoverLocalAgents')
        .mockResolvedValue([
          { name: 'LocalAgent', id: 'local:/workspace/local.agent', type: 'script', filePath: '/workspace/local.agent' }
        ]);
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'none',
        username: 'user@example.com',
        error: 'Client app required'
      });

      await messageHandler({ command: 'getAvailableAgents' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'availableAgents',
        data: {
          agents: [
            {
              name: 'LocalAgent',
              id: 'local:/workspace/local.agent',
              type: 'script',
              filePath: '/workspace/local.agent'
            }
          ],
          selectedAgentId: undefined
        }
      });
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'clientAppRequired',
        data: {
          message:
            'See "Preview an Agent" in the "Agentforce Developer Guide" for complete documentation: https://developer.salesforce.com/docs/einstein/genai/guide/agent-dx-preview.html.',
          username: 'user@example.com',
          error: 'Client app required'
        }
      });

      discoverSpy.mockRestore();
    });

    it('should prompt user to select a client app when multiple exist', async () => {
      const discoverSpy = jest.spyOn(provider as any, 'discoverLocalAgents').mockResolvedValue([]);
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'multiple',
        clientApps: [{ name: 'AppOne' }, { name: 'AppTwo' }],
        username: 'user@example.com'
      });

      await messageHandler({ command: 'getAvailableAgents' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'availableAgents',
        data: {
          agents: [],
          selectedAgentId: undefined
        }
      });
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'selectClientApp',
        data: {
          clientApps: [{ name: 'AppOne' }, { name: 'AppTwo' }],
          username: 'user@example.com'
        }
      });

      discoverSpy.mockRestore();
    });

    it('should handle getTraceData command', async () => {
      await expect(messageHandler({ command: 'getTraceData' })).resolves.not.toThrow();
    });

    it('should handle clientAppSelected command', async () => {
      (getAvailableClientApps as jest.Mock).mockResolvedValue({ type: 'single', clientApp: 'TestApp' });
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({ instanceUrl: 'https://test.salesforce.com' });
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);

      await expect(
        messageHandler({ command: 'clientAppSelected', data: { clientAppId: 'TestApp' } })
      ).resolves.not.toThrow();
    });

    it('should emit error when clientAppSelected payload is missing name', async () => {
      await messageHandler({ command: 'clientAppSelected', data: {} });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: { message: expect.stringContaining('No client app name provided') }
      });
    });

    it('should emit error when selecting client app fails', async () => {
      (createConnectionWithClientApp as jest.Mock).mockRejectedValue(new Error('connection failed'));

      await messageHandler({ command: 'clientAppSelected', data: { clientAppName: 'BrokenApp' } });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: { message: expect.stringContaining('connection failed') }
      });

      (createConnectionWithClientApp as jest.Mock).mockReset();
    });

    it('should handle setApexDebugging command', async () => {
      await expect(messageHandler({ command: 'setApexDebugging', data: true })).resolves.not.toThrow();
    });

    it('should handle loadAgentHistory command', async () => {
      (readTranscriptEntries as jest.Mock).mockResolvedValue([]);

      await expect(messageHandler({ command: 'loadAgentHistory', data: { agentId: '0X123' } })).resolves.not.toThrow();
    });

    it('should fall back to auto-start when loadAgentHistory encounters errors', async () => {
      (readTranscriptEntries as jest.Mock).mockRejectedValue(new Error('history missing'));

      await messageHandler({ command: 'loadAgentHistory', data: { agentId: '0X123' } });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'noHistoryFound',
        data: { agentId: '0X123' }
      });
    });
  });

  describe('startSession Message Handler', () => {
    let messageHandler: (message: any) => Promise<void>;
    let mockWebviewView: any;
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      mockWebviewView = {
        webview: {
          options: {},
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          html: '',
          postMessage: jest.fn()
        }
      };

      provider.resolveWebviewView(mockWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should end existing session before starting new one', async () => {
      // Set up an existing session
      const mockExistingAgentPreview = {
        end: jest.fn().mockResolvedValue(undefined),
        start: jest.fn().mockResolvedValue({
          sessionId: 'new-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };

      (provider as any).agentPreview = mockExistingAgentPreview;
      (provider as any).sessionId = 'old-session';
      Object.setPrototypeOf((provider as any).agentPreview, AgentSimulate.prototype);

      // Mock dependencies for new session
      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com',
        tooling: { _baseUrl: () => 'https://test.salesforce.com/services/data/v56.0' }
      });
      const { Agent } = require('@salesforce/agents');
      Agent.listRemote = jest.fn().mockResolvedValue([]);

      // Start a new session with a published agent (using valid 15-char Bot ID)
      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      // Verify old session was ended
      expect(mockExistingAgentPreview.end).toHaveBeenCalled();
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'sessionStarting',
        data: { message: 'Starting session...' }
      });
    });

    it('should cancel session start when endSession is invoked mid-start', async () => {
      const mockLifecycle = {
        on: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        removeAllListeners: jest.fn()
      };
      (Lifecycle.getInstance as jest.Mock).mockReturnValue(mockLifecycle);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      let notifyStartCalled!: () => void;
      const startCalled = new Promise<void>(resolve => {
        notifyStartCalled = resolve;
      });

      let resolveStart!: (value: any) => void;
      const startDeferred = new Promise<any>(resolve => {
        resolveStart = resolve;
      });

      const mockAgentSimulate = {
        start: jest.fn().mockImplementation(() => {
          notifyStartCalled();
          return startDeferred;
        }),
        end: jest.fn().mockResolvedValue(undefined),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      const pendingStart = messageHandler({
        command: 'startSession',
        data: { agentId: 'local:/workspace/testAgent.agent' }
      });

      await startCalled;
      await provider.endSession();

      resolveStart({
        sessionId: 'script-session',
        messages: [{ type: 'Inform', message: 'Hello' }]
      });

      await pendingStart;

      expect(mockAgentSimulate.end).toHaveBeenCalled();
      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ command: 'sessionStarted' })
      );
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalledWith(expect.stringContaining('Session started'));

      // Verify no logging when session is cancelled
      const channelService = CoreExtensionService.getChannelService();
      expect(channelService.appendLine).not.toHaveBeenCalledWith(expect.stringContaining('Simulation session started'));
    });

    it('should suppress start errors if session was cancelled', async () => {
      const mockLifecycle = {
        on: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        removeAllListeners: jest.fn()
      };
      (Lifecycle.getInstance as jest.Mock).mockReturnValue(mockLifecycle);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      let notifyStartCalled!: () => void;
      const startCalled = new Promise<void>(resolve => {
        notifyStartCalled = resolve;
      });

      let rejectStart!: (error: unknown) => void;
      const startDeferred = new Promise<any>((_resolve, reject) => {
        rejectStart = reject;
      });

      const mockAgentSimulate = {
        start: jest.fn().mockImplementation(() => {
          notifyStartCalled();
          return startDeferred;
        }),
        end: jest.fn().mockResolvedValue(undefined),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      const pendingHandler = messageHandler({
        command: 'startSession',
        data: { agentId: 'local:/workspace/testAgent.agent' }
      });

      await startCalled;
      await provider.endSession();
      rejectStart(new Error('start failed'));

      await expect(pendingHandler).resolves.not.toThrow();
      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ command: 'error' })
      );
    });

    it('should handle error when ending existing session', async () => {
      // Set up an existing session that throws on end
      const mockExistingAgentPreview = {
        end: jest.fn().mockRejectedValue(new Error('End session failed')),
        start: jest.fn().mockResolvedValue({
          sessionId: 'new-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };

      (provider as any).agentPreview = mockExistingAgentPreview;
      (provider as any).sessionId = 'old-session';
      Object.setPrototypeOf((provider as any).agentPreview, AgentPreview.prototype);

      // Mock dependencies
      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com',
        tooling: { _baseUrl: () => 'https://test.salesforce.com/services/data/v56.0' }
      });
      const { Agent } = require('@salesforce/agents');
      Agent.listRemote = jest.fn().mockResolvedValue([]);

      // Should continue despite error ending old session (using valid 15-char Bot ID)
      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith('Error ending previous session:', expect.any(Error));
    });

    it('should clear messages when starting a new session', async () => {
      // Mock dependencies
      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com',
        tooling: { _baseUrl: () => 'https://test.salesforce.com/services/data/v56.0' }
      });
      const { Agent } = require('@salesforce/agents');
      Agent.listRemote = jest.fn().mockResolvedValue([]);

      // Start a session
      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      // Verify clearMessages was sent before sessionStarting
      const calls = mockWebviewView.webview.postMessage.mock.calls;
      const clearMessagesCall = calls.find((call: any) => call[0]?.command === 'clearMessages');
      const sessionStartingCall = calls.find((call: any) => call[0]?.command === 'sessionStarting');

      expect(clearMessagesCall).toBeDefined();
      expect(sessionStartingCall).toBeDefined();

      // Ensure clearMessages comes before sessionStarting
      const clearMessagesIndex = calls.indexOf(clearMessagesCall);
      const sessionStartingIndex = calls.indexOf(sessionStartingCall);
      expect(clearMessagesIndex).toBeLessThan(sessionStartingIndex);
    });

    it('should reset trace history when a script session starts', async () => {
      const mockLifecycle = {
        on: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        removeAllListeners: jest.fn()
      };
      (Lifecycle.getInstance as jest.Mock).mockReturnValue(mockLifecycle);
      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as jest.Mock).mockImplementationOnce(() => mockAgentSimulate);

      await messageHandler({
        command: 'startSession',
        data: { agentId: 'local:/workspace/test.agent' }
      });

      expect(clearTraceHistory).toHaveBeenCalledWith('test.agent');
      expect(readTraceHistoryEntries).toHaveBeenCalledWith('test.agent');
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'traceHistory',
        data: expect.objectContaining({ agentId: 'local:/workspace/test.agent', entries: [] })
      });
    });

    it('should start session with script agent and set up lifecycle listeners', async () => {
      const mockLifecycle = {
        on: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        removeAllListeners: jest.fn()
      };
      (Lifecycle.getInstance as jest.Mock).mockReturnValue(mockLifecycle);

      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: [{ type: 'Inform', message: 'Hello from script' }]
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      await messageHandler({
        command: 'startSession',
        data: { agentId: 'local:/workspace/testAgent.agent' }
      });

      // Verify lifecycle listeners were set up
      expect(Lifecycle.getInstance).toHaveBeenCalled();
      expect(mockLifecycle.on).toHaveBeenCalledWith('agents:compiling', expect.any(Function));
      expect(mockLifecycle.on).toHaveBeenCalledWith('agents:simulation-starting', expect.any(Function));

      // Verify AgentSimulate was created with correct params
      expect(AgentSimulate).toHaveBeenCalledWith(expect.any(Object), '/workspace/testAgent.agent', true);

      // Verify session was started
      expect(mockAgentSimulate.start).toHaveBeenCalled();
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'sessionStarted'
        })
      );
    });

    it('should handle compilation error event from lifecycle', async () => {
      let compilationListener: any;
      const mockLifecycle = {
        on: jest.fn((event, handler) => {
          if (event === 'agents:compiling') {
            compilationListener = handler;
          }
          return { dispose: jest.fn() };
        }),
        removeAllListeners: jest.fn()
      };
      (Lifecycle.getInstance as jest.Mock).mockReturnValue(mockLifecycle);

      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      const channelService = CoreExtensionService.getChannelService();
      await messageHandler({
        command: 'startSession',
        data: { agentId: 'local:/workspace/testAgent.agent' }
      });

      // Trigger compilation error
      await compilationListener({ error: 'Compilation failed!' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'compilationError',
        data: { message: 'Compilation failed!' }
      });
      // Compilation error logging was removed from source
    });

    it('should handle compilation starting event from lifecycle', async () => {
      let compilationListener: any;
      const mockLifecycle = {
        on: jest.fn((event, handler) => {
          if (event === 'agents:compiling') {
            compilationListener = handler;
          }
          return { dispose: jest.fn() };
        }),
        removeAllListeners: jest.fn()
      };
      (Lifecycle.getInstance as jest.Mock).mockReturnValue(mockLifecycle);

      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      const channelService = CoreExtensionService.getChannelService();
      await messageHandler({
        command: 'startSession',
        data: { agentId: 'local:/workspace/testAgent.agent' }
      });

      // Trigger compilation starting
      await compilationListener({ message: 'Compiling agent...' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'compilationStarting',
        data: { message: 'Compiling agent...' }
      });
      expect(channelService.appendLine).toHaveBeenCalledWith('Compilation end point called.');
    });

    it('should handle simulation starting event from lifecycle', async () => {
      let simulationListener: any;
      const mockLifecycle = {
        on: jest.fn((event, handler) => {
          if (event === 'agents:simulation-starting') {
            simulationListener = handler;
          }
          return { dispose: jest.fn() };
        }),
        removeAllListeners: jest.fn()
      };
      (Lifecycle.getInstance as jest.Mock).mockReturnValue(mockLifecycle);

      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      const channelService = CoreExtensionService.getChannelService();
      await messageHandler({
        command: 'startSession',
        data: { agentId: 'local:/workspace/testAgent.agent' }
      });

      // Trigger simulation starting
      await simulationListener({ message: 'Starting simulation...' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'simulationStarting',
        data: { message: 'Starting simulation...' }
      });
      expect(channelService.appendLine).toHaveBeenCalledWith('Simulation session started.');
    });

    it('should ignore lifecycle events after session start cancellation', async () => {
      let simulationListener: any;
      const mockLifecycle = {
        on: jest.fn((event, handler) => {
          if (event === 'agents:simulation-starting') {
            simulationListener = handler;
          }
          return { dispose: jest.fn() };
        }),
        removeAllListeners: jest.fn()
      };
      (Lifecycle.getInstance as jest.Mock).mockReturnValue(mockLifecycle);

      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: []
        }),
        end: jest.fn().mockResolvedValue(undefined),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      await messageHandler({
        command: 'startSession',
        data: { agentId: 'local:/workspace/testAgent.agent' }
      });

      await provider.endSession();
      mockWebviewView.webview.postMessage.mockClear();

      await simulationListener({ message: 'Starting simulation...' });

      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ command: 'simulationStarting' })
      );
    });

    it('should use default message when compilation event has no message', async () => {
      let compilationListener: any;
      const mockLifecycle = {
        on: jest.fn((event, handler) => {
          if (event === 'agents:compiling') {
            compilationListener = handler;
          }
          return { dispose: jest.fn() };
        }),
        removeAllListeners: jest.fn()
      };
      (Lifecycle.getInstance as jest.Mock).mockReturnValue(mockLifecycle);

      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      await messageHandler({
        command: 'startSession',
        data: { agentId: 'local:/workspace/testAgent.agent' }
      });

      // Trigger compilation starting with no message
      await compilationListener({});

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'compilationStarting',
        data: { message: 'Compiling agent...' }
      });
    });

    it('should use default message when simulation event has no message', async () => {
      let simulationListener: any;
      const mockLifecycle = {
        on: jest.fn((event, handler) => {
          if (event === 'agents:simulation-starting') {
            simulationListener = handler;
          }
          return { dispose: jest.fn() };
        }),
        removeAllListeners: jest.fn()
      };
      (Lifecycle.getInstance as jest.Mock).mockReturnValue(mockLifecycle);

      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      await messageHandler({
        command: 'startSession',
        data: { agentId: 'local:/workspace/testAgent.agent' }
      });

      // Trigger simulation starting with no message
      await simulationListener({});

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'simulationStarting',
        data: { message: 'Starting simulation...' }
      });
    });

    it('should enable debug mode for script agent when apex debugging is active', async () => {
      const mockLifecycle = {
        on: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        removeAllListeners: jest.fn()
      };
      (Lifecycle.getInstance as jest.Mock).mockReturnValue(mockLifecycle);

      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      // Enable debug mode
      (provider as any).isApexDebuggingEnabled = true;

      await messageHandler({
        command: 'startSession',
        data: { agentId: 'local:/workspace/testAgent.agent' }
      });

      expect(mockAgentSimulate.setApexDebugMode).toHaveBeenCalledWith(true);
    });

    it('should reuse selected client app and emit default welcome message for script agent', async () => {
      const defaultConnectionMock = CoreExtensionService.getDefaultConnection as jest.Mock;
      defaultConnectionMock.mockReset();
      defaultConnectionMock.mockImplementation(() => {
        throw new Error('getDefaultConnection should not be used when client app is selected');
      });

      const mockLifecycle = {
        on: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        removeAllListeners: jest.fn()
      };
      (Lifecycle.getInstance as jest.Mock).mockReturnValue(mockLifecycle);

      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      (provider as any).selectedClientApp = 'SelectedApp';
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({ instanceUrl: 'https://test.salesforce.com' });

      await messageHandler({
        command: 'startSession',
        data: { agentId: 'local:/workspace/testAgent.agent' }
      });

      expect(createConnectionWithClientApp).toHaveBeenCalledWith('SelectedApp');
      expect(CoreExtensionService.getDefaultConnection).not.toHaveBeenCalled();

      const sessionStartedCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any[]) => call[0].command === 'sessionStarted'
      );
      // The code sends agentMessage?.message directly as data (string or undefined)
      // If no message is found, it will be undefined
      expect(sessionStartedCall?.[0].data).toBeUndefined();

      defaultConnectionMock.mockReset();
    });

    it('should start session with published agent', async () => {
      const mockAgentPreview = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'published-session',
          messages: [{ type: 'Inform', message: 'Hello from published agent' }]
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentPreview as any).mockImplementation(() => mockAgentPreview);

      // Mock the Agent.listRemote at the module level
      const { Agent } = require('@salesforce/agents');
      Agent.listRemote = jest
        .fn()
        .mockResolvedValue([{ Id: '0X1234567890123', MasterLabel: 'Test Agent', DeveloperName: 'TestAgent' }]);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com',
        tooling: { _baseUrl: () => 'https://test.salesforce.com/services/data/v56.0' }
      });

      const channelService = CoreExtensionService.getChannelService();
      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      // Verify validation was called (implicitly by not throwing)
      // Verify AgentPreview was created
      expect(AgentPreview).toHaveBeenCalledWith(expect.any(Object), '0X1234567890123');

      // Verify agent name was fetched
      expect(Agent.listRemote).toHaveBeenCalled();

      // Verify session was started
      expect(mockAgentPreview.start).toHaveBeenCalled();
    });
    it('should prioritize message property for agent message content', async () => {
      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: [
            { type: 'Inform', message: 'Message in message property', data: 'Should not use this', body: 'Or this' }
          ]
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      const mockLifecycle = {
        on: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        removeAllListeners: jest.fn()
      };
      (Lifecycle.getInstance as jest.Mock).mockReturnValue(mockLifecycle);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      await messageHandler({
        command: 'startSession',
        data: { agentId: 'local:/workspace/testAgent.agent' }
      });

      const sessionStartedCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any[]) => call[0].command === 'sessionStarted'
      );
      // The code sends agentMessage?.message directly as data (string or undefined)
      expect(sessionStartedCall?.[0].data).toBe('Message in message property');
    });

    it('should enable debug mode for published agent when apex debugging is active', async () => {
      const mockAgentPreview = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'published-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentPreview as any).mockImplementation(() => mockAgentPreview);

      // Mock the Agent.listRemote at the module level
      const { Agent } = require('@salesforce/agents');
      Agent.listRemote = jest.fn().mockResolvedValue([{ Id: '0X1234567890123', MasterLabel: 'Test Agent' }]);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com',
        tooling: { _baseUrl: () => 'https://test.salesforce.com/services/data/v56.0' }
      });

      // Enable debug mode
      (provider as any).isApexDebuggingEnabled = true;

      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      expect(mockAgentPreview.setApexDebugMode).toHaveBeenCalledWith(true);
    });

    it('should provide deactivation guidance when org reports no valid version', async () => {
      const defaultConnectionMock = CoreExtensionService.getDefaultConnection as jest.Mock;
      defaultConnectionMock.mockReset();
      defaultConnectionMock.mockRejectedValue(new Error('404 NOT_FOUND: No valid version available'));

      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      const errorCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any[]) => call[0].command === 'error'
      );
      expect(errorCall?.[0].data?.message).toContain('currently deactivated');

      defaultConnectionMock.mockReset();
    });

    it('should provide missing agent guidance when org responds with 404', async () => {
      const defaultConnectionMock = CoreExtensionService.getDefaultConnection as jest.Mock;
      defaultConnectionMock.mockReset();
      defaultConnectionMock.mockRejectedValue(new Error('Request failed with status 404 NOT_FOUND'));

      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      const errorCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any[]) => call[0].command === 'error'
      );
      expect(errorCall?.[0].data?.message).toContain("couldn't be found");

      defaultConnectionMock.mockReset();
    });

    it('should provide permission guidance when org responds with 403', async () => {
      const defaultConnectionMock = CoreExtensionService.getDefaultConnection as jest.Mock;
      defaultConnectionMock.mockReset();
      defaultConnectionMock.mockRejectedValue(new Error('FORBIDDEN: status 403'));

      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      const errorCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any[]) => call[0].command === 'error'
      );
      expect(errorCall?.[0].data?.message).toContain("don't have permission");

      defaultConnectionMock.mockReset();
    });

    it('should use preselected agent ID if provided', async () => {
      const mockAgentPreview = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'preselected-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentPreview as any).mockImplementation(() => mockAgentPreview);

      // Mock the Agent.listRemote at the module level
      const { Agent } = require('@salesforce/agents');
      Agent.listRemote = jest.fn().mockResolvedValue([{ Id: '0X9999999999999', MasterLabel: 'Preselected Agent' }]);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com',
        tooling: { _baseUrl: () => 'https://test.salesforce.com/services/data/v56.0' }
      });

      // Set preselected agent ID (15 characters: 0X + 13 digits)
      (provider as any).currentAgentId = '0X9999999999999';

      await messageHandler({
        command: 'startSession',
        data: {} // No agentId in message data
      });

      // Verify AgentPreview was created with preselected ID
      expect(AgentPreview).toHaveBeenCalledWith(expect.any(Object), '0X9999999999999');
    });
  });

  describe('sendChatMessage Message Handler', () => {
    let messageHandler: (message: any) => Promise<void>;
    let mockWebviewView: any;
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      mockWebviewView = {
        webview: {
          options: {},
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          html: '',
          postMessage: jest.fn()
        }
      };

      provider.resolveWebviewView(mockWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should send chat message and receive response', async () => {
      const mockAgentPreview = {
        send: jest.fn().mockResolvedValue({
          messages: [{ message: 'Agent response', planId: 'test-plan-id' }],
          apexDebugLog: null
        })
      };

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Hello agent' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'messageStarting',
        data: { message: 'Sending message...' }
      });

      expect(mockAgentPreview.send).toHaveBeenCalledWith('test-session', 'Hello agent');

      expect((provider as any).currentPlanId).toBe('test-plan-id');
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'messageSent',
        data: { content: 'Agent response' }
      });

      // Verify logging
      const channelService = CoreExtensionService.getChannelService();
      expect(channelService.appendLine).toHaveBeenCalledWith('Simulation message sent - "Hello agent"');
    });

    it('should use default message when agent response is empty', async () => {
      const mockAgentPreview = {
        send: jest.fn().mockResolvedValue({
          messages: [{}], // No message or planId property
          apexDebugLog: null
        })
      };

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Hello' }
      });

      expect((provider as any).currentPlanId).toBeUndefined();
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'messageSent',
        data: { content: undefined }
      });
    });

    it('should send error message from server response when no planId', async () => {
      const mockAgentPreview = {
        send: jest.fn().mockResolvedValue({
          messages: [
            {
              type: 'Inform',
              message: 'Unfortunately a system error occurred. Please try again.',
              metrics: {},
              result: [],
              citedReferences: []
            }
          ],
          apexDebugLog: null
        })
      };

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Hello' }
      });

      expect((provider as any).currentPlanId).toBeUndefined();
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'messageSent',
        data: { content: 'Unfortunately a system error occurred. Please try again.' }
      });
    });

    it('should handle apex debug log when debugging is enabled', async () => {
      const mockApexLog = {
        Id: 'logId123',
        LogLength: 1000
      };

      const mockAgentPreview = {
        send: jest.fn().mockResolvedValue({
          messages: [{ message: 'Response' }],
          apexDebugLog: mockApexLog
        })
      };

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';
      (provider as any).isApexDebuggingEnabled = true;

      // Mock saveApexDebugLog
      jest.spyOn(provider as any, 'saveApexDebugLog').mockResolvedValue('/path/to/log.log');
      // Mock setupAutoDebugListeners
      jest.spyOn(provider as any, 'setupAutoDebugListeners').mockImplementation();

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Test message' }
      });

      expect((provider as any).saveApexDebugLog).toHaveBeenCalledWith(mockApexLog);
      expect((provider as any).setupAutoDebugListeners).toHaveBeenCalled();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'sf.launch.replay.debugger.logfile.path',
        '/path/to/log.log'
      );
    });

    it('should handle error when launching apex debugger fails', async () => {
      const mockApexLog = { Id: 'logId123' };

      const mockAgentPreview = {
        send: jest.fn().mockResolvedValue({
          messages: [{ message: 'Response' }],
          apexDebugLog: mockApexLog
        })
      };

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';
      (provider as any).isApexDebuggingEnabled = true;

      jest.spyOn(provider as any, 'saveApexDebugLog').mockResolvedValue('/path/to/log.log');
      jest.spyOn(provider as any, 'setupAutoDebugListeners').mockImplementation();
      (vscode.commands.executeCommand as jest.Mock).mockRejectedValue(new Error('Debugger not found'));

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Test' }
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith('Could not launch Apex Replay Debugger:', expect.any(Error));
    });

    it('should handle error when saving apex debug log fails', async () => {
      const mockApexLog = { Id: 'logId123' };

      const mockAgentPreview = {
        send: jest.fn().mockResolvedValue({
          messages: [{ message: 'Response' }],
          apexDebugLog: mockApexLog
        })
      };

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';
      (provider as any).isApexDebuggingEnabled = true;

      jest.spyOn(provider as any, 'saveApexDebugLog').mockRejectedValue(new Error('Failed to save log'));

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Test' }
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error handling apex debug log:', expect.any(Error));
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Error processing debug log: Failed to save log');
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'debugLogError',
        data: { message: 'Error processing debug log: Failed to save log' }
      });
    });

    it('should handle non-Error exceptions when saving apex debug log fails', async () => {
      const mockApexLog = { Id: 'logId123' };

      const mockAgentPreview = {
        send: jest.fn().mockResolvedValue({
          messages: [{ message: 'Response' }],
          apexDebugLog: mockApexLog
        })
      };

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';
      (provider as any).isApexDebuggingEnabled = true;

      jest.spyOn(provider as any, 'saveApexDebugLog').mockRejectedValue('string error');

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Test' }
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error handling apex debug log:', 'string error');
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Error processing debug log: Unknown error');
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'debugLogError',
        data: { message: 'Error processing debug log: Unknown error' }
      });
    });

    it('should skip debugger launch when saveApexDebugLog returns undefined', async () => {
      const mockApexLog = { Id: 'logId123' };

      const mockAgentPreview = {
        send: jest.fn().mockResolvedValue({
          messages: [{ message: 'Response' }],
          apexDebugLog: mockApexLog
        })
      };

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';
      (provider as any).isApexDebuggingEnabled = true;

      jest.spyOn(provider as any, 'saveApexDebugLog').mockResolvedValue(undefined);

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Test' }
      });

      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
        'sf.launch.replay.debugger.logfile.path',
        expect.anything()
      );
    });

    it('should notify when debug mode is enabled but no apex was executed', async () => {
      const mockAgentPreview = {
        send: jest.fn().mockResolvedValue({
          messages: [{ message: 'Response' }],
          apexDebugLog: null // No debug log
        })
      };

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';
      (provider as any).isApexDebuggingEnabled = true;

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Test' }
      });

      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Debug mode is enabled but no Apex was executed.'
      );
    });
  });

  describe('loadAgentHistory Message Handler', () => {
    let messageHandler: (message: any) => Promise<void>;
    let mockWebviewView: any;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      mockWebviewView = {
        webview: {
          options: {},
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          html: '',
          postMessage: jest.fn()
        }
      };

      provider.resolveWebviewView(mockWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should load history for script agent and call loadAndSendConversationHistory when history exists', async () => {
      const loadHistorySpy = jest.spyOn(provider as any, 'loadAndSendConversationHistory').mockResolvedValue(true);
      const loadTraceSpy = jest.spyOn(provider as any, 'loadAndSendTraceHistory').mockResolvedValue(undefined);

      await messageHandler({
        command: 'loadAgentHistory',
        data: { agentId: 'local:/workspace/myAgent.agent' }
      });

      // Should clear messages first
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'clearMessages'
      });

      // Should call loadAndSendConversationHistory when history exists
      expect((provider as any).loadAndSendConversationHistory).toHaveBeenCalledWith(
        'local:/workspace/myAgent.agent',
        AgentSource.SCRIPT,
        mockWebviewView
      );
      expect((provider as any).loadAndSendTraceHistory).toHaveBeenCalledWith(
        'local:/workspace/myAgent.agent',
        AgentSource.SCRIPT,
        mockWebviewView
      );
      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ command: 'noHistoryFound' })
      );
      loadHistorySpy.mockRestore();
      loadTraceSpy.mockRestore();
    });

    it('should load history for published agent when history exists', async () => {
      const loadHistorySpy = jest.spyOn(provider as any, 'loadAndSendConversationHistory').mockResolvedValue(true);
      const loadTraceSpy = jest.spyOn(provider as any, 'loadAndSendTraceHistory').mockResolvedValue(undefined);

      await messageHandler({
        command: 'loadAgentHistory',
        data: { agentId: '0X1234567890123' }
      });

      // Should call loadAndSendConversationHistory
      expect((provider as any).loadAndSendConversationHistory).toHaveBeenCalledWith(
        '0X1234567890123',
        AgentSource.PUBLISHED,
        mockWebviewView
      );
      expect((provider as any).loadAndSendTraceHistory).toHaveBeenCalledWith(
        '0X1234567890123',
        AgentSource.PUBLISHED,
        mockWebviewView
      );
      expect(mockWebviewView.webview.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ command: 'noHistoryFound' })
      );
      loadHistorySpy.mockRestore();
      loadTraceSpy.mockRestore();
    });

    it('should send noHistoryFound when no history exists', async () => {
      const loadHistorySpy = jest.spyOn(provider as any, 'loadAndSendConversationHistory').mockResolvedValue(false);

      await messageHandler({
        command: 'loadAgentHistory',
        data: { agentId: '0X1234567890123' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'noHistoryFound',
        data: { agentId: '0X1234567890123' }
      });
      loadHistorySpy.mockRestore();
    });

    it('should send noHistoryFound when transcriptEntries is null', async () => {
      const loadHistorySpy = jest.spyOn(provider as any, 'loadAndSendConversationHistory').mockResolvedValue(false);

      await messageHandler({
        command: 'loadAgentHistory',
        data: { agentId: '0X1234567890123' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'noHistoryFound',
        data: { agentId: '0X1234567890123' }
      });
      loadHistorySpy.mockRestore();
    });

    it('should handle error and send noHistoryFound', async () => {
      const loadHistorySpy = jest
        .spyOn(provider as any, 'loadAndSendConversationHistory')
        .mockRejectedValue(new Error('Failed to read history'));

      await messageHandler({
        command: 'loadAgentHistory',
        data: { agentId: '0X1234567890123' }
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading history:', expect.any(Error));
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'noHistoryFound',
        data: { agentId: '0X1234567890123' }
      });
      loadHistorySpy.mockRestore();
    });

    it('should not process when agentId is invalid', async () => {
      const loadHistorySpy = jest.spyOn(provider as any, 'loadAndSendConversationHistory').mockResolvedValue(true);

      await messageHandler({
        command: 'loadAgentHistory',
        data: { agentId: null }
      });

      expect(loadHistorySpy).not.toHaveBeenCalled();
      loadHistorySpy.mockRestore();
    });
    it('should save conversation export when markdown is provided', async () => {
      const saveDialogMock = vscode.window.showSaveDialog as jest.Mock;
      const writeFileMock = vscode.workspace.fs.writeFile as jest.Mock;
      const targetUri = { fsPath: '/tmp/convo.md', path: '/tmp/convo.md' };
      saveDialogMock.mockResolvedValue(targetUri);
      writeFileMock.mockResolvedValue(undefined);
      (vscode.window.showInformationMessage as jest.Mock).mockClear();

      await messageHandler({
        command: 'conversationExportReady',
        data: { content: '# Test Conversation', fileName: 'agent-convo.md' }
      });

      expect(saveDialogMock).toHaveBeenCalled();
      expect(writeFileMock).toHaveBeenCalledWith(targetUri, expect.any(Uint8Array));
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('Conversation was saved to')
      );
    });

    it('should warn when export content is empty', async () => {
      await messageHandler({
        command: 'conversationExportReady',
        data: { content: '', fileName: 'agent' }
      });

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith("Conversation couldn't be exported.");
    });

    it('should do nothing when user cancels the save dialog', async () => {
      const saveDialogMock = vscode.window.showSaveDialog as jest.Mock;
      const writeFileMock = vscode.workspace.fs.writeFile as jest.Mock;
      saveDialogMock.mockResolvedValue(undefined);

      await messageHandler({
        command: 'conversationExportReady',
        data: { content: '# Test Conversation', fileName: 'agent-convo.md' }
      });

      expect(writeFileMock).not.toHaveBeenCalled();
    });

    it('should surface errors from failed export writes', async () => {
      const saveDialogMock = vscode.window.showSaveDialog as jest.Mock;
      const writeFileMock = vscode.workspace.fs.writeFile as jest.Mock;
      const targetUri = { fsPath: '/tmp/convo.md', path: '/tmp/convo.md' };
      saveDialogMock.mockResolvedValue(targetUri);
      writeFileMock.mockRejectedValue(new Error('disk full'));

      await messageHandler({
        command: 'conversationExportReady',
        data: { content: '# Test Conversation', fileName: 'agent-convo.md' }
      });

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to save conversation: disk full');
    });
  });

  describe('getTraceData Message Handler', () => {
    let messageHandler: (message: any) => Promise<void>;
    let mockWebviewView: any;

    beforeEach(() => {
      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      mockWebviewView = {
        webview: {
          options: {},
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          html: '',
          postMessage: jest.fn()
        }
      };

      provider.resolveWebviewView(mockWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();

      // Re-mock getConfiguration after clearAllMocks
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn(() => '')
      });
    });

    it('should return empty data when no agent preview or session', async () => {
      (provider as any).agentPreview = undefined;
      (provider as any).sessionId = undefined;

      await messageHandler({ command: 'getTraceData' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'traceData',
        data: { plan: [], planId: '', sessionId: '' }
      });
    });

    it('should return empty data when no sessionId', async () => {
      (provider as any).agentPreview = {};
      (provider as any).sessionId = undefined;

      await messageHandler({ command: 'getTraceData' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'traceData',
        data: { plan: [], planId: '', sessionId: '' }
      });
    });

    it('should restore stored trace data when no active session is available', async () => {
      (provider as any).currentAgentId = '0X123';
      (provider as any).currentAgentSource = AgentSource.PUBLISHED;
      (readTraceHistoryEntries as jest.Mock).mockResolvedValue([
        {
          storageKey: '0X123',
          agentId: '0X123',
          sessionId: 'old-session',
          planId: 'stored-plan',
          timestamp: '2024-01-01T00:00:00.000Z',
          trace: { plan: [{ type: 'UserInputStep' }], planId: 'stored-plan', sessionId: 'old-session' }
        }
      ]);

      await messageHandler({ command: 'getTraceData' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'traceData',
        data: { plan: [{ type: 'UserInputStep' }], planId: 'stored-plan', sessionId: 'old-session' }
      });
    });

    it('should call trace API for AgentSimulate with planId', async () => {
      const mockTraceData = {
        type: 'PlanSuccessResponse',
        planId: 'test-plan-id',
        sessionId: 'test-session',
        plan: [{ type: 'UserInputStep', message: 'Hello' }]
      };

      const mockAgentSimulate = {
        trace: jest.fn().mockResolvedValue(mockTraceData)
      };

      (provider as any).agentPreview = mockAgentSimulate;
      (provider as any).sessionId = 'test-session';
      (provider as any).currentPlanId = 'test-plan-id';
      (provider as any).currentAgentId = '0X123';
      (provider as any).currentAgentSource = AgentSource.PUBLISHED;
      Object.setPrototypeOf((provider as any).agentPreview, AgentSimulate.prototype);

      await messageHandler({ command: 'getTraceData' });

      expect(mockAgentSimulate.trace).toHaveBeenCalledWith('test-session', 'test-plan-id');
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'traceData',
        data: mockTraceData
      });
      expect(appendTraceHistoryEntry).toHaveBeenCalledWith(
        '0X123',
        expect.objectContaining({
          agentId: '0X123',
          planId: 'test-plan-id',
          trace: mockTraceData
        })
      );
    });

    it('should return empty data for AgentPreview (not AgentSimulate)', async () => {
      const mockAgentPreview = {};

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';
      Object.setPrototypeOf((provider as any).agentPreview, AgentPreview.prototype);

      await messageHandler({ command: 'getTraceData' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'traceData',
        data: { plan: [], planId: '', sessionId: '' }
      });
    });

    it('should return empty data when AgentSimulate but no planId', async () => {
      const mockAgentSimulate = {
        trace: jest.fn()
      };

      (provider as any).agentPreview = mockAgentSimulate;
      (provider as any).sessionId = 'test-session';
      (provider as any).currentPlanId = undefined;
      Object.setPrototypeOf((provider as any).agentPreview, AgentSimulate.prototype);

      await messageHandler({ command: 'getTraceData' });

      expect(mockAgentSimulate.trace).not.toHaveBeenCalled();
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'traceData',
        data: { plan: [], planId: '', sessionId: '' }
      });
    });

    it('should handle trace API errors', async () => {
      const mockAgentSimulate = {
        trace: jest.fn().mockRejectedValue(new Error('Trace API failed'))
      };

      (provider as any).agentPreview = mockAgentSimulate;
      (provider as any).sessionId = 'test-session';
      (provider as any).currentPlanId = 'test-plan-id';
      Object.setPrototypeOf((provider as any).agentPreview, AgentSimulate.prototype);

      await messageHandler({ command: 'getTraceData' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: { message: 'Trace API failed' }
      });
    });

    it('should handle non-Error exceptions from trace API', async () => {
      const mockAgentSimulate = {
        trace: jest.fn().mockRejectedValue('string error')
      };

      (provider as any).agentPreview = mockAgentSimulate;
      (provider as any).sessionId = 'test-session';
      (provider as any).currentPlanId = 'test-plan-id';
      Object.setPrototypeOf((provider as any).agentPreview, AgentSimulate.prototype);

      await messageHandler({ command: 'getTraceData' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: { message: 'string error' }
      });
    });

    it('should load mock trace payload from configuration when setting is provided', async () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn(() => '/tmp/mock-trace.json')
      });
      const mockPayload = { plan: [{ step: 'test' }] };
      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(JSON.stringify(mockPayload)));

      await messageHandler({ command: 'getTraceData' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'traceData',
        data: mockPayload
      });
    });

    it('should surface error when mock trace payload cannot be read', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn(() => '/tmp/mock-trace.json')
      });
      (vscode.workspace.fs.readFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));
      const executeCommandMock = vscode.commands.executeCommand as jest.Mock;
      executeCommandMock.mockClear();

      await messageHandler({ command: 'getTraceData' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: { message: expect.stringContaining('ENOENT') }
      });
      expect(executeCommandMock).toHaveBeenCalledWith('setContext', 'agentforceDX:canResetAgentView', true);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Error Message Formatting', () => {
    let messageHandler: (message: any) => Promise<void>;
    let mockWebviewView: any;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      mockWebviewView = {
        webview: {
          options: {},
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          html: '',
          postMessage: jest.fn()
        }
      };

      provider.resolveWebviewView(mockWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should format agent deactivation error message', async () => {
      const mockAgentPreview = {
        send: jest.fn().mockRejectedValue(new Error('404 NOT_FOUND No valid version available'))
      };

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Test' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: {
          message:
            'This agent is currently deactivated, so you can\'t converse with it. Activate the agent using either the "AFDX: Activate Agent" VS Code command or your org\'s Agentforce UI.'
        }
      });
    });

    it('should format agent not found error message', async () => {
      const mockAgentPreview = {
        send: jest.fn().mockRejectedValue(new Error('404 NOT_FOUND Agent does not exist'))
      };

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Test' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: {
          message: "The selected agent couldn't be found. Either it's been deleted or you don't have access to it."
        }
      });
    });

    it('should format permission error message (403)', async () => {
      const mockAgentPreview = {
        send: jest.fn().mockRejectedValue(new Error('403 Access denied'))
      };

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Test' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: {
          message: "You don't have permission to use this agent. Consult your Salesforce administrator."
        }
      });
    });

    it('should format permission error message (FORBIDDEN)', async () => {
      const mockAgentPreview = {
        send: jest.fn().mockRejectedValue(new Error('FORBIDDEN: Insufficient privileges'))
      };

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Test' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: {
          message: "You don't have permission to use this agent. Consult your Salesforce administrator."
        }
      });
    });

    it('should handle non-Error exceptions in main message handler', async () => {
      const mockAgentPreview = {
        send: jest.fn().mockImplementation(() => {
          throw 'string error';
        })
      };

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Test' }
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('AgentCombinedViewProvider Error:', 'string error');
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: { message: 'Unknown error occurred' }
      });
    });
  });

  describe('executeCommand and setSelectedAgentId Handlers', () => {
    let messageHandler: (message: any) => Promise<void>;
    let mockWebviewView: any;

    beforeEach(() => {
      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      mockWebviewView = {
        webview: {
          options: {},
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          html: '',
          postMessage: jest.fn()
        }
      };

      provider.resolveWebviewView(mockWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();
    });

    it('should execute VSCode command when valid commandId provided', async () => {
      await messageHandler({
        command: 'executeCommand',
        data: { commandId: 'workbench.action.files.save' }
      });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.files.save');
    });

    it('should not execute command when commandId is not a string', async () => {
      await messageHandler({
        command: 'executeCommand',
        data: { commandId: 123 }
      });

      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    it('should set current agent ID and mark agent as selected', async () => {
      await messageHandler({
        command: 'setSelectedAgentId',
        data: { agentId: '0X1234567890123' }
      });

      expect((provider as any).currentAgentId).toBe('0X1234567890123');
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:agentSelected', true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:hasConversationData',
        false
      );
    });

    it('should clear current agent ID when agentId is empty string', async () => {
      // First set an agent ID
      (provider as any).currentAgentId = '0X1234567890123';

      await messageHandler({
        command: 'setSelectedAgentId',
        data: { agentId: '' }
      });

      expect((provider as any).currentAgentId).toBeUndefined();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:agentSelected', false);
    });

    it('should clear current agent ID when agentId is null', async () => {
      // First set an agent ID
      (provider as any).currentAgentId = '0X1234567890123';

      await messageHandler({
        command: 'setSelectedAgentId',
        data: { agentId: null }
      });

      expect((provider as any).currentAgentId).toBeUndefined();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:agentSelected', false);
    });
  });

  describe('getAvailableAgents Message Handler', () => {
    let messageHandler: (message: any) => Promise<void>;
    let mockWebviewView: any;
    let consoleErrorSpy: jest.SpyInstance;
    const { Agent } = require('@salesforce/agents');

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      mockWebviewView = {
        webview: {
          options: {},
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          html: '',
          postMessage: jest.fn()
        }
      };

      provider.resolveWebviewView(mockWebviewView, {} as any, {} as vscode.CancellationToken);

      // Reset selectedClientApp
      (provider as any).selectedClientApp = undefined;

      jest.clearAllMocks();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should use existing selectedClientApp when already set', async () => {
      (provider as any).selectedClientApp = 'ExistingApp';

      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });
      Agent.listRemote = jest.fn().mockResolvedValue([
        {
          Id: '0X1234567890123',
          MasterLabel: 'Test Agent',
          BotVersions: { records: [{ Status: 'Active' }] }
        }
      ]);

      await messageHandler({ command: 'getAvailableAgents' });

      expect(createConnectionWithClientApp).toHaveBeenCalledWith('ExistingApp');
      expect(getAvailableClientApps).not.toHaveBeenCalled();
    });

    it('should handle no client app available case', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([{ fsPath: '/workspace/local.agent' }]);
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({} as any);

      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'none',
        username: 'test@example.com',
        error: 'No client app found'
      });

      await messageHandler({ command: 'getAvailableAgents' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'availableAgents',
        data: {
          agents: expect.arrayContaining([expect.objectContaining({ name: 'local', type: 'script' })]),
          selectedAgentId: undefined
        }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'clientAppRequired',
        data: {
          message: expect.stringContaining('Preview an Agent'),
          username: 'test@example.com',
          error: 'No client app found'
        }
      });
    });

    it('should clear currentAgentId when no client app available', async () => {
      (provider as any).currentAgentId = '0X1234567890123';

      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'none',
        username: 'test@example.com',
        error: 'No client app'
      });

      await messageHandler({ command: 'getAvailableAgents' });

      expect((provider as any).currentAgentId).toBeUndefined();
    });

    it('should handle multiple client apps case', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'multiple',
        username: 'test@example.com',
        clientApps: [
          { name: 'App1', consumerKey: 'key1' },
          { name: 'App2', consumerKey: 'key2' }
        ]
      });

      await messageHandler({ command: 'getAvailableAgents' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'availableAgents',
        data: {
          agents: [],
          selectedAgentId: undefined
        }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'selectClientApp',
        data: {
          clientApps: expect.arrayContaining([
            expect.objectContaining({ name: 'App1' }),
            expect.objectContaining({ name: 'App2' })
          ]),
          username: 'test@example.com'
        }
      });
    });

    it('should clear currentAgentId when multiple client apps', async () => {
      (provider as any).currentAgentId = '0X1234567890123';

      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'multiple',
        username: 'test@example.com',
        clientApps: [{ name: 'App1' }]
      });

      await messageHandler({ command: 'getAvailableAgents' });

      expect((provider as any).currentAgentId).toBeUndefined();
    });

    it('should handle single client app case and set selectedClientApp', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'single',
        clientApps: [{ name: 'SingleApp', consumerKey: 'key1' }]
      });
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });
      Agent.listRemote = jest.fn().mockResolvedValue([]);

      await messageHandler({ command: 'getAvailableAgents' });

      expect((provider as any).selectedClientApp).toBe('SingleApp');
      expect(createConnectionWithClientApp).toHaveBeenCalledWith('SingleApp');
    });

    it('should filter agents with active BotVersions', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'single',
        clientApps: [{ name: 'TestApp' }]
      });
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      Agent.listRemote = jest.fn().mockResolvedValue([
        {
          Id: '0X1111111111111',
          MasterLabel: 'Active Agent',
          BotVersions: { records: [{ Status: 'Active' }] }
        },
        {
          Id: '0X2222222222222',
          MasterLabel: 'Inactive Agent',
          BotVersions: { records: [{ Status: 'Inactive' }] }
        },
        {
          Id: '0X3333333333333',
          MasterLabel: 'Mixed Agent',
          BotVersions: { records: [{ Status: 'Inactive' }, { Status: 'Active' }] }
        }
      ]);

      await messageHandler({ command: 'getAvailableAgents' });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      expect(availableAgentsCall[0].data.agents).toHaveLength(2);
      expect(availableAgentsCall[0].data.agents[0].name).toBe('Active Agent');
      expect(availableAgentsCall[0].data.agents[1].name).toBe('Mixed Agent');
    });

    it('should sort remote agents alphabetically', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'single',
        clientApps: [{ name: 'TestApp' }]
      });
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      Agent.listRemote = jest.fn().mockResolvedValue([
        {
          Id: '0X1111111111111',
          MasterLabel: 'Zebra Agent',
          BotVersions: { records: [{ Status: 'Active' }] }
        },
        {
          Id: '0X2222222222222',
          MasterLabel: 'Alpha Agent',
          BotVersions: { records: [{ Status: 'Active' }] }
        }
      ]);

      await messageHandler({ command: 'getAvailableAgents' });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      expect(availableAgentsCall[0].data.agents[0].name).toBe('Alpha Agent');
      expect(availableAgentsCall[0].data.agents[1].name).toBe('Zebra Agent');
    });

    it('should use DeveloperName when MasterLabel is missing', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'single',
        clientApps: [{ name: 'TestApp' }]
      });
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      Agent.listRemote = jest.fn().mockResolvedValue([
        {
          Id: '0X1111111111111',
          DeveloperName: 'Dev_Agent',
          BotVersions: { records: [{ Status: 'Active' }] }
        }
      ]);

      await messageHandler({ command: 'getAvailableAgents' });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      expect(availableAgentsCall[0].data.agents[0].name).toBe('Dev_Agent');
    });

    it('should combine local and remote agents', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([{ fsPath: '/workspace/local.agent' }]);
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({} as any);
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'single',
        clientApps: [{ name: 'TestApp' }]
      });
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      Agent.listRemote = jest.fn().mockResolvedValue([
        {
          Id: '0X1111111111111',
          MasterLabel: 'Remote Agent',
          BotVersions: { records: [{ Status: 'Active' }] }
        }
      ]);

      await messageHandler({ command: 'getAvailableAgents' });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      expect(availableAgentsCall[0].data.agents).toHaveLength(2);
      expect(availableAgentsCall[0].data.agents[0].type).toBe('script');
      expect(availableAgentsCall[0].data.agents[1].type).toBe('published');
    });

    it('should send currentAgentId and then clear it', async () => {
      (provider as any).currentAgentId = '0X1234567890123';

      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'single',
        clientApps: [{ name: 'TestApp' }]
      });
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });
      Agent.listRemote = jest.fn().mockResolvedValue([]);

      await messageHandler({ command: 'getAvailableAgents' });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      expect(availableAgentsCall[0].data.selectedAgentId).toBe('0X1234567890123');
      expect((provider as any).currentAgentId).toBeUndefined();
    });

    it('should handle error and return empty list', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (getAvailableClientApps as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      await messageHandler({ command: 'getAvailableAgents' });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting available agents from org:', expect.any(Error));
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'availableAgents',
        data: []
      });
    });

    it('should use default connection when clientAppResult has unexpected type', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);

      // Return an unexpected type (not 'none', 'single', or 'multiple')
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'unknown' as any,
        clientApps: []
      });

      const mockConn = {
        instanceUrl: 'https://test.salesforce.com'
      };
      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue(mockConn);
      Agent.listRemote = jest.fn().mockResolvedValue([]);

      await messageHandler({ command: 'getAvailableAgents' });

      // Should fall back to default connection
      expect(CoreExtensionService.getDefaultConnection).toHaveBeenCalled();
      expect(Agent.listRemote).toHaveBeenCalledWith(mockConn);
    });

    it('should use "Unknown Agent" when neither MasterLabel nor DeveloperName is available', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'single',
        clientApps: [{ name: 'TestApp' }]
      });
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      Agent.listRemote = jest.fn().mockResolvedValue([
        {
          Id: '0X1111111111111',
          BotVersions: { records: [{ Status: 'Active' }] }
        }
      ]);

      await messageHandler({ command: 'getAvailableAgents' });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      expect(availableAgentsCall[0].data.agents[0].name).toBe('Unknown Agent');
    });

    it('should filter out agents with no BotVersions', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'single',
        clientApps: [{ name: 'TestApp' }]
      });
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      Agent.listRemote = jest.fn().mockResolvedValue([
        {
          Id: '0X1111111111111',
          MasterLabel: 'Agent With Versions',
          BotVersions: { records: [{ Status: 'Active' }] }
        },
        {
          Id: '0X2222222222222',
          MasterLabel: 'Agent Without Versions'
          // No BotVersions property
        }
      ]);

      await messageHandler({ command: 'getAvailableAgents' });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      expect(availableAgentsCall[0].data.agents).toHaveLength(1);
      expect(availableAgentsCall[0].data.agents[0].name).toBe('Agent With Versions');
    });

    it('should filter out agents with empty BotVersions records', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'single',
        clientApps: [{ name: 'TestApp' }]
      });
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      Agent.listRemote = jest.fn().mockResolvedValue([
        {
          Id: '0X1111111111111',
          MasterLabel: 'Agent With Active Version',
          BotVersions: { records: [{ Status: 'Active' }] }
        },
        {
          Id: '0X2222222222222',
          MasterLabel: 'Agent With Empty Records',
          BotVersions: { records: [] }
        }
      ]);

      await messageHandler({ command: 'getAvailableAgents' });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      expect(availableAgentsCall[0].data.agents).toHaveLength(1);
      expect(availableAgentsCall[0].data.agents[0].name).toBe('Agent With Active Version');
    });

    it('should handle remoteAgents being null', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([{ fsPath: '/workspace/local.agent' }]);
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({} as any);
      (getAvailableClientApps as jest.Mock).mockResolvedValue({
        type: 'single',
        clientApps: [{ name: 'TestApp' }]
      });
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      Agent.listRemote = jest.fn().mockResolvedValue(null);

      await messageHandler({ command: 'getAvailableAgents' });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      // Should only have local agents
      expect(availableAgentsCall[0].data.agents).toHaveLength(1);
      expect(availableAgentsCall[0].data.agents[0].type).toBe('script');
    });
  });

  describe('clientAppSelected Message Handler', () => {
    let messageHandler: (message: any) => Promise<void>;
    let mockWebviewView: any;
    let consoleErrorSpy: jest.SpyInstance;
    const { Agent } = require('@salesforce/agents');

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      mockWebviewView = {
        webview: {
          options: {},
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          html: '',
          postMessage: jest.fn()
        }
      };

      provider.resolveWebviewView(mockWebviewView, {} as any, {} as vscode.CancellationToken);

      // Reset selectedClientApp
      (provider as any).selectedClientApp = undefined;

      jest.clearAllMocks();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should set selectedClientApp and load agents', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([{ fsPath: '/workspace/local.agent' }]);
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({} as any);
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });
      Agent.listRemote = jest.fn().mockResolvedValue([
        {
          Id: '0X1111111111111',
          MasterLabel: 'Remote Agent',
          BotVersions: { records: [{ Status: 'Active' }] }
        }
      ]);

      await messageHandler({
        command: 'clientAppSelected',
        data: { clientAppName: 'SelectedApp' }
      });

      expect((provider as any).selectedClientApp).toBe('SelectedApp');
      expect(createConnectionWithClientApp).toHaveBeenCalledWith('SelectedApp');
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'clientAppReady'
      });
    });

    it('should combine local and remote agents', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([{ fsPath: '/workspace/local.agent' }]);
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({} as any);
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });
      Agent.listRemote = jest.fn().mockResolvedValue([
        {
          Id: '0X1111111111111',
          MasterLabel: 'Remote Agent',
          BotVersions: { records: [{ Status: 'Active' }] }
        }
      ]);

      await messageHandler({
        command: 'clientAppSelected',
        data: { clientAppName: 'TestApp' }
      });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      expect(availableAgentsCall[0].data.agents).toHaveLength(2);
      expect(availableAgentsCall[0].data.agents[0].type).toBe('script');
      expect(availableAgentsCall[0].data.agents[1].type).toBe('published');
    });

    it('should filter and sort remote agents', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });
      Agent.listRemote = jest.fn().mockResolvedValue([
        {
          Id: '0X1111111111111',
          MasterLabel: 'Zebra Agent',
          BotVersions: { records: [{ Status: 'Active' }] }
        },
        {
          Id: '0X2222222222222',
          MasterLabel: 'Alpha Agent',
          BotVersions: { records: [{ Status: 'Active' }] }
        },
        {
          Id: '0X3333333333333',
          MasterLabel: 'Inactive Agent',
          BotVersions: { records: [{ Status: 'Inactive' }] }
        }
      ]);

      await messageHandler({
        command: 'clientAppSelected',
        data: { clientAppName: 'TestApp' }
      });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      // Should only have 2 active agents, sorted alphabetically
      expect(availableAgentsCall[0].data.agents).toHaveLength(2);
      expect(availableAgentsCall[0].data.agents[0].name).toBe('Alpha Agent');
      expect(availableAgentsCall[0].data.agents[1].name).toBe('Zebra Agent');
    });

    it('should send preselectedAgentId and then clear it', async () => {
      provider.setAgentId('0X1234567890123');

      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });
      Agent.listRemote = jest.fn().mockResolvedValue([]);

      await messageHandler({
        command: 'clientAppSelected',
        data: { clientAppName: 'TestApp' }
      });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      expect(availableAgentsCall[0].data.selectedAgentId).toBe('0X1234567890123');
      expect((provider as any).preselectedAgentId).toBeUndefined();
    });

    it('should handle error when no clientAppName provided', async () => {
      await messageHandler({
        command: 'clientAppSelected',
        data: {}
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error selecting client app:', expect.any(Error));
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: { message: 'Error selecting client app: No client app name provided' }
      });
    });

    it('should handle error during agent loading', async () => {
      (createConnectionWithClientApp as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      await messageHandler({
        command: 'clientAppSelected',
        data: { clientAppName: 'TestApp' }
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error selecting client app:', expect.any(Error));
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: { message: 'Error selecting client app: Connection failed' }
      });
    });

    it('should handle edge case where selectedClientApp becomes falsy after assignment', async () => {
      // This tests the redundant check on line 678
      // Create a spy that will set selectedClientApp to undefined after it's set
      const originalDescriptor = Object.getOwnPropertyDescriptor(provider, 'selectedClientApp');

      let backingValue: string | undefined;
      Object.defineProperty(provider, 'selectedClientApp', {
        get() {
          return backingValue;
        },
        set(value) {
          // Simulate a weird edge case where setting the value fails
          if (value === 'FailApp') {
            backingValue = undefined; // Force it to be falsy
          } else {
            backingValue = value;
          }
        },
        configurable: true
      });

      await messageHandler({
        command: 'clientAppSelected',
        data: { clientAppName: 'FailApp' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: { message: 'Error selecting client app: Client app not set' }
      });

      // Restore original property descriptor
      if (originalDescriptor) {
        Object.defineProperty(provider, 'selectedClientApp', originalDescriptor);
      }
    });

    it('should use DeveloperName when MasterLabel is missing', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });
      Agent.listRemote = jest.fn().mockResolvedValue([
        {
          Id: '0X1111111111111',
          DeveloperName: 'Dev_Agent',
          BotVersions: { records: [{ Status: 'Active' }] }
        }
      ]);

      await messageHandler({
        command: 'clientAppSelected',
        data: { clientAppName: 'TestApp' }
      });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      expect(availableAgentsCall[0].data.agents[0].name).toBe('Dev_Agent');
    });

    it('should use "Unknown Agent" when neither MasterLabel nor DeveloperName is available', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });
      Agent.listRemote = jest.fn().mockResolvedValue([
        {
          Id: '0X1111111111111',
          BotVersions: { records: [{ Status: 'Active' }] }
        }
      ]);

      await messageHandler({
        command: 'clientAppSelected',
        data: { clientAppName: 'TestApp' }
      });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      expect(availableAgentsCall[0].data.agents[0].name).toBe('Unknown Agent');
    });

    it('should filter out agents with no BotVersions', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });
      Agent.listRemote = jest.fn().mockResolvedValue([
        {
          Id: '0X1111111111111',
          MasterLabel: 'Agent With Versions',
          BotVersions: { records: [{ Status: 'Active' }] }
        },
        {
          Id: '0X2222222222222',
          MasterLabel: 'Agent Without Versions'
        }
      ]);

      await messageHandler({
        command: 'clientAppSelected',
        data: { clientAppName: 'TestApp' }
      });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      expect(availableAgentsCall[0].data.agents).toHaveLength(1);
      expect(availableAgentsCall[0].data.agents[0].name).toBe('Agent With Versions');
    });

    it('should handle remoteAgents being null', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([{ fsPath: '/workspace/local.agent' }]);
      (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({} as any);
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });
      Agent.listRemote = jest.fn().mockResolvedValue(null);

      await messageHandler({
        command: 'clientAppSelected',
        data: { clientAppName: 'TestApp' }
      });

      const availableAgentsCall = mockWebviewView.webview.postMessage.mock.calls.find(
        (call: any) => call[0].command === 'availableAgents'
      );

      expect(availableAgentsCall[0].data.agents).toHaveLength(1);
      expect(availableAgentsCall[0].data.agents[0].type).toBe('script');
    });

    it('should handle non-Error exceptions', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      (createConnectionWithClientApp as jest.Mock).mockRejectedValue('string error');

      await messageHandler({
        command: 'clientAppSelected',
        data: { clientAppName: 'TestApp' }
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error selecting client app:', 'string error');
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: { message: 'Error selecting client app: Unknown error' }
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    let messageHandler: (message: any) => Promise<void>;
    let mockWebviewView: any;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      mockWebviewView = {
        webview: {
          options: {},
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          html: '',
          postMessage: jest.fn()
        }
      };

      provider.resolveWebviewView(mockWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should handle script agent with no file path', async () => {
      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com'
      });

      // Mock getLocalAgentFilePath to return empty string
      jest.spyOn(provider as any, 'getLocalAgentFilePath').mockReturnValue('');

      await messageHandler({
        command: 'startSession',
        data: { agentId: 'local:' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'error',
          data: expect.objectContaining({
            message: expect.stringContaining('No file path found for local agent')
          })
        })
      );
    });

    it('should handle setApexDebugging with active agent preview', async () => {
      const mockAgentPreview = {
        setApexDebugMode: jest.fn()
      };

      (provider as any).agentPreview = mockAgentPreview;

      await messageHandler({
        command: 'setApexDebugging',
        data: true
      });

      expect(mockAgentPreview.setApexDebugMode).toHaveBeenCalledWith(true);
    });

    it('should handle getConfiguration with valid section', async () => {
      const mockConfig = {
        get: jest.fn().mockReturnValue('test-value')
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      await messageHandler({
        command: 'getConfiguration',
        data: { section: 'test.section' }
      });

      expect(mockConfig.get).toHaveBeenCalledWith('test.section');
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'configuration',
        data: { section: 'test.section', value: 'test-value' }
      });
    });
  });

  describe('getHtmlForWebview', () => {
    const fs = require('fs');

    it('should read HTML file and inject vscode API script', () => {
      const mockHtml = '<html><head></head><body>Test</body></html>';
      (fs.readFileSync as jest.Mock).mockReturnValue(mockHtml);

      const result = (provider as any).getHtmlForWebview();

      const expectedPath = path.join('/extension/path', 'webview', 'dist', 'index.html');
      expect(fs.readFileSync).toHaveBeenCalledWith(expectedPath, 'utf8');

      expect(result).toContain('const vscode = acquireVsCodeApi()');
      expect(result).toContain('window.vscode = vscode');
      expect(result).toContain('<script>');
    });

    it('should inject script before closing head tag', () => {
      const mockHtml = '<html><head><title>Test</title></head><body>Content</body></html>';
      (fs.readFileSync as jest.Mock).mockReturnValue(mockHtml);

      const result = (provider as any).getHtmlForWebview();

      // Script should be before </head>
      const headCloseIndex = result.indexOf('</head>');
      const scriptIndex = result.indexOf('const vscode = acquireVsCodeApi()');

      expect(scriptIndex).toBeLessThan(headCloseIndex);
    });
  });

  describe('saveApexDebugLog', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should save apex debug log with selectedClientApp', async () => {
      (provider as any).selectedClientApp = 'TestApp';

      const mockConn = {
        tooling: {
          _baseUrl: () => 'https://test.salesforce.com/services/data/v56.0',
          request: jest.fn().mockResolvedValue('log content here')
        }
      };

      (createConnectionWithClientApp as jest.Mock).mockResolvedValue(mockConn);
      (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (vscode.workspace.fs.createDirectory as jest.Mock).mockResolvedValue(undefined);

      const mockApexLog = { Id: 'log123', LogLength: 1000 };
      const result = await (provider as any).saveApexDebugLog(mockApexLog);

      expect(createConnectionWithClientApp).toHaveBeenCalledWith('TestApp');
      expect(mockConn.tooling.request).toHaveBeenCalledWith(
        'https://test.salesforce.com/services/data/v56.0/sobjects/ApexLog/log123/Body'
      );

      // Verify the log was saved
      expect(vscode.workspace.fs.createDirectory).toHaveBeenCalled();
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();

      // Result should be a path containing the log file
      if (result) {
        expect(result).toContain('log123.log');
      }
    });

    it('should use default connection when no selectedClientApp', async () => {
      (provider as any).selectedClientApp = undefined;

      const mockConn = {
        tooling: {
          _baseUrl: () => 'https://test.salesforce.com/services/data/v56.0',
          request: jest.fn().mockResolvedValue('log content')
        }
      };

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue(mockConn);
      (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (vscode.workspace.fs.createDirectory as jest.Mock).mockResolvedValue(undefined);

      const mockApexLog = { Id: 'log456' };
      await (provider as any).saveApexDebugLog(mockApexLog);

      expect(CoreExtensionService.getDefaultConnection).toHaveBeenCalled();
    });

    it('should return undefined when no workspace folder', async () => {
      const originalFolders = vscode.workspace.workspaceFolders;
      (vscode.workspace as any).workspaceFolders = undefined;

      const result = await (provider as any).saveApexDebugLog({ Id: 'log123' });

      expect(result).toBeUndefined();
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'No workspace directory found to save the Apex debug logs.'
      );

      (vscode.workspace as any).workspaceFolders = originalFolders;
    });

    it('should return undefined when no log ID', async () => {
      const result = await (provider as any).saveApexDebugLog({});

      expect(result).toBeUndefined();
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('No Apex debug log ID found.');
    });

    it('should handle non-string log content', async () => {
      (provider as any).selectedClientApp = 'TestApp';

      const mockConn = {
        tooling: {
          _baseUrl: () => 'https://test.salesforce.com/services/data/v56.0',
          request: jest.fn().mockResolvedValue({ data: 'object content' })
        }
      };

      (createConnectionWithClientApp as jest.Mock).mockResolvedValue(mockConn);
      (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (vscode.workspace.fs.createDirectory as jest.Mock).mockResolvedValue(undefined);

      const mockApexLog = { Id: 'log789' };
      await (provider as any).saveApexDebugLog(mockApexLog);

      // Verify writeFile was called
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();

      // Verify the buffer was created from the stringified object
      if ((vscode.workspace.fs.writeFile as jest.Mock).mock.calls.length > 0) {
        const callArgs = (vscode.workspace.fs.writeFile as jest.Mock).mock.calls[0];
        expect(callArgs[1]).toBeDefined();
        expect(Buffer.isBuffer(callArgs[1])).toBe(true);
      }
    });

    it('should handle error and show error message', async () => {
      (provider as any).selectedClientApp = 'TestApp';

      (createConnectionWithClientApp as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const result = await (provider as any).saveApexDebugLog({ Id: 'log123' });

      expect(result).toBeUndefined();
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Error saving Apex debug log: Connection failed');
    });

    it('should handle non-Error exceptions', async () => {
      (provider as any).selectedClientApp = 'TestApp';

      (createConnectionWithClientApp as jest.Mock).mockRejectedValue('string error');

      const result = await (provider as any).saveApexDebugLog({ Id: 'log123' });

      expect(result).toBeUndefined();
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Error saving Apex debug log: Unknown error');
    });
  });

  describe('setupAutoDebugListeners', () => {
    let consoleLogSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.clearAllMocks();
      jest.useFakeTimers();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      jest.useRealTimers();
    });

    it('should set up debug session listener and auto-continue on apex-replay session', async () => {
      let debugSessionHandler: any;
      const mockDisposable = { dispose: jest.fn() };

      (vscode.debug.onDidStartDebugSession as jest.Mock).mockImplementation(handler => {
        debugSessionHandler = handler;
        return mockDisposable;
      });

      (vscode.debug as any).activeDebugSession = { id: 'test-session' };

      (provider as any).setupAutoDebugListeners();

      // Trigger debug session start with apex-replay type
      const mockSession = {
        type: 'apex-replay',
        name: 'Apex Replay Debugger'
      };

      debugSessionHandler(mockSession);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Debug session started - Type: "apex-replay", Name: "Apex Replay Debugger"'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('Apex replay debugger session detected: Apex Replay Debugger');

      // Fast-forward the 1 second delay
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(consoleLogSpy).toHaveBeenCalledWith('Auto-continuing Apex replay debugger to reach breakpoints...');
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.debug.continue');
    });

    it('should detect apex session by type "apex"', async () => {
      let debugSessionHandler: any;
      (vscode.debug.onDidStartDebugSession as jest.Mock).mockImplementation(handler => {
        debugSessionHandler = handler;
        return { dispose: jest.fn() };
      });

      (vscode.debug as any).activeDebugSession = { id: 'test' };

      (provider as any).setupAutoDebugListeners();

      const mockSession = { type: 'apex', name: 'Apex Debug' };
      debugSessionHandler(mockSession);

      expect(consoleLogSpy).toHaveBeenCalledWith('Apex replay debugger session detected: Apex Debug');
    });

    it('should detect apex session by name containing "apex"', async () => {
      let debugSessionHandler: any;
      (vscode.debug.onDidStartDebugSession as jest.Mock).mockImplementation(handler => {
        debugSessionHandler = handler;
        return { dispose: jest.fn() };
      });

      (vscode.debug as any).activeDebugSession = { id: 'test' };

      (provider as any).setupAutoDebugListeners();

      const mockSession = { type: 'other', name: 'My Apex Session' };
      debugSessionHandler(mockSession);

      expect(consoleLogSpy).toHaveBeenCalledWith('Apex replay debugger session detected: My Apex Session');
    });

    it('should detect apex session by name containing "replay"', async () => {
      let debugSessionHandler: any;
      (vscode.debug.onDidStartDebugSession as jest.Mock).mockImplementation(handler => {
        debugSessionHandler = handler;
        return { dispose: jest.fn() };
      });

      (vscode.debug as any).activeDebugSession = { id: 'test' };

      (provider as any).setupAutoDebugListeners();

      const mockSession = { type: 'other', name: 'Replay Debug Session' };
      debugSessionHandler(mockSession);

      expect(consoleLogSpy).toHaveBeenCalledWith('Apex replay debugger session detected: Replay Debug Session');
    });

    it('should handle error when auto-continue fails', async () => {
      let debugSessionHandler: any;
      (vscode.debug.onDidStartDebugSession as jest.Mock).mockImplementation(handler => {
        debugSessionHandler = handler;
        return { dispose: jest.fn() };
      });

      (vscode.debug as any).activeDebugSession = { id: 'test' };
      (vscode.commands.executeCommand as jest.Mock).mockRejectedValue(new Error('Command failed'));

      (provider as any).setupAutoDebugListeners();

      const mockSession = { type: 'apex-replay', name: 'Test' };
      debugSessionHandler(mockSession);

      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      expect(consoleWarnSpy).toHaveBeenCalledWith('Could not auto-continue Apex replay debugger:', expect.any(Error));
    });

    it('should cleanup after 15 seconds if no apex debugger detected', () => {
      let debugSessionHandler: any;
      const mockDisposable = { dispose: jest.fn() };

      (vscode.debug.onDidStartDebugSession as jest.Mock).mockImplementation(handler => {
        debugSessionHandler = handler;
        return mockDisposable;
      });

      (provider as any).setupAutoDebugListeners();

      // Trigger non-apex session
      const mockSession = { type: 'node', name: 'Node Debug' };
      debugSessionHandler(mockSession);

      // Fast-forward 15 seconds
      jest.advanceTimersByTime(15000);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'No Apex debugger session detected within timeout, cleaning up auto-continue listeners'
      );
      expect(mockDisposable.dispose).toHaveBeenCalled();
    });

    it('should not log timeout message when apex debugger is detected', () => {
      let debugSessionHandler: any;
      const mockDisposable = { dispose: jest.fn() };

      (vscode.debug.onDidStartDebugSession as jest.Mock).mockImplementation(handler => {
        debugSessionHandler = handler;
        return mockDisposable;
      });

      (provider as any).setupAutoDebugListeners();

      // Trigger apex-replay session (debuggerLaunched becomes true)
      const mockApexSession = { type: 'apex-replay', name: 'Apex Replay Debug' };
      debugSessionHandler(mockApexSession);

      // Fast-forward 15 seconds
      jest.advanceTimersByTime(15000);

      // Should NOT log the "No Apex debugger" message since debuggerLaunched is true
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        'No Apex debugger session detected within timeout, cleaning up auto-continue listeners'
      );
      // But should still call cleanup
      expect(mockDisposable.dispose).toHaveBeenCalled();
    });

    it('should not auto-continue when no active debug session', async () => {
      let debugSessionHandler: any;
      (vscode.debug.onDidStartDebugSession as jest.Mock).mockImplementation(handler => {
        debugSessionHandler = handler;
        return { dispose: jest.fn() };
      });

      (vscode.debug as any).activeDebugSession = undefined;

      (provider as any).setupAutoDebugListeners();

      const mockSession = { type: 'apex-replay', name: 'Test' };
      debugSessionHandler(mockSession);

      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('workbench.action.debug.continue');
    });
  });

  describe('Live Mode Persistence', () => {
    it('should load saved live mode from globalState on initialization', () => {
      const mockContextWithLiveMode = {
        ...mockContext,
        globalState: {
          get: jest.fn().mockReturnValue(true),
          update: jest.fn().mockResolvedValue(undefined),
          keys: jest.fn().mockReturnValue([]),
          setKeysForSync: jest.fn()
        }
      } as any;

      // Ensure getChannelService is set up before creating provider
      (CoreExtensionService.getChannelService as jest.Mock).mockReturnValue(mockChannelServiceInstance);
      const newProvider = new AgentCombinedViewProvider(mockContextWithLiveMode);

      expect(mockContextWithLiveMode.globalState.get).toHaveBeenCalledWith('agentforceDX.lastLiveMode', false);
      expect((newProvider as any).isLiveMode).toBe(true);
    });

    it('should default to simulation mode when no saved preference exists', () => {
      expect((provider as any).isLiveMode).toBe(false);
    });

    it('should send live mode when webview requests initial state', async () => {
      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      let messageHandler: (message: any) => Promise<void>;
      const testWebviewView = {
        webview: {
          postMessage: jest.fn(),
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          options: {},
          html: ''
        },
        show: jest.fn()
      } as any;

      provider.resolveWebviewView(testWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();

      // Webview requests initial live mode
      await messageHandler!({ command: 'getInitialLiveMode' });

      expect(testWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'setLiveMode',
        data: { isLiveMode: false }
      });
    });

    it('should persist live mode when changed from webview', async () => {
      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      let messageHandler: (message: any) => Promise<void>;
      const testWebviewView = {
        webview: {
          postMessage: jest.fn(),
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          options: {},
          html: ''
        },
        show: jest.fn()
      } as any;

      provider.resolveWebviewView(testWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();

      // Send setLiveMode message from webview
      await messageHandler!({ command: 'setLiveMode', data: { isLiveMode: true } });

      // Should update globalState
      expect(mockContext.globalState.update).toHaveBeenCalledWith('agentforceDX.lastLiveMode', true);

      // Should update internal state
      expect((provider as any).isLiveMode).toBe(true);

      // Should update context
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:isLiveMode', true);
    });

    it('should handle switching from live mode to simulation mode', async () => {
      // Set initial state to live mode
      (provider as any).isLiveMode = true;

      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      let messageHandler: (message: any) => Promise<void>;
      const testWebviewView = {
        webview: {
          postMessage: jest.fn(),
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          options: {},
          html: ''
        },
        show: jest.fn()
      } as any;

      provider.resolveWebviewView(testWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();

      // Switch to simulation mode
      await messageHandler!({ command: 'setLiveMode', data: { isLiveMode: false } });

      expect(mockContext.globalState.update).toHaveBeenCalledWith('agentforceDX.lastLiveMode', false);
      expect((provider as any).isLiveMode).toBe(false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:isLiveMode', false);
    });

    it('should ignore invalid setLiveMode messages', async () => {
      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      let messageHandler: (message: any) => Promise<void>;
      const testWebviewView = {
        webview: {
          postMessage: jest.fn(),
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          options: {},
          html: ''
        },
        show: jest.fn()
      } as any;

      provider.resolveWebviewView(testWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();

      const initialMode = (provider as any).isLiveMode;

      // Send invalid message
      await messageHandler!({ command: 'setLiveMode', data: { isLiveMode: 'invalid' } });

      // Should not update
      expect(mockContext.globalState.update).not.toHaveBeenCalled();
      expect((provider as any).isLiveMode).toBe(initialMode);
    });

    it('should respond to getInitialLiveMode request', async () => {
      (provider as any).isLiveMode = true;

      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      let messageHandler: (message: any) => Promise<void>;
      const testWebviewView = {
        webview: {
          postMessage: jest.fn(),
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          options: {},
          html: ''
        },
        show: jest.fn()
      } as any;

      provider.resolveWebviewView(testWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();

      // Webview requests initial live mode
      await messageHandler!({ command: 'getInitialLiveMode' });

      // Should send current mode to webview
      expect(testWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'setLiveMode',
        data: { isLiveMode: true }
      });
    });

    it('should maintain global live mode across agent switches', async () => {
      // Set live mode to true
      (provider as any).isLiveMode = true;
      await mockContext.globalState.update('agentforceDX.lastLiveMode', true);

      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      let messageHandler: (message: any) => Promise<void>;
      const testWebviewView = {
        webview: {
          postMessage: jest.fn(),
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          options: {},
          html: ''
        },
        show: jest.fn()
      } as any;

      provider.resolveWebviewView(testWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();

      // Request initial mode
      await messageHandler!({ command: 'getInitialLiveMode' });

      // Should return true
      expect(testWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'setLiveMode',
        data: { isLiveMode: true }
      });

      // Mode should persist (not reset when switching agents)
      expect((provider as any).isLiveMode).toBe(true);
    });

    it('should keep the selected live mode after ending a session', async () => {
      // Simulate an active session that was started in live mode
      (provider as any).isLiveMode = true;
      (provider as any).agentPreview = { end: jest.fn() };

      await provider.endSession();

      expect((provider as any).isLiveMode).toBe(true);
      expect(mockContext.globalState.update).not.toHaveBeenCalledWith('agentforceDX.lastLiveMode', false);
    });
  });

  describe('Debug Mode Persistence', () => {
    it('should load debug mode from globalState on initialization', () => {
      const mockContextWithDebugMode = {
        subscriptions: [],
        extensionPath: '/test/path',
        globalState: {
          get: jest.fn((key: string, defaultValue?: any) => {
            if (key === 'agentforceDX.lastDebugMode') {
              return true;
            }
            return defaultValue ?? false;
          }),
          update: jest.fn().mockResolvedValue(undefined),
          keys: jest.fn().mockReturnValue([]),
          setKeysForSync: jest.fn()
        }
      } as any;

      // Ensure getChannelService is set up before creating provider
      (CoreExtensionService.getChannelService as jest.Mock).mockReturnValue(mockChannelServiceInstance);
      const newProvider = new AgentCombinedViewProvider(mockContextWithDebugMode);

      expect(mockContextWithDebugMode.globalState.get).toHaveBeenCalledWith('agentforceDX.lastDebugMode', false);
      expect((newProvider as any).isApexDebuggingEnabled).toBe(true);
    });

    it('should default to debug mode disabled when no saved preference exists', () => {
      expect((provider as any).isApexDebuggingEnabled).toBe(false);
    });

    it('should persist debug mode when changed via setApexDebugging', async () => {
      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      let messageHandler: (message: any) => Promise<void>;
      const testWebviewView = {
        webview: {
          postMessage: jest.fn(),
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          options: {},
          html: ''
        },
        show: jest.fn()
      } as any;

      provider.resolveWebviewView(testWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();

      // Send setApexDebugging message from webview
      await messageHandler!({ command: 'setApexDebugging', data: true });

      // Should update globalState
      expect(mockContext.globalState.update).toHaveBeenCalledWith('agentforceDX.lastDebugMode', true);

      // Should update internal state
      expect((provider as any).isApexDebuggingEnabled).toBe(true);

      // Should update context
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:debugMode', true);
    });

    it('should persist debug mode when toggled via toggleDebugMode', async () => {
      jest.clearAllMocks();

      // Toggle debug mode on
      await provider.toggleDebugMode();

      // Should update globalState
      expect(mockContext.globalState.update).toHaveBeenCalledWith('agentforceDX.lastDebugMode', true);

      // Should update internal state
      expect((provider as any).isApexDebuggingEnabled).toBe(true);

      // Should update context
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:debugMode', true);

      jest.clearAllMocks();

      // Toggle debug mode off
      await provider.toggleDebugMode();

      // Should update globalState
      expect(mockContext.globalState.update).toHaveBeenCalledWith('agentforceDX.lastDebugMode', false);

      // Should update internal state
      expect((provider as any).isApexDebuggingEnabled).toBe(false);

      // Should update context
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:debugMode', false);
    });

    it('should set debug mode context on initialization', () => {
      const mockContextForInit = {
        subscriptions: [],
        extensionPath: '/test/path',
        globalState: {
          get: jest.fn().mockReturnValue(false),
          update: jest.fn().mockResolvedValue(undefined),
          keys: jest.fn().mockReturnValue([]),
          setKeysForSync: jest.fn()
        }
      } as any;

      jest.clearAllMocks();
      (CoreExtensionService.getChannelService as jest.Mock).mockReturnValue(mockChannelServiceInstance);

      // Create a new provider instance
      const newProvider = new AgentCombinedViewProvider(mockContextForInit);

      // Check that executeCommand was called during construction to set initial context
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'agentforceDX:debugMode', false);
    });

    it('should maintain debug mode state when session ends', async () => {
      // Set debug mode to true
      (provider as any).isApexDebuggingEnabled = true;
      (provider as any).agentPreview = { end: jest.fn() };

      jest.clearAllMocks();

      await provider.endSession();

      // Debug mode should persist when session ends (like live mode)
      expect((provider as any).isApexDebuggingEnabled).toBe(true);
      // setContext should not be called to change debug mode during endSession
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('setContext', 'agentforceDX:debugMode', false);
    });
  });

  describe('openTraceJson command', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('writes the trace entry to disk and opens the document', async () => {
      const mockDocument = { uri: { fsPath: '/tmp/trace.json' } };
      (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><head></head><body>Test</body></html>');

      let messageHandler: ((message: any) => Promise<void>) | undefined;
      const testWebviewView = {
        webview: {
          postMessage: jest.fn(),
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          options: {},
          html: ''
        },
        show: jest.fn()
      } as any;

      provider.resolveWebviewView(testWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();

      const entry = {
        storageKey: 'agent-key',
        agentId: 'agent-id',
        planId: 'plan-1',
        sessionId: 'session-1',
        trace: { plan: [] },
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      await messageHandler!({ command: 'openTraceJson', data: { entry } });

      expect(writeTraceEntryToFile).toHaveBeenCalledWith(entry);
      expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(vscode.Uri.file('/tmp/trace.json'));
      expect(vscode.window.showTextDocument).toHaveBeenCalledWith(mockDocument, { preview: true });
    });

    it('shows an error when entry data is missing', async () => {
      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><head></head><body>Test</body></html>');
      let messageHandler: ((message: any) => Promise<void>) | undefined;
      const testWebviewView = {
        webview: {
          postMessage: jest.fn(),
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          options: {},
          html: ''
        },
        show: jest.fn()
      } as any;

      provider.resolveWebviewView(testWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();

      await messageHandler!({ command: 'openTraceJson', data: { entry: null } });

      expect(writeTraceEntryToFile).not.toHaveBeenCalled();
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Unable to open trace JSON: Missing trace details.');
    });

    it('shows an error when writing the file fails', async () => {
      (writeTraceEntryToFile as jest.Mock).mockRejectedValueOnce(new Error('boom'));
      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><head></head><body>Test</body></html>');

      let messageHandler: ((message: any) => Promise<void>) | undefined;
      const testWebviewView = {
        webview: {
          postMessage: jest.fn(),
          onDidReceiveMessage: jest.fn(handler => {
            messageHandler = handler;
            return { dispose: jest.fn() };
          }),
          options: {},
          html: ''
        },
        show: jest.fn()
      } as any;

      provider.resolveWebviewView(testWebviewView, {} as any, {} as vscode.CancellationToken);
      jest.clearAllMocks();

      const entry = {
        storageKey: 'agent-key',
        agentId: 'agent-id',
        planId: 'plan-err',
        sessionId: 'session-err',
        trace: {},
        timestamp: '2024-01-01T00:00:00.000Z'
      };

      await messageHandler!({ command: 'openTraceJson', data: { entry } });

      expect(writeTraceEntryToFile).toHaveBeenCalledWith(entry);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Unable to open trace JSON: boom');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Unable to open trace JSON file:', expect.any(Error));
    });
  });
});
