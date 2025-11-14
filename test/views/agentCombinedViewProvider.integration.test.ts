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

/**
 * Integration tests for AgentCombinedViewProvider covering recent bug fixes
 * These tests verify complete flows for:
 * - Message clearing on session start
 * - Session state management
 * - Error handling and recovery
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { AgentCombinedViewProvider } from '../../src/views/agentCombinedViewProvider';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { AgentSimulate, AgentPreview, Agent } from '@salesforce/agents';
import { Lifecycle } from '@salesforce/core';

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
      createDirectory: jest.fn(),
      stat: jest.fn()
    },
    onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() }))
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
jest.mock('../../src/services/coreExtensionService', () => ({
  CoreExtensionService: {
    getDefaultConnection: jest.fn(),
    getTelemetryService: jest.fn(() => ({
      sendCommandEvent: jest.fn()
    }))
  }
}));

jest.mock('../../src/utils/clientAppUtils', () => ({
  getAvailableClientApps: jest.fn(),
  createConnectionWithClientApp: jest.fn()
}));

describe('AgentCombinedViewProvider Integration Tests', () => {
  let provider: AgentCombinedViewProvider;
  let mockContext: vscode.ExtensionContext;
  let mockWebviewView: any;
  let messageHandler: (message: any) => Promise<void>;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    mockContext = {
      extensionUri: vscode.Uri.file('/mock/path'),
      extensionPath: '/mock/path',
      subscriptions: [],
      globalState: {
        get: jest.fn().mockReturnValue(false),
        update: jest.fn().mockResolvedValue(undefined),
        keys: jest.fn().mockReturnValue([]),
        setKeysForSync: jest.fn()
      }
    } as any;

    provider = new (AgentCombinedViewProvider as any)(mockContext);

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

    // Mock CoreExtensionService
    (CoreExtensionService.getDefaultConnection as jest.Mock).mockResolvedValue({
      instanceUrl: 'https://test.salesforce.com',
      tooling: { _baseUrl: () => 'https://test.salesforce.com/services/data/v56.0' }
    });

    // Mock Agent.listRemote
    const { Agent } = require('@salesforce/agents');
    Agent.listRemote = jest.fn().mockResolvedValue([
      { Id: '0X1234567890123', MasterLabel: 'Test Agent', DeveloperName: 'TestAgent' }
    ]);

    // Mock Lifecycle
    const mockLifecycle = {
      on: jest.fn(),
      removeAllListeners: jest.fn()
    };
    (Lifecycle.getInstance as jest.Mock).mockReturnValue(mockLifecycle);

    // Resolve the webview
    provider.resolveWebviewView(mockWebviewView, {} as any, {} as vscode.CancellationToken);
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Message Clearing on Session Start', () => {
    it('should clear messages before starting a new session', async () => {
      const mockAgentPreview = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'test-session',
          messages: [{ type: 'Inform', message: 'Hello' }]
        }),
        setApexDebugMode: jest.fn()
      };

      (AgentPreview as any).mockImplementation(() => mockAgentPreview);

      // Start session
      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      // Verify clearMessages was called before sessionStarting
      const calls = mockWebviewView.webview.postMessage.mock.calls;
      const clearMessagesIndex = calls.findIndex((call: any) => call[0]?.command === 'clearMessages');
      const sessionStartingIndex = calls.findIndex((call: any) => call[0]?.command === 'sessionStarting');

      expect(clearMessagesIndex).toBeGreaterThanOrEqual(0);
      expect(sessionStartingIndex).toBeGreaterThan(clearMessagesIndex);
    });

    it('should clear messages when restarting an active session', async () => {
      // Set up existing session
      const mockExistingAgent = {
        end: jest.fn().mockResolvedValue(undefined),
        start: jest.fn().mockResolvedValue({
          sessionId: 'new-session',
          messages: []
        }),
        setApexDebugMode: jest.fn()
      };

      (provider as any).agentPreview = mockExistingAgent;
      (provider as any).sessionId = 'old-session';
      Object.setPrototypeOf((provider as any).agentPreview, AgentPreview.prototype);

      jest.clearAllMocks();

      // Restart session
      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      // Verify clearMessages was sent
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'clearMessages'
      });
    });
  });

  describe('Session State Management', () => {
    it('should properly set session states during complete lifecycle', async () => {
      const mockAgentPreview = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'test-session',
          messages: [{ type: 'Inform', message: 'Hello' }]
        }),
        end: jest.fn().mockResolvedValue(undefined),
        setApexDebugMode: jest.fn()
      };

      (AgentPreview as any).mockImplementation(() => mockAgentPreview);

      // Start session
      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      // Verify session state messages
      const calls = mockWebviewView.webview.postMessage.mock.calls;

      // Should have clearMessages
      expect(calls.some((call: any) => call[0]?.command === 'clearMessages')).toBe(true);

      // Should have sessionStarting
      expect(calls.some((call: any) => call[0]?.command === 'sessionStarting')).toBe(true);

      // Should have sessionStarted
      expect(calls.some((call: any) => call[0]?.command === 'sessionStarted')).toBe(true);
    });

    it('should handle session errors gracefully', async () => {
      const mockAgentPreview = {
        start: jest.fn().mockRejectedValue(new Error('Connection failed')),
        setApexDebugMode: jest.fn()
      };

      (AgentPreview as any).mockImplementation(() => mockAgentPreview);

      // Try to start session
      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      // Should send error message
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'error'
        })
      );
    });
  });

  describe('Error Recovery', () => {
    it('should allow retry after session start failure', async () => {
      let callCount = 0;
      const mockAgentPreview = {
        start: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('First attempt failed'));
          }
          return Promise.resolve({
            sessionId: 'test-session',
            messages: [{ type: 'Inform', message: 'Hello' }]
          });
        }),
        setApexDebugMode: jest.fn()
      };

      (AgentPreview as any).mockImplementation(() => mockAgentPreview);

      // First attempt fails
      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'error'
        })
      );

      jest.clearAllMocks();

      // Second attempt succeeds
      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'sessionStarted'
        })
      );
    });
  });

  describe('Refresh Agents', () => {
    it('should clear agent selection when refreshing', async () => {
      // Set up current agent
      (provider as any).currentAgentId = '0X1234567890123';
      (provider as any).currentAgentName = 'Test Agent';

      // Refresh agents
      await provider.refreshAvailableAgents();

      // Verify state was cleared
      expect((provider as any).currentAgentId).toBeUndefined();
      expect((provider as any).currentAgentName).toBeUndefined();

      // Verify message was sent
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'refreshAgents'
      });
    });
  });

  describe('Complete User Flows', () => {
    it('should handle flow: start, use agent, error, retry', async () => {
      let startCallCount = 0;
      const mockAgentPreview = {
        start: jest.fn().mockImplementation(() => {
          startCallCount++;
          if (startCallCount === 1) {
            return Promise.resolve({
              sessionId: 'first-session',
              messages: [{ type: 'Inform', message: 'Hello' }]
            });
          }
          return Promise.reject(new Error('Retry failed'));
        }),
        end: jest.fn().mockResolvedValue(undefined),
        setApexDebugMode: jest.fn()
      };

      (AgentPreview as any).mockImplementation(() => mockAgentPreview);

      // First session succeeds
      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'sessionStarted'
        })
      );

      jest.clearAllMocks();

      // Try to restart, fails
      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      // Should have cleared messages before attempting
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'clearMessages'
      });

      // Should have sent error
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'error'
        })
      );
    });

    it('should handle flow: start, refresh agents, start different agent', async () => {
      const mockAgentPreview = {
        start: jest.fn().mockResolvedValue({
          sessionId: 'test-session',
          messages: [{ type: 'Inform', message: 'Hello' }]
        }),
        setApexDebugMode: jest.fn()
      };

      (AgentPreview as any).mockImplementation(() => mockAgentPreview);

      // Start first agent
      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X1234567890123' }
      });

      expect((provider as any).currentAgentId).toBeDefined();

      // Refresh agents
      await provider.refreshAvailableAgents();

      expect((provider as any).currentAgentId).toBeUndefined();
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'refreshAgents'
      });

      jest.clearAllMocks();

      // Start different agent
      await messageHandler({
        command: 'startSession',
        data: { agentId: '0X9876543210987' }
      });

      // Should clear messages
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
        command: 'clearMessages'
      });
    });
  });
});
