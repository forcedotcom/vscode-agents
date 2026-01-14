import * as vscode from 'vscode';
import { Commands } from '../../src/enums/commands';
import { Agent, type CompilationError } from '@salesforce/agents';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { SfProject, Lifecycle } from '@salesforce/core';
import { registerPublishAgentCommand } from '../../src/commands';

describe('publishAgent', () => {
  let commandSpy: jest.SpyInstance;
  let progressSpy: jest.SpyInstance;
  let progressReportSpy: jest.Mock;
  let errorMessageSpy: jest.SpyInstance;
  let infoMessageSpy: jest.SpyInstance;
  let readFileSpy: jest.SpyInstance;
  let agentInitSpy: jest.SpyInstance;
  let mockAgentInstance: any;
  let lifecycleMock: any;
  let lifecycleEmitHandlers: Map<string, Array<(data?: any) => Promise<void>>>;

  const fakeTelemetryInstance: any = {
    sendException: jest.fn(),
    sendCommandEvent: jest.fn()
  };

  const fakeChannelService: any = {
    showChannelOutput: jest.fn(),
    clear: jest.fn(),
    appendLine: jest.fn()
  };

  const fakeConnection: any = {
    instanceUrl: 'https://test.salesforce.com'
  };

  const fakeProject: any = {
    getPath: jest.fn(() => '/test/project')
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize lifecycle event handlers map
    lifecycleEmitHandlers = new Map();

    // Mock Lifecycle
    lifecycleMock = {
      on: jest.fn((eventName: string, handler: (data?: any) => Promise<void>) => {
        if (!lifecycleEmitHandlers.has(eventName)) {
          lifecycleEmitHandlers.set(eventName, []);
        }
        lifecycleEmitHandlers.get(eventName)!.push(handler);
      }),
      removeAllListeners: jest.fn((eventName: string) => {
        lifecycleEmitHandlers.delete(eventName);
      }),
      emit: jest.fn(async (eventName: string, data?: any) => {
        const handlers = lifecycleEmitHandlers.get(eventName) || [];
        for (const handler of handlers) {
          await handler(data);
        }
      })
    };

    jest.spyOn(Lifecycle, 'getInstance').mockReturnValue(lifecycleMock);

    // Mock CoreExtensionService
    jest.spyOn(CoreExtensionService, 'getTelemetryService').mockReturnValue(fakeTelemetryInstance);
    jest.spyOn(CoreExtensionService, 'getChannelService').mockReturnValue(fakeChannelService);
    jest.spyOn(CoreExtensionService, 'getDefaultConnection').mockResolvedValue(fakeConnection);

    // Mock SfProject
    jest.spyOn(SfProject, 'getInstance').mockReturnValue(fakeProject);

    // Mock vscode APIs
    commandSpy = jest.spyOn(vscode.commands, 'registerCommand');
    errorMessageSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockImplementation();
    infoMessageSpy = jest.spyOn(vscode.window, 'showInformationMessage').mockImplementation();

    progressReportSpy = jest.fn();
    progressSpy = jest.spyOn(vscode.window, 'withProgress').mockImplementation(async (_options, task) => {
      return await task({ report: progressReportSpy }, {} as vscode.CancellationToken);
    });

    readFileSpy = jest
      .spyOn(vscode.workspace.fs, 'readFile')
      .mockResolvedValue(new TextEncoder().encode('agent TestAgent { }'));

    // Mock activeTextEditor as undefined by default
    Object.defineProperty(vscode.window, 'activeTextEditor', {
      get: jest.fn(() => undefined),
      configurable: true
    });

    // Mock Uri.file to return a proper Uri-like object
    jest.spyOn(vscode.Uri, 'file').mockImplementation(
      (path: string) =>
        ({
          fsPath: path,
          scheme: 'file',
          path,
          authority: '',
          query: '',
          fragment: '',
          with: jest.fn(),
          toJSON: jest.fn(),
          toString: jest.fn(() => path)
        }) as any
    );

    // Mock Agent.init() to return an agent instance with compile() and publish() methods
    mockAgentInstance = {
      compile: jest.fn(),
      publish: jest.fn(),
      restoreConnection: jest.fn().mockResolvedValue(undefined)
    };
    agentInitSpy = jest.spyOn(Agent, 'init').mockResolvedValue(mockAgentInstance as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerPublishAgentCommand', () => {
    it('registers the command', () => {
      registerPublishAgentCommand();
      expect(commandSpy).toHaveBeenCalledWith(Commands.publishAgent, expect.any(Function));
    });

    it('shows error when no file is selected', async () => {
      registerPublishAgentCommand();
      await commandSpy.mock.calls[0][1](); // Call the command handler with no URI

      expect(errorMessageSpy).toHaveBeenCalledWith('No .agent file selected.');
      expect(progressSpy).not.toHaveBeenCalled();
      expect(fakeTelemetryInstance.sendCommandEvent).toHaveBeenCalledWith(Commands.publishAgent);
    });

    it('shows error when file is not a .agent file', async () => {
      const mockUri = vscode.Uri.file('/test/agent.txt');

      registerPublishAgentCommand();
      await commandSpy.mock.calls[0][1](mockUri);

      expect(errorMessageSpy).toHaveBeenCalledWith('You can use this command on only .agent files.');
      expect(progressSpy).not.toHaveBeenCalled();
    });

    it('publishes agent successfully with lifecycle events', async () => {
      // Mock successful compilation
      mockAgentInstance.compile.mockResolvedValue({
        status: 'success',
        errors: []
      });

      // Mock successful publish that triggers lifecycle events
      mockAgentInstance.publish.mockImplementation(async () => {
        await lifecycleMock.emit('scopedPreRetrieve');
        await lifecycleMock.emit('scopedPostRetrieve');
      });

      const mockUri = vscode.Uri.file('/test/TestAgent.agent');

      registerPublishAgentCommand();
      await commandSpy.mock.calls[0][1](mockUri);

      expect(agentInitSpy).toHaveBeenCalled();
      expect(mockAgentInstance.compile).toHaveBeenCalled();
      expect(mockAgentInstance.publish).toHaveBeenCalled();
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith('Publishing agent TestAgent...');
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith('Retrieving metadata from org...');
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith('Metadata retrieved successfully.');
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith('Successfully published agent TestAgent.');
      expect(infoMessageSpy).toHaveBeenCalledWith('Agent "TestAgent" was published successfully.');
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Initializing agent...', increment: 0 });
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Validating agent...', increment: 20 });
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Publishing agent...', increment: 50 });
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Retrieving metadata...', increment: 70 });
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Metadata retrieved successfully', increment: 90 });
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Agent published successfully.', increment: 100 });
      expect(lifecycleMock.removeAllListeners).toHaveBeenCalledWith('scopedPreRetrieve');
      expect(lifecycleMock.removeAllListeners).toHaveBeenCalledWith('scopedPostRetrieve');
      expect(fakeTelemetryInstance.sendCommandEvent).toHaveBeenCalledWith(Commands.publishAgent);
    });

    it('handles compilation failure', async () => {
      const mockDiagnostics: Array<Partial<CompilationError>> = [
        {
          lineStart: 2,
          lineEnd: 3,
          colStart: 5,
          colEnd: 10,
          description: 'Missing semicolon',
          errorType: 'ParserError'
        },
        {
          lineStart: 10,
          lineEnd: 10,
          colStart: 1,
          colEnd: 4,
          description: 'Unknown token',
          errorType: 'LexerError'
        }
      ];

      mockAgentInstance.compile.mockResolvedValue({
        status: 'failure',
        errors: mockDiagnostics
      });

      const mockUri = vscode.Uri.file('/test/failing.agent');

      registerPublishAgentCommand();
      await commandSpy.mock.calls[0][1](mockUri);

      expect(mockAgentInstance.compile).toHaveBeenCalled();
      expect(mockAgentInstance.publish).not.toHaveBeenCalled();
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith('❌ Agent validation failed!');
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('Found 2 error(s):'));
      expect(progressReportSpy).toHaveBeenCalledWith({
        message: 'Validation failed with 2 error(s).'
      });
      expect(errorMessageSpy).toHaveBeenCalledWith(
        'Agent validation failed with 2 error(s). Check the Output tab for details.'
      );
    });

    it('handles publish failure', async () => {
      // Mock successful compilation
      mockAgentInstance.compile.mockResolvedValue({
        status: 'success',
        errors: []
      });

      // Mock publish failure
      const publishError = new Error('Publish failed: Connection timeout');
      mockAgentInstance.publish.mockRejectedValue(publishError);

      const mockUri = vscode.Uri.file('/test/TestAgent.agent');

      registerPublishAgentCommand();
      await commandSpy.mock.calls[0][1](mockUri);

      expect(mockAgentInstance.compile).toHaveBeenCalled();
      expect(mockAgentInstance.publish).toHaveBeenCalled();
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith('❌ Agent publish failed!');
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Error: Publish failed: Connection timeout')
      );
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Failed' });
      expect(errorMessageSpy).toHaveBeenCalledWith('Failed to publish agent: Publish failed: Connection timeout');
      expect(fakeTelemetryInstance.sendException).toHaveBeenCalledWith(
        'agent_publish_failed',
        'Publish failed: Connection timeout'
      );
    });

    it('handles JWT access token error during retrieve step', async () => {
      // Mock successful compilation
      mockAgentInstance.compile.mockResolvedValue({
        status: 'success',
        errors: []
      });

      // Mock publish failure with JWT access token error (occurs during retrieve)
      const jwtError = new Error(
        'SOAP API does not support JWT-based access tokens. You must disable the "Issue JSON Web Token (JWT)-based access tokens" setting in your Connected App or External Client App'
      );
      mockAgentInstance.publish.mockRejectedValue(jwtError);

      const mockUri = vscode.Uri.file('/test/TestAgent.agent');

      registerPublishAgentCommand();
      await commandSpy.mock.calls[0][1](mockUri);

      expect(mockAgentInstance.compile).toHaveBeenCalled();
      expect(mockAgentInstance.publish).toHaveBeenCalled();
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith('❌ Agent publish failed!');
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('SOAP API does not support JWT-based access tokens')
      );
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('You must disable the "Issue JSON Web Token (JWT)-based access tokens"')
      );
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Failed' });
      expect(errorMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to publish agent: SOAP API does not support JWT-based access tokens')
      );
      expect(fakeTelemetryInstance.sendException).toHaveBeenCalledWith(
        'agent_publish_failed',
        expect.stringContaining('SOAP API does not support JWT-based access tokens')
      );
    });

    it('handles unexpected errors in outer catch', async () => {
      // Mock error that occurs before withProgress (e.g., SfProject.getInstance fails)
      jest.spyOn(SfProject, 'getInstance').mockImplementation(() => {
        throw new Error('Project initialization failed');
      });

      const mockUri = vscode.Uri.file('/test/TestAgent.agent');

      registerPublishAgentCommand();
      await commandSpy.mock.calls[0][1](mockUri);

      // The error message is wrapped in the outer catch block
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
        'Failed to publish agent: Project initialization failed'
      );
      expect(errorMessageSpy).toHaveBeenCalledWith('Failed to publish agent: Project initialization failed');
      expect(fakeTelemetryInstance.sendException).toHaveBeenCalledWith(
        'agent_publish_failed',
        'Failed to publish agent: Project initialization failed'
      );
    });

    it('cleans up lifecycle listeners even if publish fails', async () => {
      // Mock successful compilation
      mockAgentInstance.compile.mockResolvedValue({
        status: 'success',
        errors: []
      });

      // Mock publish failure
      mockAgentInstance.publish.mockRejectedValue(new Error('Publish failed'));

      const mockUri = vscode.Uri.file('/test/TestAgent.agent');

      registerPublishAgentCommand();
      await commandSpy.mock.calls[0][1](mockUri);

      // Verify listeners were cleaned up even after error
      expect(lifecycleMock.removeAllListeners).toHaveBeenCalledWith('scopedPreRetrieve');
      expect(lifecycleMock.removeAllListeners).toHaveBeenCalledWith('scopedPostRetrieve');
    });

    it('handles lifecycle events correctly', async () => {
      // Mock successful compilation and publish
      mockAgentInstance.compile.mockResolvedValue({
        status: 'success',
        errors: []
      });

      // Mock publish to trigger lifecycle events
      mockAgentInstance.publish.mockImplementation(async () => {
        await lifecycleMock.emit('scopedPreRetrieve');
        await lifecycleMock.emit('scopedPostRetrieve');
      });

      const mockUri = vscode.Uri.file('/test/TestAgent.agent');

      registerPublishAgentCommand();
      await commandSpy.mock.calls[0][1](mockUri);

      // Verify lifecycle events were registered
      expect(lifecycleMock.on).toHaveBeenCalledWith('scopedPreRetrieve', expect.any(Function));
      expect(lifecycleMock.on).toHaveBeenCalledWith('scopedPostRetrieve', expect.any(Function));

      // Verify progress updates from lifecycle events
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Retrieving metadata...', increment: 70 });
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Metadata retrieved successfully', increment: 90 });
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith('Retrieving metadata from org...');
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith('Metadata retrieved successfully.');
    });
  });
});
