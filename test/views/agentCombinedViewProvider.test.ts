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
import * as path from 'path';
import { AgentCombinedViewProvider } from '../../src/views/agentCombinedViewProvider';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { AgentSource } from '@salesforce/agents';

// Mock VS Code
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInputBox: jest.fn(),
    showOpenDialog: jest.fn(),
    activeTextEditor: null
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(() => true)
    })),
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }]
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
      fsPath: require('path').join(base.fsPath || base, ...segments)
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
  Agent: {
    init: jest.fn(),
    listPreviewable: jest.fn()
  }
}));

// Mock @salesforce/agents/lib/utils
jest.mock('@salesforce/agents/lib/utils', () => ({
  getAllHistory: jest.fn(),
  getHistoryDir: jest.fn()
}));

// Mock fs.promises
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    cp: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock @salesforce/core
jest.mock('@salesforce/core', () => ({
  SfProject: {
    getInstance: jest.fn()
  }
}));

// Mock services
jest.mock('../../src/services/coreExtensionService', () => ({
  CoreExtensionService: {
    getChannelService: jest.fn(() => ({
  appendLine: jest.fn(),
  showChannelOutput: jest.fn(),
  clear: jest.fn()
    })),
    getDefaultConnection: jest.fn().mockResolvedValue({
      instanceUrl: 'https://test.salesforce.com'
    }),
      getTelemetryService: jest.fn(() => ({
        sendCommandEvent: jest.fn()
    }))
  }
}));

