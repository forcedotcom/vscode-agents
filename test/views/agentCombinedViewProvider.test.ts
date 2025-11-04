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
        data: { agentId }
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
      (provider as any).apexDebugging = false;

      await provider.toggleDebugMode();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:debugMode',
        true
      );
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'setDebugMode',
        data: true
      });
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Agentforce DX: Debug mode activated'
      );
    });

    it('should toggle debug mode from true to false', async () => {
      (provider as any).apexDebugging = true;

      await provider.toggleDebugMode();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:debugMode',
        false
      );
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'setDebugMode',
        data: false
      });
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Agentforce DX: Debug mode deactivated'
      );
    });

    it('should update agent preview debug mode when agent preview exists', async () => {
      const mockAgentPreview = {
        setApexDebugMode: jest.fn()
      };
      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).apexDebugging = false;

      await provider.toggleDebugMode();

      expect(mockAgentPreview.setApexDebugMode).toHaveBeenCalledWith(true);
    });

    it('should work when webview does not exist', async () => {
      provider.webviewView = undefined;
      (provider as any).apexDebugging = false;

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
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Agentforce DX: Session ended with TestAgent'
      );
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'sessionEnded',
        data: {}
      });
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

      await provider.endSession();

      expect(mockAgentPreview.end).toHaveBeenCalledWith('test-session', 'UserRequest');
      expect((provider as any).agentPreview).toBeUndefined();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Agentforce DX: Session ended with TestAgent'
      );
    });

    it('should not throw when no active session', async () => {
      (provider as any).agentPreview = undefined;
      await expect(provider.endSession()).resolves.not.toThrow();
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
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
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:sessionActive',
        false
      );
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'agentforceDX:debugMode',
        false
      );
    });
  });

  describe('notifyConfigurationChange', () => {
    it('should post message to webview when configuration changes', () => {
      const getConfigMock = jest.fn().mockReturnValue(true);
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: getConfigMock
      });

      (provider as any).notifyConfigurationChange();

      expect(getConfigMock).toHaveBeenCalledWith('salesforce.agentforceDX.showAgentTracer');
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'configuration',
        data: { section: 'salesforce.agentforceDX.showAgentTracer', value: true }
      });
    });

    it('should not throw when webview does not exist', () => {
      provider.webviewView = undefined;
      expect(() => {
        (provider as any).notifyConfigurationChange();
      }).not.toThrow();
    });
  });

  describe('setPreselectedAgentId', () => {
    it('should set preselected agent ID', () => {
      provider.setPreselectedAgentId('0X123456789012345');
      expect((provider as any).preselectedAgentId).toBe('0X123456789012345');
    });

    it('should update preselected agent ID when called multiple times', () => {
      provider.setPreselectedAgentId('0X111111111111111');
      expect((provider as any).preselectedAgentId).toBe('0X111111111111111');

      provider.setPreselectedAgentId('0X222222222222222');
      expect((provider as any).preselectedAgentId).toBe('0X222222222222222');
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
          onDidReceiveMessage: jest.fn((handler) => {
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

    it('should handle configuration change event when webview exists', () => {
      // Configuration handler is set up in constructor, find it
      const configHandlerCalls = (vscode.workspace.onDidChangeConfiguration as jest.Mock).mock.calls;

      if (configHandlerCalls.length > 0) {
        const configHandler = configHandlerCalls[configHandlerCalls.length - 1][0];

        configHandler({ affectsConfiguration: (section: string) => section === 'salesforce.agentforceDX.showAgentTracer' });

        expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
          command: 'configuration',
          data: { section: 'salesforce.agentforceDX.showAgentTracer', value: true }
        });
      }
    });

    it('should handle getConfiguration command', async () => {
      await expect(messageHandler({ command: 'getConfiguration' })).resolves.not.toThrow();
    });

    it('should handle clearChat command', async () => {
      await expect(messageHandler({ command: 'clearChat' })).resolves.not.toThrow();
    });

    it('should handle setSelectedAgentId command', async () => {
      await expect(messageHandler({ command: 'setSelectedAgentId', data: { agentId: '0X123' } })).resolves.not.toThrow();
    });

    it('should handle executeCommand', async () => {
      await expect(messageHandler({ command: 'executeCommand', data: { command: 'test.command' } })).resolves.not.toThrow();
    });

    it('should handle sendChatMessage without active session', async () => {
      await expect(messageHandler({ command: 'sendChatMessage', data: { message: 'Hello' } })).resolves.not.toThrow();
    });

    it('should handle endSession when no session active', async () => {
      await expect(messageHandler({ command: 'endSession' })).resolves.not.toThrow();
    });

    it('should handle getAvailableAgents command', async () => {
      (getAvailableClientApps as jest.Mock).mockResolvedValue({ type: 'none', username: 'test@example.com', error: 'No apps' });
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);

      await expect(messageHandler({ command: 'getAvailableAgents' })).resolves.not.toThrow();
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalled();
    });

    it('should handle getTraceData command', async () => {
      await expect(messageHandler({ command: 'getTraceData' })).resolves.not.toThrow();
    });

    it('should handle clientAppSelected command', async () => {
      (getAvailableClientApps as jest.Mock).mockResolvedValue({ type: 'single', clientApp: 'TestApp' });
      (createConnectionWithClientApp as jest.Mock).mockResolvedValue({ instanceUrl: 'https://test.salesforce.com' });
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);

      await expect(messageHandler({ command: 'clientAppSelected', data: { clientAppId: 'TestApp' } })).resolves.not.toThrow();
    });

    it('should handle setApexDebugging command', async () => {
      await expect(messageHandler({ command: 'setApexDebugging', data: true })).resolves.not.toThrow();
    });

    it('should handle loadAgentHistory command', async () => {
      (readTranscriptEntries as jest.Mock).mockResolvedValue([]);

      await expect(messageHandler({ command: 'loadAgentHistory', data: { agentId: '0X123' } })).resolves.not.toThrow();
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
          onDidReceiveMessage: jest.fn((handler) => {
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

    it('should start session with script agent and set up lifecycle listeners', async () => {
      const mockLifecycle = {
        on: jest.fn().mockReturnValue({ dispose: jest.fn() })
      };
      (Lifecycle.getInstance as jest.Mock).mockResolvedValue(mockLifecycle);

      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: [{ type: 'Inform', message: 'Hello from script' }]
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({ instanceUrl: 'https://test.salesforce.com' });

      await messageHandler({
        command: 'startSession',
        data: { agentId: 'local:/workspace/testAgent.agent' }
      });

      // Verify lifecycle listeners were set up
      expect(Lifecycle.getInstance).toHaveBeenCalled();
      expect(mockLifecycle.on).toHaveBeenCalledWith('agents:compiling', expect.any(Function));
      expect(mockLifecycle.on).toHaveBeenCalledWith('agents:simulation-starting', expect.any(Function));

      // Verify AgentSimulate was created with correct params
      expect(AgentSimulate).toHaveBeenCalledWith(
        expect.any(Object),
        '/workspace/testAgent.agent',
        true
      );

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
        })
      };
      (Lifecycle.getInstance as jest.Mock).mockResolvedValue(mockLifecycle);

      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({ instanceUrl: 'https://test.salesforce.com' });

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
    });

    it('should handle compilation starting event from lifecycle', async () => {
      let compilationListener: any;
      const mockLifecycle = {
        on: jest.fn((event, handler) => {
          if (event === 'agents:compiling') {
            compilationListener = handler;
          }
          return { dispose: jest.fn() };
        })
      };
      (Lifecycle.getInstance as jest.Mock).mockResolvedValue(mockLifecycle);

      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({ instanceUrl: 'https://test.salesforce.com' });

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
    });

    it('should handle simulation starting event from lifecycle', async () => {
      let simulationListener: any;
      const mockLifecycle = {
        on: jest.fn((event, handler) => {
          if (event === 'agents:simulation-starting') {
            simulationListener = handler;
          }
          return { dispose: jest.fn() };
        })
      };
      (Lifecycle.getInstance as jest.Mock).mockResolvedValue(mockLifecycle);

      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({ instanceUrl: 'https://test.salesforce.com' });

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
    });

    it('should enable debug mode for script agent when apex debugging is active', async () => {
      const mockLifecycle = {
        on: jest.fn().mockReturnValue({ dispose: jest.fn() })
      };
      (Lifecycle.getInstance as jest.Mock).mockResolvedValue(mockLifecycle);

      const mockAgentSimulate = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'script-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };
      (AgentSimulate as any).mockImplementation(() => mockAgentSimulate);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({ instanceUrl: 'https://test.salesforce.com' });

      // Enable debug mode
      (provider as any).apexDebugging = true;

      await messageHandler({
        command: 'startSession',
        data: { agentId: 'local:/workspace/testAgent.agent' }
      });

      expect(mockAgentSimulate.setApexDebugMode).toHaveBeenCalledWith(true);
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
      Agent.listRemote = jest.fn().mockResolvedValue([
        { Id: '0X1234567890123', MasterLabel: 'Test Agent', DeveloperName: 'TestAgent' }
      ]);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com',
        tooling: { _baseUrl: () => 'https://test.salesforce.com/services/data/v56.0' }
      });

      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      // Verify validation was called (implicitly by not throwing)
      // Verify AgentPreview was created
      expect(AgentPreview).toHaveBeenCalledWith(
        expect.any(Object),
        '0X1234567890123'
      );

      // Verify agent name was fetched
      expect(Agent.listRemote).toHaveBeenCalled();

      // Verify session was started
      expect(mockAgentPreview.start).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Agentforce DX: Session started with Test Agent'
      );
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
      Agent.listRemote = jest.fn().mockResolvedValue([
        { Id: '0X1234567890123', MasterLabel: 'Test Agent' }
      ]);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com',
        tooling: { _baseUrl: () => 'https://test.salesforce.com/services/data/v56.0' }
      });

      // Enable debug mode
      (provider as any).apexDebugging = true;

      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      expect(mockAgentPreview.setApexDebugMode).toHaveBeenCalledWith(true);
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
      Agent.listRemote = jest.fn().mockResolvedValue([
        { Id: '0X9999999999999', MasterLabel: 'Preselected Agent' }
      ]);

      (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
        instanceUrl: 'https://test.salesforce.com',
        tooling: { _baseUrl: () => 'https://test.salesforce.com/services/data/v56.0' }
      });

      // Set preselected agent ID (15 characters: 0X + 13 digits)
      (provider as any).preselectedAgentId = '0X9999999999999';

      await messageHandler({
        command: 'startSession',
        data: {}  // No agentId in message data
      });

      // Verify AgentPreview was created with preselected ID
      expect(AgentPreview).toHaveBeenCalledWith(
        expect.any(Object),
        '0X9999999999999'
      );
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
          onDidReceiveMessage: jest.fn((handler) => {
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
          messages: [{ message: 'Agent response' }],
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

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'messageSent',
        data: { content: 'Agent response' }
      });
    });

    it('should use default message when agent response is empty', async () => {
      const mockAgentPreview = {
        send: jest.fn().mockResolvedValue({
          messages: [{}], // No message property
          apexDebugLog: null
        })
      };

      (provider as any).agentPreview = mockAgentPreview;
      (provider as any).sessionId = 'test-session';

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Hello' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'messageSent',
        data: { content: 'I received your message.' }
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
      (provider as any).apexDebugging = true;

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
      (provider as any).apexDebugging = true;

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
      (provider as any).apexDebugging = true;

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
      (provider as any).apexDebugging = true;

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
      (provider as any).apexDebugging = true;

      await messageHandler({
        command: 'sendChatMessage',
        data: { message: 'Test' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'debugLogInfo',
        data: { message: 'Debug mode is enabled, but no Apex was executed.' }
      });
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
          onDidReceiveMessage: jest.fn((handler) => {
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
      const mockTranscriptEntries = [
        { timestamp: '2025-01-01', sessionId: 'session1', role: 'user' as const, text: 'Hello' }
      ];

      (readTranscriptEntries as jest.Mock).mockResolvedValue(mockTranscriptEntries);
      jest.spyOn(provider as any, 'loadAndSendConversationHistory').mockResolvedValue(undefined);

      await messageHandler({
        command: 'loadAgentHistory',
        data: { agentId: 'local:/workspace/myAgent.agent' }
      });

      // Should clear messages first
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'clearMessages'
      });

      // Should read transcript with agent file name
      expect(readTranscriptEntries).toHaveBeenCalledWith('myAgent.agent');

      // Should call loadAndSendConversationHistory when history exists
      expect((provider as any).loadAndSendConversationHistory).toHaveBeenCalledWith(
        'local:/workspace/myAgent.agent',
        AgentSource.SCRIPT,
        mockWebviewView
      );
    });

    it('should load history for published agent when history exists', async () => {
      const mockTranscriptEntries = [
        { timestamp: '2025-01-01', sessionId: 'session1', role: 'user' as const, text: 'Hello' }
      ];

      (readTranscriptEntries as jest.Mock).mockResolvedValue(mockTranscriptEntries);
      jest.spyOn(provider as any, 'loadAndSendConversationHistory').mockResolvedValue(undefined);

      await messageHandler({
        command: 'loadAgentHistory',
        data: { agentId: '0X1234567890123' }
      });

      // Should read transcript with Bot ID
      expect(readTranscriptEntries).toHaveBeenCalledWith('0X1234567890123');

      // Should call loadAndSendConversationHistory
      expect((provider as any).loadAndSendConversationHistory).toHaveBeenCalledWith(
        '0X1234567890123',
        AgentSource.PUBLISHED,
        mockWebviewView
      );
    });

    it('should send noHistoryFound when no history exists', async () => {
      (readTranscriptEntries as jest.Mock).mockResolvedValue([]);

      await messageHandler({
        command: 'loadAgentHistory',
        data: { agentId: '0X1234567890123' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'noHistoryFound',
        data: { agentId: '0X1234567890123' }
      });
    });

    it('should send noHistoryFound when transcriptEntries is null', async () => {
      (readTranscriptEntries as jest.Mock).mockResolvedValue(null);

      await messageHandler({
        command: 'loadAgentHistory',
        data: { agentId: '0X1234567890123' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'noHistoryFound',
        data: { agentId: '0X1234567890123' }
      });
    });

    it('should handle error and send noHistoryFound', async () => {
      (readTranscriptEntries as jest.Mock).mockRejectedValue(new Error('Failed to read history'));

      await messageHandler({
        command: 'loadAgentHistory',
        data: { agentId: '0X1234567890123' }
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error checking history:', expect.any(Error));
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'noHistoryFound',
        data: { agentId: '0X1234567890123' }
      });
    });

    it('should not process when agentId is invalid', async () => {
      await messageHandler({
        command: 'loadAgentHistory',
        data: { agentId: null }
      });

      expect(readTranscriptEntries).not.toHaveBeenCalled();
    });
  });

  describe('getTraceData Message Handler', () => {
    let messageHandler: (message: any) => Promise<void>;
    let mockWebviewView: any;
    const fs = require('fs');

    beforeEach(() => {
      jest.spyOn(provider as any, 'getHtmlForWebview').mockReturnValue('<html><body>Test</body></html>');

      mockWebviewView = {
        webview: {
          options: {},
          onDidReceiveMessage: jest.fn((handler) => {
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

    it('should load tracer data from custom path when configured', async () => {
      const customPath = '/custom/path/tracer.json';
      const mockTraceData = { sessions: [], agents: [] };

      const mockConfig = {
        get: jest.fn().mockReturnValue(customPath)
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockTraceData));

      await messageHandler({ command: 'getTraceData' });

      expect(mockConfig.get).toHaveBeenCalledWith('salesforce.agentforceDX.tracerDataFilePath');
      expect(fs.existsSync).toHaveBeenCalledWith(customPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(customPath, 'utf8');
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'traceData',
        data: mockTraceData
      });
    });

    it('should trim whitespace from custom path', async () => {
      const customPath = '  /custom/path/tracer.json  ';
      const mockTraceData = { sessions: [] };

      const mockConfig = {
        get: jest.fn().mockReturnValue(customPath)
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockTraceData));

      await messageHandler({ command: 'getTraceData' });

      expect(fs.existsSync).toHaveBeenCalledWith('/custom/path/tracer.json');
    });

    it('should use default path when no custom path configured', async () => {
      const mockConfig = {
        get: jest.fn().mockReturnValue('')
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      const mockTraceData = { sessions: [] };
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockTraceData));

      await messageHandler({ command: 'getTraceData' });

      const expectedPath = path.join('/extension/path', 'webview', 'src', 'data', 'tracer.json');
      expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
    });

    it('should send error when tracer file not found', async () => {
      const customPath = '/custom/path/tracer.json';

      const mockConfig = {
        get: jest.fn().mockReturnValue(customPath)
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await messageHandler({ command: 'getTraceData' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: {
          message: `tracer.json not found at ${customPath}. Please check the path in your settings.`
        }
      });
    });

    it('should handle JSON parse error', async () => {
      const mockConfig = {
        get: jest.fn().mockReturnValue('/custom/path/tracer.json')
      };
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json{{{');

      await messageHandler({ command: 'getTraceData' });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'error',
        data: { message: expect.stringContaining('Unexpected token') }
      });
    });
  });
});

