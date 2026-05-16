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

import { AgentSource, createPreviewSessionCache } from '@salesforce/agents';

// Mock VS Code
jest.mock('vscode', () => ({
  commands: {
    executeCommand: jest.fn().mockResolvedValue(undefined)
  },
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  }
}));

// Mock @salesforce/agents
jest.mock('@salesforce/agents', () => ({
  AgentSource: {
    SCRIPT: 'script',
    PUBLISHED: 'published'
  },
  ScriptAgent: {
    init: jest.fn()
  },
  ProductionAgent: {
    init: jest.fn()
  },
  createPreviewSessionCache: jest.fn().mockResolvedValue(undefined)
}));

// Mock @salesforce/core. SfError is aliased to Error so `instanceof SfError`
// passes for plain Errors, matching pre-existing tests, while still exposing
// SfError.wrap which the resumeSession path uses.
jest.mock('@salesforce/core', () => {
  const SfErrorMock = Error as any;
  SfErrorMock.wrap = (err: unknown) => (err instanceof Error ? err : new Error(String(err)));
  return {
    SfProject: {
      getInstance: () => ({
        getPath: () => '/mock/project'
      })
    },
    SfError: SfErrorMock
  };
});

// Mock CoreExtensionService
jest.mock('../../src/services/coreExtensionService', () => ({
  CoreExtensionService: {
    getDefaultConnection: jest.fn().mockResolvedValue({
      instanceUrl: 'https://test.salesforce.com'
    }),
    getChannelService: jest.fn(() => ({
      appendLine: jest.fn(),
      showChannelOutput: jest.fn(),
      clear: jest.fn()
    }))
  }
}));

