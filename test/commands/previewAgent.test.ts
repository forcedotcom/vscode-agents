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

      const mockUri = { fsPath: '/tmp/preview.agent' } as vscodeTypes.Uri;
      await handler(mockUri);

      expect(errorMessageSpy).toHaveBeenCalledWith('Failed to get Agent Preview provider.');
    });

    it('preselects the agent and posts a message when provider is ready', async () => {
      jest.useFakeTimers();
      const showMock = jest.fn();
      const postMessageMock = jest.fn();
      const providerMock = {
        setAgentId: jest.fn(),
        webviewView: {
          show: showMock,
          webview: {
            postMessage: postMessageMock
          }
        }
      };

      jest.spyOn(AgentCombinedViewProvider, 'getInstance').mockReturnValue(providerMock as any);
      const handler = registerAndGetHandler();

      const mockUri = { fsPath: '/tmp/preview.agent' } as vscodeTypes.Uri;
      await handler(mockUri);

      expect(providerMock.setAgentId).toHaveBeenCalledWith('local:/tmp/preview.agent');
      expect(executeCommandSpy).toHaveBeenNthCalledWith(1, 'workbench.view.extension.agentforce-dx');
      expect(executeCommandSpy).toHaveBeenNthCalledWith(2, 'setContext', 'sf:project_opened', true);
      expect(showMock).toHaveBeenCalledWith(false);

      jest.advanceTimersByTime(500);
      expect(postMessageMock).toHaveBeenCalledWith({
        command: 'selectAgent',
        data: { agentId: 'local:/tmp/preview.agent' }
      });
    });

    it('logs errors to the channel service when preview fails', async () => {
      const providerMock = {
        setAgentId: jest.fn(),
        webviewView: undefined
      };

      jest.spyOn(AgentCombinedViewProvider, 'getInstance').mockReturnValue(providerMock as any);

      executeCommandSpy.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('unable to open view'));

      const handler = registerAndGetHandler();
      const mockUri = { fsPath: '/tmp/preview.agent' } as vscodeTypes.Uri;

      await handler(mockUri);

      expect(fakeChannelService.appendLine).toHaveBeenCalledWith('❌ Error previewing the .agent file.');
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith('Error Details:');
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('unable to open view'));
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith('Stack Trace:');
    });

    it('falls back to active editor when URI is not provided', async () => {
      jest.useFakeTimers();
      const showMock = jest.fn();
      const postMessageMock = jest.fn();
      const providerMock = {
        setAgentId: jest.fn(),
        webviewView: {
          show: showMock,
          webview: {
            postMessage: postMessageMock
          }
        }
      };

      jest.spyOn(AgentCombinedViewProvider, 'getInstance').mockReturnValue(providerMock as any);
      Object.defineProperty(vscode.window, 'activeTextEditor', {
        configurable: true,
        get: () => ({
          document: { fileName: '/tmp/from-editor.agent' }
        })
      });

      const handler = registerAndGetHandler();
      await handler();

      expect(providerMock.setAgentId).toHaveBeenCalledWith('local:/tmp/from-editor.agent');
      jest.advanceTimersByTime(500);
      expect(postMessageMock).toHaveBeenCalledWith({
        command: 'selectAgent',
        data: { agentId: 'local:/tmp/from-editor.agent' }
      });

      // Reset editor mock back to undefined to avoid side effects
      Object.defineProperty(vscode.window, 'activeTextEditor', {
        configurable: true,
        get: () => undefined
      });
    });

    it('handles provider without an attached webview gracefully', async () => {
      jest.useFakeTimers();
      const providerMock = {
        setAgentId: jest.fn(),
        webviewView: undefined
      };

      jest.spyOn(AgentCombinedViewProvider, 'getInstance').mockReturnValue(providerMock as any);
      const handler = registerAndGetHandler();
      const mockUri = { fsPath: '/tmp/preview.agent' } as vscodeTypes.Uri;

      await handler(mockUri);
      jest.runOnlyPendingTimers();

      expect(providerMock.setAgentId).toHaveBeenCalledWith('local:/tmp/preview.agent');
      expect(errorMessageSpy).not.toHaveBeenCalled();
    });
  });
});
