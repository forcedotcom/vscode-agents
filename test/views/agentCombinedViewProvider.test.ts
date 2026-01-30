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

  describe('clearHistory', () => {
    it('should throw error when webview is not ready', async () => {
      await expect(provider.clearHistory()).rejects.toThrow('Agent view is not ready.');
    });

    it('should throw error when no agent is selected', async () => {
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

      await expect(provider.clearHistory()).rejects.toThrow('No agent selected to clear history.');
    });
  });
});
