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
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { AgentSource } from '@salesforce/agents';

// Mock VS Code
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInputBox: jest.fn(),
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
    let mockShowInputBox: jest.SpyInstance;

    beforeEach(() => {
      mockShowInputBox = jest.spyOn(vscode.window, 'showInputBox');
      mockAgentInstance = {
        preview: {
          saveSession: jest.fn().mockResolvedValue(undefined)
        }
      };

      // Mock the state to have agent info
      (provider as any).state.currentAgentId = 'test-agent-id';
      (provider as any).state.currentAgentSource = AgentSource.SCRIPT;
      (provider as any).state.currentAgentName = 'Test Agent';
      (provider as any).state.agentInstance = mockAgentInstance;
    });

    it('should show warning when no agent is selected', async () => {
      (provider as any).state.currentAgentId = undefined;
      (provider as any).state.currentAgentSource = undefined;

      await provider.exportConversation();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No agent selected to save session.');
      expect(mockShowInputBox).not.toHaveBeenCalled();
    });

    it('should prompt for directory path and save successfully', async () => {
      mockShowInputBox.mockResolvedValue('sessions/MySession');

      await provider.exportConversation();

      expect(mockShowInputBox).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Enter the output directory path ',
          placeHolder: 'sessions/MySession',
          value: 'sessions'
        })
      );
      expect(mockAgentInstance.preview.saveSession).toHaveBeenCalledWith('/workspace/sessions/MySession');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Conversation session saved to /workspace/sessions/MySession.'
      );
    });

    it('should return early when user cancels input', async () => {
      mockShowInputBox.mockResolvedValue(undefined);

      await provider.exportConversation();

      expect(mockShowInputBox).toHaveBeenCalled();
      expect(mockAgentInstance.preview.saveSession).not.toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it('should validate empty directory path', async () => {
      // Mock validation to return error for empty string, then user cancels
      let validateInputFn: ((value: string) => string | null) | undefined;
      mockShowInputBox.mockImplementation((options: any) => {
        validateInputFn = options.validateInput;
        // Return empty string first (will be caught by validation)
        if (validateInputFn && validateInputFn('') === 'Directory path is required') {
          return Promise.resolve(undefined); // User cancels after seeing validation error
        }
        return Promise.resolve('sessions/MySession');
      });

      await provider.exportConversation();

      expect(validateInputFn).toBeDefined();
      if (validateInputFn) {
        expect(validateInputFn('')).toBe('Directory path is required');
        expect(validateInputFn('   ')).toBe('Directory path is required');
      }
    });

    it('should validate invalid characters in directory path', async () => {
      let validateInputFn: ((value: string) => string | null) | undefined;
      mockShowInputBox.mockImplementation((options: any) => {
        validateInputFn = options.validateInput;
        return Promise.resolve('sessions/MySession');
      });

      await provider.exportConversation();

      expect(validateInputFn).toBeDefined();
      if (validateInputFn) {
        // Invalid characters
        expect(validateInputFn('test<invalid>')).toBe('Directory path contains invalid characters');
        expect(validateInputFn('test:invalid')).toBe('Directory path contains invalid characters');
        expect(validateInputFn('test"invalid')).toBe('Directory path contains invalid characters');
        expect(validateInputFn('test|invalid')).toBe('Directory path contains invalid characters');
        expect(validateInputFn('test?invalid')).toBe('Directory path contains invalid characters');
        expect(validateInputFn('test*invalid')).toBe('Directory path contains invalid characters');

        // Valid paths should pass
        expect(validateInputFn('sessions/MySession')).toBeNull();
        expect(validateInputFn('sessions\\MySession')).toBeNull(); // backslash is allowed
        expect(validateInputFn('MySession')).toBeNull();
        expect(validateInputFn('sessions/subfolder/MySession')).toBeNull();
      }
    });

    it('should trim whitespace from directory path', async () => {
      mockShowInputBox.mockResolvedValue('  sessions/MySession  ');

      await provider.exportConversation();

      expect(mockAgentInstance.preview.saveSession).toHaveBeenCalledWith('/workspace/sessions/MySession');
    });

    it('should handle saveSession error', async () => {
      mockShowInputBox.mockResolvedValue('sessions/MySession');
      const saveError = new Error('Save failed');
      mockAgentInstance.preview.saveSession.mockRejectedValue(saveError);

      await provider.exportConversation();

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to save conversation: Save failed');
      expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
    });

    it('should reinitialize agent instance when not available', async () => {
      (provider as any).state.agentInstance = undefined;
      mockShowInputBox.mockResolvedValue('sessions/MySession');

      const mockConnection = { instanceUrl: 'https://test.salesforce.com' };
      const mockProject = { getPath: () => '/test' };
      const { SfProject } = require('@salesforce/core');
      jest.spyOn(CoreExtensionService, 'getDefaultConnection').mockResolvedValue(mockConnection as any);
      SfProject.getInstance = jest.fn().mockReturnValue(mockProject);

      const mockInitializedAgent = {
        preview: {
          saveSession: jest.fn().mockResolvedValue(undefined)
        }
      };

      // Mock the agent initializer
      const initializeScriptAgentSpy = jest
        .spyOn((provider as any).agentInitializer, 'initializeScriptAgent')
        .mockResolvedValue(mockInitializedAgent);

      await provider.exportConversation();

      expect(initializeScriptAgentSpy).toHaveBeenCalledWith(
        'test-agent-id',
        mockConnection,
        mockProject,
        false,
        expect.any(Function)
      );
      expect(mockInitializedAgent.preview.saveSession).toHaveBeenCalledWith('/workspace/sessions/MySession');
    });

    it('should reinitialize published agent when not available', async () => {
      (provider as any).state.agentInstance = undefined;
      (provider as any).state.currentAgentSource = AgentSource.PUBLISHED;
      mockShowInputBox.mockResolvedValue('sessions/MySession');

      const mockConnection = { instanceUrl: 'https://test.salesforce.com' };
      const mockProject = { getPath: () => '/test' };
      const { SfProject } = require('@salesforce/core');
      jest.spyOn(CoreExtensionService, 'getDefaultConnection').mockResolvedValue(mockConnection as any);
      SfProject.getInstance = jest.fn().mockReturnValue(mockProject);

      const mockInitializedAgent = {
        preview: {
          saveSession: jest.fn().mockResolvedValue(undefined)
        }
      };

      // Mock the agent initializer
      const initializePublishedAgentSpy = jest
        .spyOn((provider as any).agentInitializer, 'initializePublishedAgent')
        .mockResolvedValue(mockInitializedAgent);

      await provider.exportConversation();

      expect(initializePublishedAgentSpy).toHaveBeenCalledWith('test-agent-id', mockConnection, mockProject);
      expect(mockInitializedAgent.preview.saveSession).toHaveBeenCalledWith('/workspace/sessions/MySession');
    });

    it('should use existing agent instance when available', async () => {
      mockShowInputBox.mockResolvedValue('sessions/MySession');

      const initializeScriptAgentSpy = jest.spyOn((provider as any).agentInitializer, 'initializeScriptAgent');

      await provider.exportConversation();

      expect(initializeScriptAgentSpy).not.toHaveBeenCalled();
      expect(mockAgentInstance.preview.saveSession).toHaveBeenCalledWith('/workspace/sessions/MySession');
    });
  });
});