// Import after mocks
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { SessionManager } from '../../src/views/agentCombined/session/sessionManager';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockState: any;
  let mockMessageSender: any;
  let mockAgentInitializer: any;
  let mockHistoryManager: any;
  let mockChannelService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockState = {
      agentInstance: undefined,
      sessionId: '',
      currentAgentId: undefined,
      currentAgentSource: undefined,
      currentPlanId: undefined,
      currentUserMessage: undefined,
      isSessionActive: false,
      isSessionStarting: false,
      isLiveMode: false,
      pendingStartAgentId: undefined,
      pendingStartAgentSource: undefined,
      sessionStartOperationId: 1, // Match the return value of beginSessionStart
      setSessionActive: jest.fn().mockResolvedValue(undefined),
      setSessionStarting: jest.fn().mockResolvedValue(undefined),
      setResetAgentViewAvailable: jest.fn().mockResolvedValue(undefined),
      setSessionErrorState: jest.fn().mockResolvedValue(undefined),
      setConversationDataAvailable: jest.fn().mockResolvedValue(undefined),
      setLiveMode: jest.fn().mockResolvedValue(undefined),
      setAgentSelected: jest.fn().mockResolvedValue(undefined),
      beginSessionStart: jest.fn().mockReturnValue(1),
      isSessionStartActive: jest.fn().mockReturnValue(true),
      cancelPendingSessionStart: jest.fn(),
      clearSessionState: jest.fn()
    };

    mockMessageSender = {
      sendSessionStarting: jest.fn(),
      sendSessionStarted: jest.fn(),
      sendSessionEnded: jest.fn(),
      sendCompilationError: jest.fn(),
      sendError: jest.fn().mockResolvedValue(undefined),
      sendClearMessages: jest.fn(),
      sendLiveMode: jest.fn()
    };

    mockAgentInitializer = {
      initializeScriptAgent: jest.fn(),
      initializePublishedAgent: jest.fn()
    };

    mockHistoryManager = {
      loadAndSendTraceHistory: jest.fn().mockResolvedValue(undefined),
      loadAndSendConversationHistory: jest.fn().mockResolvedValue(true),
      showHistoryOrPlaceholder: jest.fn().mockResolvedValue(undefined)
    };

    mockChannelService = {
      appendLine: jest.fn(),
      showChannelOutput: jest.fn(),
      clear: jest.fn()
    };

    // Ensure getChannelService returns our mock so Logger gets a valid channelService
    jest.spyOn(CoreExtensionService, 'getChannelService').mockReturnValue(mockChannelService as any);

    sessionManager = new SessionManager(mockState, mockMessageSender, mockAgentInitializer, mockHistoryManager);
  });

  describe('error handling', () => {
    it('should set session error state when restart fails', async () => {
      // Setup: existing agent instance and session
      mockState.currentAgentId = 'TestAgent';
      mockState.currentAgentSource = AgentSource.SCRIPT;
      mockState.agentInstance = {
        preview: {
          start: jest.fn().mockRejectedValue(new Error('Session start failed'))
        }
      };
      mockState.sessionId = 'test-session-id';

      // Call restartSession
      await sessionManager.restartSession();

      // Verify error state was set via handleRestartError
      expect(mockState.setSessionErrorState).toHaveBeenCalledWith(true);
      expect(mockState.setResetAgentViewAvailable).toHaveBeenCalledWith(true);
      expect(mockMessageSender.sendError).toHaveBeenCalled();
    });

    it('should set session active to false when restart fails', async () => {
      mockState.currentAgentId = 'TestAgent';
      mockState.currentAgentSource = AgentSource.SCRIPT;
      mockState.agentInstance = {
        preview: {
          start: jest.fn().mockRejectedValue(new Error('Failed'))
        }
      };
      mockState.sessionId = 'test-session-id';

      await sessionManager.restartSession();

      expect(mockState.setSessionActive).toHaveBeenCalledWith(false);
    });
  });

  describe('endSession', () => {
    it('should cancel pending session start', async () => {
      await sessionManager.endSession();

      expect(mockState.cancelPendingSessionStart).toHaveBeenCalled();
    });

    it('should send session ended when session was starting', async () => {
      mockState.isSessionStarting = true;

      await sessionManager.endSession();

      expect(mockMessageSender.sendSessionEnded).toHaveBeenCalled();
    });

    it('marks the just-ended simulated session as previewable on sessionEnded', async () => {
      mockState.currentAgentId = 'agent-1';
      mockState.currentAgentSource = AgentSource.SCRIPT;
      mockState.sessionAgentId = 'agent-1';
      mockState.agentInstance = { restoreConnection: jest.fn().mockResolvedValue(undefined) };
      mockState.sessionId = 'session-just-finished';
      mockState.isSessionStarting = false;
      mockState.isLiveMode = false;

      await sessionManager.endSession();

      expect(mockState.previewedSessionId).toBe('session-just-finished');
      expect(mockMessageSender.sendSessionEnded).toHaveBeenCalledWith({
        sessionId: 'session-just-finished',
        sessionType: 'simulated'
      });
    });

    it('marks live-mode script sessions as live on sessionEnded', async () => {
      mockState.currentAgentId = 'agent-1';
      mockState.currentAgentSource = AgentSource.SCRIPT;
      mockState.sessionAgentId = 'agent-1';
      mockState.agentInstance = { restoreConnection: jest.fn().mockResolvedValue(undefined) };
      mockState.sessionId = 'session-just-finished';
      mockState.isSessionStarting = false;
      mockState.isLiveMode = true;

      await sessionManager.endSession();

      expect(mockMessageSender.sendSessionEnded).toHaveBeenCalledWith({
        sessionId: 'session-just-finished',
        sessionType: 'live'
      });
    });

    it('marks published agent sessions as published on sessionEnded', async () => {
      mockState.currentAgentId = 'agent-1';
      mockState.currentAgentSource = AgentSource.PUBLISHED;
      mockState.sessionAgentId = 'agent-1';
      mockState.agentInstance = { restoreConnection: jest.fn().mockResolvedValue(undefined) };
      mockState.sessionId = 'session-just-finished';
      mockState.isSessionStarting = false;

      await sessionManager.endSession();

      expect(mockMessageSender.sendSessionEnded).toHaveBeenCalledWith({
        sessionId: 'session-just-finished',
        sessionType: 'published'
      });
    });

    it('does not reload the chat after a normal stop (preview is in-place)', async () => {
      mockState.currentAgentId = 'agent-1';
      mockState.currentAgentSource = AgentSource.SCRIPT;
      mockState.sessionAgentId = 'agent-1';
      mockState.agentInstance = { restoreConnection: jest.fn().mockResolvedValue(undefined) };
      mockState.sessionId = 'session-just-finished';
      mockState.isSessionStarting = false;

      await sessionManager.endSession();

      expect(mockHistoryManager.showHistoryOrPlaceholder).not.toHaveBeenCalled();
    });

    it('sends sessionEnded without preview info when only a starting session is being cancelled', async () => {
      mockState.agentInstance = undefined;
      mockState.sessionId = undefined;
      mockState.isSessionStarting = true;

      await sessionManager.endSession();

      expect(mockMessageSender.sendSessionEnded).toHaveBeenCalledWith();
    });

    it('still calls restoreViewCallback when a starting session is cancelled', async () => {
      mockState.agentInstance = undefined;
      mockState.sessionId = undefined;
      mockState.isSessionStarting = true;

      const restoreView = jest.fn().mockResolvedValue(undefined);
      await sessionManager.endSession(restoreView);

      expect(restoreView).toHaveBeenCalled();
    });
  });

  describe('restartSession', () => {
    it('should do nothing if no agent instance exists', async () => {
      mockState.agentInstance = undefined;

      await sessionManager.restartSession();

      // Should not have called any state setters
      expect(mockState.setSessionActive).not.toHaveBeenCalled();
    });

    it('should do nothing if no session id exists', async () => {
      mockState.agentInstance = { preview: { start: jest.fn() } };
      mockState.sessionId = '';

      await sessionManager.restartSession();

      expect(mockState.setSessionActive).not.toHaveBeenCalled();
    });
  });

  describe('logging integration', () => {
    describe('session start logging', () => {
      beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup for successful session start
        mockState.currentAgentName = 'TestAgent';
        mockState.currentAgentId = 'test-agent-id';
        mockState.currentAgentSource = AgentSource.SCRIPT;
        mockState.sessionId = ''; // Will be set during session start
        mockState.sessionStartOperationId = 1; // Match the session start ID

        // Mock the agent instance that will be created by initializeScriptAgent
        const mockAgentInstance = {
          name: 'TestAgent', // Match the currentAgentName we set in the state
          preview: {
            start: jest.fn().mockResolvedValue({
              sessionId: 'test-session-123',
              messages: [{ type: 'Inform', message: 'Session started successfully' }]
            })
          }
        };

        // Mock initializeScriptAgent to set the agent instance
        mockAgentInitializer.initializeScriptAgent.mockResolvedValue(mockAgentInstance);
        mockState.agentInstance = mockAgentInstance;
      });

      it('should log live mode session start when starting session successfully', async () => {
        const mockWebview = {}; // Mock webview object
        await sessionManager.startSession('test-agent-id', AgentSource.SCRIPT, true, mockWebview);

        expect(mockChannelService.appendLine).toHaveBeenCalled();
        // Check for debug level logging
        expect(mockChannelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('[debug]'));
        expect(mockChannelService.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Live test session started for agent TestAgent. SessionId: test-session-123')
        );

        expect(jest.mocked(createPreviewSessionCache)).toHaveBeenCalledWith(
          mockState.agentInstance,
          expect.objectContaining({ sessionType: 'live' })
        );
      });

      it('should log simulation mode session start when starting session successfully', async () => {
        const mockWebview = {}; // Mock webview object
        await sessionManager.startSession('test-agent-id', AgentSource.SCRIPT, false, mockWebview);

        // Check that appendLine was called (logging happened)
        expect(mockChannelService.appendLine).toHaveBeenCalled();
        // Check for debug level logging
        expect(mockChannelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('[debug]'));
        expect(mockChannelService.appendLine).toHaveBeenCalledWith(
          expect.stringContaining('Simulation session started for agent TestAgent. SessionId: test-session-123')
        );

        expect(jest.mocked(createPreviewSessionCache)).toHaveBeenCalledWith(
          mockState.agentInstance,
          expect.objectContaining({ sessionType: 'simulated' })
        );
      });

      it('should call createPreviewSessionCache with published sessionType for a published agent', async () => {
        const publishedAgentId = '0Xx000000000001AAA'; // valid Bot ID: starts with 0X, 18 chars
        mockState.currentAgentSource = AgentSource.PUBLISHED;
        mockState.currentAgentName = 'PublishedAgent';

        const mockAgentInstance = {
          name: 'PublishedAgent',
          preview: {
            start: jest.fn().mockResolvedValue({
              sessionId: 'published-session-123',
              messages: []
            })
          }
        };
        mockAgentInitializer.initializePublishedAgent.mockResolvedValue(mockAgentInstance);
        mockState.agentInstance = mockAgentInstance;

        const mockWebview = {};
        await sessionManager.startSession(publishedAgentId, AgentSource.PUBLISHED, undefined, mockWebview);

        expect(jest.mocked(createPreviewSessionCache)).toHaveBeenCalledWith(
          mockState.agentInstance,
          expect.objectContaining({ sessionType: 'published' })
        );
      });

      it('should call createPreviewSessionCache during recompileAndRestartSession', async () => {
        mockState.currentAgentId = 'test-agent-id';
        mockState.currentAgentSource = AgentSource.SCRIPT;
        mockState.isLiveMode = false;
        mockState.currentAgentName = 'TestAgent';

        const mockAgentInstance = {
          name: 'TestAgent',
          preview: {
            start: jest.fn().mockResolvedValue({
              sessionId: 'recompiled-session-123',
              messages: []
            }),
            end: jest.fn().mockResolvedValue(undefined)
          },
          restoreConnection: jest.fn().mockResolvedValue(undefined)
        };
        mockState.agentInstance = mockAgentInstance;
        mockState.sessionId = 'old-session-id';
        mockAgentInitializer.initializeScriptAgent.mockResolvedValue(mockAgentInstance);

        await sessionManager.recompileAndRestartSession();

        expect(jest.mocked(createPreviewSessionCache)).toHaveBeenCalledWith(
          mockState.agentInstance,
          expect.objectContaining({ sessionType: 'simulated' })
        );
      });

      it('should not abort session start when createPreviewSessionCache throws', async () => {
        jest.mocked(createPreviewSessionCache).mockRejectedValueOnce(new Error('filesystem error'));

        const mockWebview = {};
        await sessionManager.startSession('test-agent-id', AgentSource.SCRIPT, true, mockWebview);

        expect(mockState.setSessionActive).toHaveBeenCalledWith(true);
        expect(mockMessageSender.sendSessionStarted).toHaveBeenCalled();
      });
    });

    describe('compilation error logging', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('should log compilation error when script session fails during compilation', async () => {
        // Setup error scenario
        mockState.currentAgentSource = AgentSource.SCRIPT;
        mockState.currentAgentName = 'TestAgent';
        mockState.sessionStartOperationId = 1; // Match the session start ID

        // Mock initializeScriptAgent to set up agent instance that will fail
        const mockAgentInstance = {
          name: 'TestAgent',
          preview: {
            start: jest.fn().mockRejectedValue(new Error('error compiling'))
          }
        };
        mockAgentInitializer.initializeScriptAgent.mockResolvedValue(mockAgentInstance);
        mockState.agentInstance = mockAgentInstance;

        const mockWebview = {}; // Mock webview object

        // Start session (error will be handled internally)
        await sessionManager.startSession('test-agent-id', AgentSource.SCRIPT, false, mockWebview);

        // Check that appendLine was called (error logging happened)
        expect(mockChannelService.appendLine).toHaveBeenCalled();
        // Check for error level logging
        expect(mockChannelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('[error]'));
      });

      it('should log SfError compilation error details', async () => {
        // Setup SfError scenario
        const sfError = new Error('error compiling');
        sfError.name = 'CompilationError';

        mockState.currentAgentSource = AgentSource.SCRIPT;
        mockState.currentAgentName = 'TestAgent';
        mockState.sessionStartOperationId = 1; // Match the session start ID
        // Mock initializeScriptAgent to set up agent instance that will fail with SfError
        const mockAgentInstance = {
          name: 'TestAgent',
          preview: {
            start: jest.fn().mockRejectedValue(sfError)
          }
        };
        mockAgentInitializer.initializeScriptAgent.mockResolvedValue(mockAgentInstance);
        mockState.agentInstance = mockAgentInstance;

        const mockWebview = {}; // Mock webview object

        // Start session (SfError will be handled internally)
        await sessionManager.startSession('test-agent-id', AgentSource.SCRIPT, false, mockWebview);

        // Check that appendLine was called (error logging happened)
        expect(mockChannelService.appendLine).toHaveBeenCalled();
        // Check for error level logging
        expect(mockChannelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('[error]'));
        expect(mockChannelService.appendLine).toHaveBeenCalledWith(expect.stringMatching(/^\tCompilationError$/));
      });
    });
  });

  describe('resumeSession', () => {
    const buildMockAgentInstance = (overrides: any = {}) => ({
      name: 'TestAgent',
      preview: {
        end: jest.fn().mockResolvedValue(undefined)
      },
      restoreConnection: jest.fn().mockResolvedValue(undefined),
      resumeSession: jest.fn().mockResolvedValue(undefined),
      ...overrides
    });

    beforeEach(() => {
      jest.clearAllMocks();
      mockState.currentAgentName = 'TestAgent';
      mockState.currentAgentId = 'test-agent-id';
      mockState.currentAgentSource = AgentSource.SCRIPT;
    });

    it('reattaches the agent to the supplied sessionId via SDK resumeSession', async () => {
      const instance = buildMockAgentInstance();
      mockAgentInitializer.initializeScriptAgent.mockImplementation(async () => {
        mockState.agentInstance = instance;
        return instance;
      });

      await sessionManager.resumeSession('test-agent-id', AgentSource.SCRIPT, 'sess-prior', false, {});

      expect(instance.resumeSession).toHaveBeenCalledWith('sess-prior');
      expect(mockState.sessionId).toBe('sess-prior');
      expect(mockState.sessionAgentId).toBe('test-agent-id');
    });

    it('sends sessionStarted with skipWelcome=true', async () => {
      const instance = buildMockAgentInstance();
      mockAgentInitializer.initializeScriptAgent.mockImplementation(async () => {
        mockState.agentInstance = instance;
        return instance;
      });

      await sessionManager.resumeSession('test-agent-id', AgentSource.SCRIPT, 'sess-prior', false, {});

      expect(mockMessageSender.sendSessionStarted).toHaveBeenCalledWith(undefined, 'sess-prior', true);
    });

    it('ends the previous SDK session before reinitializing', async () => {
      const previousInstance = buildMockAgentInstance();
      mockState.agentInstance = previousInstance;
      mockState.sessionId = 'sess-old';
      const newInstance = buildMockAgentInstance();
      mockAgentInitializer.initializeScriptAgent.mockImplementation(async () => {
        mockState.agentInstance = newInstance;
        return newInstance;
      });

      await sessionManager.resumeSession('test-agent-id', AgentSource.SCRIPT, 'sess-prior', false, {});

      expect(previousInstance.preview.end).toHaveBeenCalled();
      expect(mockState.clearSessionState).toHaveBeenCalled();
      expect(newInstance.resumeSession).toHaveBeenCalledWith('sess-prior');
    });

    it('surfaces resume errors via sendError and sets error state', async () => {
      const instance = buildMockAgentInstance({
        resumeSession: jest.fn().mockRejectedValue(new Error('disk read failed'))
      });
      mockAgentInitializer.initializeScriptAgent.mockImplementation(async () => {
        mockState.agentInstance = instance;
        return instance;
      });

      await sessionManager.resumeSession('test-agent-id', AgentSource.SCRIPT, 'sess-prior', false, {});

      expect(mockMessageSender.sendError).toHaveBeenCalledWith(expect.stringContaining('Failed to resume session'));
      expect(mockState.setResetAgentViewAvailable).toHaveBeenCalledWith(true);
      expect(mockState.setSessionErrorState).toHaveBeenCalledWith(true);
    });

    it('throws when no webview is provided', async () => {
      await expect(
        sessionManager.resumeSession('test-agent-id', AgentSource.SCRIPT, 'sess-prior', false, undefined as any)
      ).rejects.toThrow(/Webview is not ready/);
    });
  });
});