describe('AgentCombinedViewProvider', () => {
  let provider: AgentCombinedViewProvider;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Ensure channelService is mocked before creating provider
    const mockChannelService = {
      appendLine: jest.fn(),
      showChannelOutput: jest.fn(),
      clear: jest.fn()
    };
    jest.spyOn(CoreExtensionService, 'getChannelService').mockReturnValue(mockChannelService as any);

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

    provider = new AgentCombinedViewProvider(mockContext);
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
      provider.setAgentId('test-agent-id');
      expect(provider.getCurrentAgentId()).toBe('test-agent-id');
    });
  });

  describe('setAgentId', () => {
    it('should set the agent ID', () => {
      provider.setAgentId('new-agent-id');
      expect(provider.getCurrentAgentId()).toBe('new-agent-id');
    });
  });

  describe('toggleDebugMode', () => {
    it('should toggle debug mode on', async () => {
      // Initially off
      await provider.toggleDebugMode();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Debug mode activated.');
    });

    it('should toggle debug mode off', async () => {
      // Turn on first
      await provider.toggleDebugMode();
      jest.clearAllMocks();

      // Then turn off
      await provider.toggleDebugMode();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Debug mode deactivated.');
    });
  });

  describe('resolveWebviewView', () => {
    it('should set up webview and message handlers', () => {
      const mockWebviewView = {
        webview: {
          options: {},
          onDidReceiveMessage: jest.fn(),
          postMessage: jest.fn(),
          html: ''
        },
        show: jest.fn()
      } as any;

      // Mock fs.readFileSync for getHtmlForWebview
      const fs = require('fs');
      jest.spyOn(fs, 'readFileSync').mockReturnValue('<html></html>');

      provider.resolveWebviewView(mockWebviewView, {} as any, {} as vscode.CancellationToken);

      expect(provider.webviewView).toBe(mockWebviewView);
      expect(mockWebviewView.webview.options.enableScripts).toBe(true);
      expect(mockWebviewView.webview.onDidReceiveMessage).toHaveBeenCalled();
    });
  });


  describe('getAgentsForCommandPalette', () => {
    it('should return list of previewable agents', async () => {
      const { Agent } = require('@salesforce/agents');
      const { SfProject } = require('@salesforce/core');

      const mockAgents = [
        { id: '0X123', name: 'Agent 1', source: AgentSource.PUBLISHED },
        { id: '/path/to/agent', name: 'Agent 2', source: AgentSource.SCRIPT }
      ];

      Agent.listPreviewable = jest.fn().mockResolvedValue(mockAgents);
      SfProject.getInstance = jest.fn().mockReturnValue({ getPath: () => '/test' });

      const agents = await provider.getAgentsForCommandPalette();

      expect(agents).toEqual(mockAgents);
      expect(Agent.listPreviewable).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const { Agent } = require('@salesforce/agents');
      const { SfProject } = require('@salesforce/core');

      Agent.listPreviewable = jest.fn().mockRejectedValue(new Error('Connection failed'));
      SfProject.getInstance = jest.fn().mockReturnValue({ getPath: () => '/test' });

      const agents = await provider.getAgentsForCommandPalette();

      expect(agents).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('exportConversation', () => {
    let mockAgentInstance: any;
    let mockShowOpenDialog: jest.SpyInstance;

    beforeEach(() => {
      mockShowOpenDialog = jest.spyOn(vscode.window, 'showOpenDialog');
      mockAgentInstance = {
        preview: {
          saveSession: jest.fn().mockResolvedValue(undefined)
        }
      };

      // Mock the state to have agent info with an active session
      (provider as any).state.currentAgentId = 'test-agent-id';
      (provider as any).state.currentAgentSource = AgentSource.SCRIPT;
      (provider as any).state.currentAgentName = 'Test Agent';
      (provider as any).state.agentInstance = mockAgentInstance;
      (provider as any).state._isSessionActive = true; // Mark session as active

      // Clear any saved export directory
      jest.spyOn((provider as any).state, 'getExportDirectory').mockReturnValue(undefined);
      jest.spyOn((provider as any).state, 'setExportDirectory').mockResolvedValue(undefined);
    });

    it('should show warning when no agent is selected', async () => {
      (provider as any).state.currentAgentId = undefined;
      (provider as any).state.currentAgentSource = undefined;

      await provider.exportConversation();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No agent selected to save session.');
      expect(mockShowOpenDialog).not.toHaveBeenCalled();
    });

    it('should show folder picker and save successfully when no saved directory', async () => {
      mockShowOpenDialog.mockResolvedValue([{ fsPath: '/selected/folder' }]);

      await provider.exportConversation();

      expect(mockShowOpenDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: 'Save Chat History'
        })
      );
      expect(mockAgentInstance.preview.saveSession).toHaveBeenCalledWith('/selected/folder');
      expect((provider as any).state.setExportDirectory).toHaveBeenCalledWith('/selected/folder');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Conversation session saved to /selected/folder.'
      );
    });

    it('should use saved directory without prompting', async () => {
      // Mock saved export directory
      jest.spyOn((provider as any).state, 'getExportDirectory').mockReturnValue('/saved/export/dir');

      await provider.exportConversation();

      expect(mockShowOpenDialog).not.toHaveBeenCalled();
      expect(mockAgentInstance.preview.saveSession).toHaveBeenCalledWith('/saved/export/dir');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Conversation session saved to /saved/export/dir.'
      );
    });

    it('should return early when user cancels folder selection', async () => {
      mockShowOpenDialog.mockResolvedValue(undefined);

      await provider.exportConversation();

      expect(mockShowOpenDialog).toHaveBeenCalled();
      expect(mockAgentInstance.preview.saveSession).not.toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it('should return early when user selects empty folder array', async () => {
      mockShowOpenDialog.mockResolvedValue([]);

      await provider.exportConversation();

      expect(mockShowOpenDialog).toHaveBeenCalled();
      expect(mockAgentInstance.preview.saveSession).not.toHaveBeenCalled();
    });

    it('should handle saveSession error', async () => {
      jest.spyOn((provider as any).state, 'getExportDirectory').mockReturnValue('/saved/dir');
      const saveError = new Error('Save failed');
      mockAgentInstance.preview.saveSession.mockRejectedValue(saveError);

      await provider.exportConversation();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to save conversation: Save failed');
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it('should save from loaded history when no active session', async () => {
      // No active session
      (provider as any).state._isSessionActive = false;
      (provider as any).state.agentInstance = undefined;
      jest.spyOn((provider as any).state, 'getExportDirectory').mockReturnValue('/saved/export/dir');

      // Mock getAllHistory and getHistoryDir from the library
      const { getAllHistory, getHistoryDir } = require('@salesforce/agents/lib/utils');
      getAllHistory.mockResolvedValue({
        metadata: { sessionId: 'test-session-123' },
        transcript: [],
        traces: []
      });
      getHistoryDir.mockResolvedValue('/home/.sfdx/agents/test-agent-id/sessions/test-session-123');

      // Get the mocked fs module
      const fs = require('fs');

      await provider.exportConversation();

      expect(getAllHistory).toHaveBeenCalledWith('test-agent-id', undefined);
      expect(getHistoryDir).toHaveBeenCalledWith('test-agent-id', 'test-session-123');
      expect(fs.promises.cp).toHaveBeenCalledWith(
        '/home/.sfdx/agents/test-agent-id/sessions/test-session-123',
        expect.stringContaining('session_test-session-123'),
        { recursive: true }
      );
    });

    it('should show warning when no history found and no active session', async () => {
      // No active session
      (provider as any).state._isSessionActive = false;
      (provider as any).state.agentInstance = undefined;
      jest.spyOn((provider as any).state, 'getExportDirectory').mockReturnValue('/saved/dir');

      // Mock getAllHistory to return no sessionId
      const { getAllHistory } = require('@salesforce/agents/lib/utils');
      getAllHistory.mockResolvedValue({
        metadata: null,
        transcript: [],
        traces: []
      });

      await provider.exportConversation();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No conversation history found to save.');
    });

    it('should not reinitialize agent when using saved directory', async () => {
      jest.spyOn((provider as any).state, 'getExportDirectory').mockReturnValue('/saved/dir');

      const initializeScriptAgentSpy = jest.spyOn((provider as any).agentInitializer, 'initializeScriptAgent');

      await provider.exportConversation();

      expect(initializeScriptAgentSpy).not.toHaveBeenCalled();
      expect(mockAgentInstance.preview.saveSession).toHaveBeenCalledWith('/saved/dir');
    });
  });
});
