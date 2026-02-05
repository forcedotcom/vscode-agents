import type * as vscodeTypes from 'vscode';
const vscode = require('vscode') as typeof import('vscode');
import { Commands } from '../../src/enums/commands';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { AgentCombinedViewProvider } from '../../src/views/agentCombinedViewProvider';

const previewAgentModule =
  require('../../src/commands/previewAgent') as typeof import('../../src/commands/previewAgent');
const { registerPreviewAgentCommand } = previewAgentModule;

describe('previewAgent', () => {
  let commandSpy: jest.SpyInstance;
  let errorMessageSpy: jest.SpyInstance;
  let executeCommandSpy: jest.SpyInstance;

  const fakeTelemetryInstance: any = {
    sendException: jest.fn(),
    sendCommandEvent: jest.fn()
  };

  const fakeChannelService: any = {
    showChannelOutput: jest.fn(),
    clear: jest.fn(),
    appendLine: jest.fn()
  };

  const registerAndGetHandler = () => {
    registerPreviewAgentCommand();
    expect(commandSpy).toHaveBeenCalledWith(Commands.previewAgent, expect.any(Function));
    return commandSpy.mock.calls[0][1] as (uri?: vscodeTypes.Uri) => Promise<void>;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock CoreExtensionService
    jest.spyOn(CoreExtensionService, 'getTelemetryService').mockReturnValue(fakeTelemetryInstance);
    jest.spyOn(CoreExtensionService, 'getChannelService').mockReturnValue(fakeChannelService);

    // Mock vscode APIs
    commandSpy = jest.spyOn(vscode.commands, 'registerCommand');
    executeCommandSpy = jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    errorMessageSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockImplementation();

    Object.defineProperty(vscode.window, 'activeTextEditor', {
      configurable: true,
      get: jest.fn(() => undefined)
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('registerPreviewAgentCommand', () => {
    it('registers the command', () => {
      registerPreviewAgentCommand();
      expect(commandSpy).toHaveBeenCalledWith(Commands.previewAgent, expect.any(Function));
    });

    it('shows an error when no file is selected', async () => {
      const handler = registerAndGetHandler();

      await handler();

      expect(errorMessageSpy).toHaveBeenCalledWith('No .agent file selected.');
      expect(fakeChannelService.appendLine).not.toHaveBeenCalled();
    });

    it('shows an error when the preview provider is missing', async () => {
      jest.spyOn(AgentCombinedViewProvider, 'getInstance').mockReturnValue(undefined as any);
      const handler = registerAndGetHandler();

      // Use realistic path: /project/agents/AgentName/AgentName.agent
      const mockUri = { fsPath: '/project/agents/TestAgent/TestAgent.agent' } as vscodeTypes.Uri;
      await handler(mockUri);

      expect(errorMessageSpy).toHaveBeenCalledWith('Failed to get Agent Preview provider.');
    });

    it('preselects the agent and posts a message when provider is ready', async () => {
      jest.useFakeTimers();
      const showMock = jest.fn();
      const postMessageMock = jest.fn();
      const startPreviewSessionMock = jest.fn().mockResolvedValue(undefined);
      const providerMock = {
        setAgentId: jest.fn(),
        startPreviewSession: startPreviewSessionMock,
        webviewView: {
          show: showMock,
          webview: {
            postMessage: postMessageMock,
            html: '<html></html>' // Simulate webview being ready
          }
        }
      };

      jest.spyOn(AgentCombinedViewProvider, 'getInstance').mockReturnValue(providerMock as any);
      
      // Mock Agent.listPreviewable and SfProject
      const { Agent } = require('@salesforce/agents');
      const { SfProject } = require('@salesforce/core');
      Agent.listPreviewable = jest.fn().mockResolvedValue([]);
      SfProject.getInstance = jest.fn().mockReturnValue({ getPath: () => '/test' });
      jest.spyOn(CoreExtensionService, 'getDefaultConnection').mockResolvedValue({} as any);

      const handler = registerAndGetHandler();

      // Use realistic path: /project/agents/AgentName/AgentName.agent
      // The aabName (bundle name) is extracted as the parent directory: "TestAgent"
      const mockUri = { fsPath: '/project/agents/TestAgent/TestAgent.agent' } as vscodeTypes.Uri;
      const handlerPromise = handler(mockUri);

      // Advance timers to allow webview ready check
      jest.advanceTimersByTime(500);
      await handlerPromise;

      // Agent ID should be the aabName (parent directory name), not the full path
      expect(providerMock.setAgentId).toHaveBeenCalledWith('TestAgent');
      expect(executeCommandSpy).toHaveBeenNthCalledWith(1, 'workbench.view.extension.agentforce-dx');
      expect(executeCommandSpy).toHaveBeenNthCalledWith(2, 'setContext', 'sf:project_opened', true);
      expect(showMock).toHaveBeenCalledWith(false);

      expect(postMessageMock).toHaveBeenCalledWith({
        command: 'selectAgent',
        data: { agentId: 'TestAgent', agentSource: 'script' }
      });
      // Session should NOT start automatically - user clicks play to start
      expect(startPreviewSessionMock).not.toHaveBeenCalled();
    });

    it('logs errors to the channel service when preview fails', async () => {
      const providerMock = {
        setAgentId: jest.fn(),
        webviewView: undefined
      };

      jest.spyOn(AgentCombinedViewProvider, 'getInstance').mockReturnValue(providerMock as any);

      // Mock Agent.listPreviewable and SfProject to avoid console.warn
      const { Agent } = require('@salesforce/agents');
      const { SfProject } = require('@salesforce/core');
      Agent.listPreviewable = jest.fn().mockResolvedValue([]);
      SfProject.getInstance = jest.fn().mockReturnValue({ getPath: () => '/test' });
      jest.spyOn(CoreExtensionService, 'getDefaultConnection').mockResolvedValue({} as any);

      executeCommandSpy.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('unable to open view'));

      const handler = registerAndGetHandler();
      // Use realistic path
      const mockUri = { fsPath: '/project/agents/TestAgent/TestAgent.agent' } as vscodeTypes.Uri;

      await handler(mockUri);

      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringMatching(/\[error\].*Error previewing the \.agent file/));
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringMatching(/\[error\].*Details: unable to open view/));
    });

    it('falls back to active editor when URI is not provided', async () => {
      jest.useFakeTimers();
      const showMock = jest.fn();
      const postMessageMock = jest.fn();
      const startPreviewSessionMock = jest.fn().mockResolvedValue(undefined);
      const providerMock = {
        setAgentId: jest.fn(),
        startPreviewSession: startPreviewSessionMock,
        webviewView: {
          show: showMock,
          webview: {
            postMessage: postMessageMock,
            html: '<html></html>' // Simulate webview being ready
          }
        }
      };

      jest.spyOn(AgentCombinedViewProvider, 'getInstance').mockReturnValue(providerMock as any);
      
      // Mock Agent.listPreviewable and SfProject
      const { Agent } = require('@salesforce/agents');
      const { SfProject } = require('@salesforce/core');
      Agent.listPreviewable = jest.fn().mockResolvedValue([]);
      SfProject.getInstance = jest.fn().mockReturnValue({ getPath: () => '/test' });
      jest.spyOn(CoreExtensionService, 'getDefaultConnection').mockResolvedValue({} as any);
      
      // Use realistic path: /project/agents/AgentName/AgentName.agent
      Object.defineProperty(vscode.window, 'activeTextEditor', {
        configurable: true,
        get: () => ({
          document: { fileName: '/project/agents/EditorAgent/EditorAgent.agent' }
        })
      });

      const handler = registerAndGetHandler();
      const handlerPromise = handler();

      jest.advanceTimersByTime(500);
      await handlerPromise;

      // Agent ID should be the aabName (parent directory name), not the full path
      expect(providerMock.setAgentId).toHaveBeenCalledWith('EditorAgent');
      expect(postMessageMock).toHaveBeenCalledWith({
        command: 'selectAgent',
        data: { agentId: 'EditorAgent', agentSource: 'script' }
      });
      // Session should NOT start automatically - user clicks play to start
      expect(startPreviewSessionMock).not.toHaveBeenCalled();

      // Reset editor mock back to undefined to avoid side effects
      Object.defineProperty(vscode.window, 'activeTextEditor', {
        configurable: true,
        get: () => undefined
      });
    });

    it('uses agent ID from listPreviewable when agent is found', async () => {
      jest.useFakeTimers();
      const showMock = jest.fn();
      const postMessageMock = jest.fn();
      const startPreviewSessionMock = jest.fn().mockResolvedValue(undefined);
      const providerMock = {
        setAgentId: jest.fn(),
        startPreviewSession: startPreviewSessionMock,
        webviewView: {
          show: showMock,
          webview: {
            postMessage: postMessageMock,
            html: '<html></html>'
          }
        }
      };

      jest.spyOn(AgentCombinedViewProvider, 'getInstance').mockReturnValue(providerMock as any);

      // Mock Agent.listPreviewable to return an agent matching the aabName
      const { Agent, AgentSource } = require('@salesforce/agents');
      const { SfProject } = require('@salesforce/core');
      Agent.listPreviewable = jest.fn().mockResolvedValue([
        {
          name: 'My Test Agent',
          id: 'custom-agent-id', // This ID should be used instead of aabName
          aabName: 'TestAgent',
          source: AgentSource.SCRIPT
        }
      ]);
      SfProject.getInstance = jest.fn().mockReturnValue({ getPath: () => '/test' });
      jest.spyOn(CoreExtensionService, 'getDefaultConnection').mockResolvedValue({} as any);

      const handler = registerAndGetHandler();

      const mockUri = { fsPath: '/project/agents/TestAgent/TestAgent.agent' } as vscodeTypes.Uri;
      const handlerPromise = handler(mockUri);

      jest.advanceTimersByTime(500);
      await handlerPromise;

      // Agent ID should come from the matched agent's id field, not aabName
      expect(providerMock.setAgentId).toHaveBeenCalledWith('custom-agent-id');
      expect(postMessageMock).toHaveBeenCalledWith({
        command: 'selectAgent',
        data: { agentId: 'custom-agent-id', agentSource: 'script' }
      });
      expect(startPreviewSessionMock).not.toHaveBeenCalled();
    });

  });
});
