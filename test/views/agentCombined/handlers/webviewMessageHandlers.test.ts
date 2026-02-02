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

// Mock VS Code
jest.mock('vscode', () => ({
  commands: {
    executeCommand: jest.fn()
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn()
    }))
  }
}));

// Mock @salesforce/agents
jest.mock('@salesforce/agents', () => ({
  AgentSource: {
    SCRIPT: 'script',
    PUBLISHED: 'published'
  },
  Agent: {
    listPreviewable: jest.fn()
  }
}));

// Mock @salesforce/core
jest.mock('@salesforce/core', () => ({
  SfProject: {
    getInstance: () => ({
      getPath: () => '/mock/project'
    })
  },
  SfError: {
    wrap: (err: unknown) => (err instanceof Error ? err : new Error(String(err)))
  }
}));

// Mock CoreExtensionService
jest.mock('../../../../src/services/coreExtensionService', () => ({
  CoreExtensionService: {
    getDefaultConnection: jest.fn().mockResolvedValue({
      instanceUrl: 'https://test.salesforce.com'
    }),
    getChannelService: jest.fn(() => ({
      appendLine: jest.fn(),
      showChannelOutput: jest.fn()
    }))
  }
}));

// Mock agentUtils
jest.mock('../../../../src/views/agentCombined/agent/agentUtils', () => ({
  getAgentSource: jest.fn()
}));

// Import after mocks
import { WebviewMessageHandlers } from '../../../../src/views/agentCombined/handlers/webviewMessageHandlers';
import { CoreExtensionService } from '../../../../src/services/coreExtensionService';

describe('WebviewMessageHandlers', () => {
  let handlers: WebviewMessageHandlers;
  let mockState: any;
  let mockMessageSender: any;
  let mockSessionManager: any;
  let mockHistoryManager: any;
  let mockApexDebugManager: any;
  let mockContext: any;
  let mockWebviewView: any;
  let mockChannelService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockState = {
      agentInstance: undefined,
      sessionId: '',
      currentAgentId: undefined,
      currentAgentSource: undefined,
      isSessionActive: false,
      isSessionStarting: false,
      pendingStartAgentId: undefined,
      pendingStartAgentSource: undefined,
      setSessionActive: jest.fn().mockResolvedValue(undefined),
      setSessionStarting: jest.fn().mockResolvedValue(undefined),
      setResetAgentViewAvailable: jest.fn().mockResolvedValue(undefined),
      setSessionErrorState: jest.fn().mockResolvedValue(undefined),
      clearSessionState: jest.fn()
    };

    mockMessageSender = {
      sendError: jest.fn().mockResolvedValue(undefined),
      sendClearMessages: jest.fn()
    };

    mockSessionManager = {
      startSession: jest.fn(),
      endSession: jest.fn()
    };

    mockHistoryManager = {
      loadAndSendTraceHistory: jest.fn(),
      showHistoryOrPlaceholder: jest.fn()
    };

    mockApexDebugManager = {};

    mockContext = {};

    mockChannelService = {
      appendLine: jest.fn(),
      showChannelOutput: jest.fn()
    };

    // Ensure getChannelService returns our mock so Logger gets a valid channelService
    jest.spyOn(CoreExtensionService, 'getChannelService').mockReturnValue(mockChannelService as any);

    mockWebviewView = {
      webview: {
        postMessage: jest.fn()
      }
    };

    handlers = new WebviewMessageHandlers(
      mockState,
      mockMessageSender,
      mockSessionManager,
      mockHistoryManager,
      mockApexDebugManager,
      mockContext,
      mockWebviewView
    );
  });

  describe('handleError', () => {
    // Suppress console.error for expected error logs
    const originalError = console.error;
    beforeAll(() => {
      console.error = jest.fn();
    });
    afterAll(() => {
      console.error = originalError;
    });

    it('should display deactivation message for deactivated agent error', async () => {
      const error = new Error('404 NOT_FOUND: No valid version available for this agent');

      await handlers.handleError(error);

      expect(mockMessageSender.sendError).toHaveBeenCalledWith(
        expect.stringContaining('currently deactivated')
      );
    });

    it('should display not found message for deleted agent error', async () => {
      const error = new Error('404 NOT_FOUND: Agent does not exist');

      await handlers.handleError(error);

      expect(mockMessageSender.sendError).toHaveBeenCalledWith(
        expect.stringContaining("couldn't be found")
      );
    });

    it('should display permission message for forbidden error', async () => {
      const error = new Error('403 FORBIDDEN: Access denied');

      await handlers.handleError(error);

      expect(mockMessageSender.sendError).toHaveBeenCalledWith(
        expect.stringContaining("don't have permission")
      );
    });

    it('should display generic message with technical details for unknown errors', async () => {
      const error = new Error('Something unexpected happened');

      await handlers.handleError(error);

      expect(mockMessageSender.sendError).toHaveBeenCalledWith(
        'Something went wrong. Please try again.',
        'Something unexpected happened'
      );
    });

    it('should set error state flags', async () => {
      const error = new Error('Any error');

      await handlers.handleError(error);

      expect(mockState.setResetAgentViewAvailable).toHaveBeenCalledWith(true);
      expect(mockState.setSessionErrorState).toHaveBeenCalledWith(true);
    });

    it('should clear session state if session was active', async () => {
      mockState.isSessionActive = true;
      const error = new Error('Any error');

      await handlers.handleError(error);

      expect(mockState.clearSessionState).toHaveBeenCalled();
      expect(mockState.setSessionActive).toHaveBeenCalledWith(false);
      expect(mockState.setSessionStarting).toHaveBeenCalledWith(false);
    });

    it('should clear pending start agent info', async () => {
      mockState.pendingStartAgentId = 'test-agent';
      mockState.pendingStartAgentSource = 'published';
      const error = new Error('Any error');

      await handlers.handleError(error);

      expect(mockState.pendingStartAgentId).toBeUndefined();
      expect(mockState.pendingStartAgentSource).toBeUndefined();
    });

    it('should log error to channel service', async () => {
      const error = new Error('Test error message');

      await handlers.handleError(error);

      expect(mockChannelService.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('[error] AgentCombinedViewProvider error')
      );
    });
  });
});
