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

import { AgentSource } from '@salesforce/agents';

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
  }
}));

// Mock @salesforce/core
jest.mock('@salesforce/core', () => ({
  SfProject: {
    getInstance: () => ({
      getPath: () => '/mock/project'
    })
  },
  SfError: Error
}));

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
            start: jest.fn().mockRejectedValue(new Error('Failed to compile agent script'))
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
        const sfError = new Error('Failed to compile agent script');
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
});
