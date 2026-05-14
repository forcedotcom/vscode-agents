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

// Mock sessionHistoryService (the session/index reexports it)
jest.mock('../../../../src/views/agentCombined/session', () => ({
  listSessionsForAgent: jest.fn()
}));

// Import after mocks
import { WebviewMessageHandlers } from '../../../../src/views/agentCombined/handlers/webviewMessageHandlers';
import { CoreExtensionService } from '../../../../src/services/coreExtensionService';
import { listSessionsForAgent } from '../../../../src/views/agentCombined/session';

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
      sendClearMessages: jest.fn(),
      sendSessionList: jest.fn()
    };

    mockSessionManager = {
      startSession: jest.fn(),
      endSession: jest.fn(),
      resumeSession: jest.fn().mockResolvedValue(undefined)
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
        'Agent deactivated',
        expect.stringContaining('currently deactivated')
      );
    });

    it('should display not found message for deleted agent error', async () => {
      const error = new Error('404 NOT_FOUND: Agent does not exist');

      await handlers.handleError(error);

      expect(mockMessageSender.sendError).toHaveBeenCalledWith(
        'Agent not found',
        expect.stringContaining("couldn't be found")
      );
    });

    it('should display permission message for forbidden error', async () => {
      const error = new Error('403 FORBIDDEN: Access denied');

      await handlers.handleError(error);

      expect(mockMessageSender.sendError).toHaveBeenCalledWith(
        'Permission denied',
        expect.stringContaining("don't have permission")
      );
    });

    it('should display generic message with technical details for unknown errors', async () => {
      const error = new Error('Something unexpected happened');

      await handlers.handleError(error);

      expect(mockMessageSender.sendError).toHaveBeenCalledWith(
        'Something went wrong',
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

  describe('listSessions', () => {
    it('posts the session list back to the webview', async () => {
      const sessions = [
        { sessionId: 'a', timestamp: '2026-05-10T00:00:00Z', sessionType: 'live', firstUserMessage: 'hi' }
      ];
      (listSessionsForAgent as jest.Mock).mockResolvedValue(sessions);

      await handlers.handleMessage({
        command: 'listSessions',
        data: { agentId: 'agent-1', agentSource: 'script' }
      } as any);

      expect(listSessionsForAgent).toHaveBeenCalledWith('agent-1', 'script');
      expect(mockMessageSender.sendSessionList).toHaveBeenCalledWith('agent-1', sessions);
    });

    it('returns an empty list when no agentId is supplied or known', async () => {
      await handlers.handleMessage({ command: 'listSessions', data: {} } as any);

      expect(mockMessageSender.sendSessionList).toHaveBeenCalledWith('', []);
      expect(listSessionsForAgent).not.toHaveBeenCalled();
    });

    it('falls back to an empty list when listing throws', async () => {
      (listSessionsForAgent as jest.Mock).mockRejectedValue(new Error('boom'));
      const originalError = console.error;
      console.error = jest.fn();

      await handlers.handleMessage({
        command: 'listSessions',
        data: { agentId: 'agent-1', agentSource: 'script' }
      } as any);

      expect(mockMessageSender.sendSessionList).toHaveBeenCalledWith('agent-1', []);
      console.error = originalError;
    });
  });

  describe('resumeSession', () => {
    it('forwards to sessionManager.resumeSession with resolved agentSource', async () => {
      mockState.currentAgentSource = 'script';

      await handlers.handleMessage({
        command: 'resumeSession',
        data: { agentId: 'agent-1', sessionId: 'sess-1', isLiveMode: false }
      } as any);

      expect(mockSessionManager.resumeSession).toHaveBeenCalledWith(
        'agent-1',
        'script',
        'sess-1',
        false,
        mockWebviewView
      );
    });

    it('short-circuits when the requested session is already active for the same agent', async () => {
      mockState.isSessionActive = true;
      mockState.sessionId = 'sess-1';
      mockState.sessionAgentId = 'agent-1';
      mockState.currentAgentSource = 'script';

      await handlers.handleMessage({
        command: 'resumeSession',
        data: { agentId: 'agent-1', sessionId: 'sess-1' }
      } as any);

      expect(mockSessionManager.resumeSession).not.toHaveBeenCalled();
    });

    it('throws when sessionId is missing', async () => {
      await expect(
        handlers.handleMessage({
          command: 'resumeSession',
          data: { agentId: 'agent-1' }
        } as any)
      ).rejects.toThrow(/Invalid session ID/);
    });
  });
});
