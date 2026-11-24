import * as vscode from 'vscode';
import { Commands } from '../../src/enums/commands';
import { Agent, type CompilationError } from '@salesforce/agents';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { SfProject, Lifecycle, SfError } from '@salesforce/core';
import { registerPublishAgentCommand } from '../../src/commands';
import { formatPublishedAgentFailure, getErrorActions, getPublishedAgent, toSentence } from '../../src/commands/publishAgent';

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
      expect(fakeTelemetryInstance.sendCommandEvent).toHaveBeenCalledWith(
        Commands.publishAgent,
        expect.any(Array),
        { commandName: Commands.publishAgent }
      );
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
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[debug\].*Publishing agent TestAgent/)
      );
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[debug\].*Retrieving metadata from org/)
      );
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[debug\].*Metadata retrieved successfully/)
      );
      expect(infoMessageSpy).toHaveBeenCalledWith('Agent "TestAgent" was published successfully.');
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Initializing', increment: 0 });
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Validating', increment: 20 });
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Publishing', increment: 50 });
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Retrieving metadata', increment: 70 });
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Metadata retrieved', increment: 90 });
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Published successfully', increment: 100 });
      expect(lifecycleMock.removeAllListeners).toHaveBeenCalledWith('scopedPreRetrieve');
      expect(lifecycleMock.removeAllListeners).toHaveBeenCalledWith('scopedPostRetrieve');
      expect(fakeTelemetryInstance.sendCommandEvent).toHaveBeenCalledWith(
        Commands.publishAgent,
        expect.any(Array),
        { commandName: Commands.publishAgent }
      );
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
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[error\].*Agent validation failed with 2 error\(s\)/)
      );
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringMatching(/\t\d+\. \[ParserError\]/));
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringMatching(/\t\d+\. \[LexerError\]/));
      expect(progressReportSpy).toHaveBeenCalledWith({
        message: 'Validation failed with 2 error(s)'
      });
      expect(errorMessageSpy).toHaveBeenCalledWith(
        'Agent validation failed with 2 error(s). See the Problems panel for details.'
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
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[error\].*Agent publish failed/)
      );
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[error\].*Details: Publish failed: Connection timeout/)
      );
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Publish failed' });
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
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[error\].*Agent publish failed/)
      );
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[error\].*SOAP API does not support JWT-based access tokens/)
      );
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Publish failed' });
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
        expect.stringMatching(/\[error\].*Failed to publish agent: Project initialization failed/)
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
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Retrieving metadata', increment: 70 });
      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Metadata retrieved', increment: 90 });
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[debug\].*Retrieving metadata from org/)
      );
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
        expect.stringMatching(/\[debug\].*Metadata retrieved successfully/)
      );
    });

    describe('post-commit failures (SfError.actions and data.publishedAgent)', () => {
      const recoveryAction =
        "The agent was already published to the org as version 3 (BotVersion 0X9xx0000000003). Don't run the publish command again.";
      const publishedAgent = {
        developerName: 'TestAgent',
        botId: '0Xxxx0000000001',
        botVersionId: '0X9xx0000000003',
        versionNumber: 3,
        target: 'TestAgent.v3',
        failedStep: 'bundleDeploy'
      };

      const makePostCommitError = (): SfError => {
        const err = new SfError('Deploy failed: AiAuthoringBundle is invalid', 'AgentPublishError', [
          recoveryAction,
          'Check the bundle-meta.xml.'
        ]);
        err.setData({ publishedAgent });
        return err;
      };

      beforeEach(() => {
        mockAgentInstance.compile.mockResolvedValue({ status: 'success', errors: [] });
      });

      it('says the agent was published, warns against republishing, and logs the actions', async () => {
        mockAgentInstance.publish.mockRejectedValue(makePostCommitError());

        registerPublishAgentCommand();
        await commandSpy.mock.calls[0][1](vscode.Uri.file('/test/TestAgent.agent'));

        expect(errorMessageSpy).toHaveBeenCalledTimes(1);
        const [message, ...buttons] = errorMessageSpy.mock.calls[0];
        expect(message).toBe(
          'Agent "TestAgent" was published to the org as version 3 (BotVersion 0X9xx0000000003), but the authoring ' +
            "bundle deploy step failed: Deploy failed: AiAuthoringBundle is invalid. Don't publish again, because that " +
            'creates a duplicate version. See the Output panel for next steps.'
        );
        expect(message).not.toMatch(/^Failed to publish agent/);
        // No retry/republish button is offered.
        expect(buttons).toHaveLength(0);

        expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringMatching(/\[error\].*Next steps:/));
        expect(fakeChannelService.appendLine).toHaveBeenCalledWith(`\t1. ${recoveryAction}`);
        expect(fakeChannelService.appendLine).toHaveBeenCalledWith('\t2. Check the bundle-meta.xml.');
        expect(fakeChannelService.showChannelOutput).toHaveBeenCalled();
        expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Published, but a later step failed' });
        expect(progressReportSpy).not.toHaveBeenCalledWith({ message: 'Publish failed' });
        expect(infoMessageSpy).not.toHaveBeenCalled();
        expect(fakeTelemetryInstance.sendException).toHaveBeenCalledWith(
          'agent_publish_post_commit_failed',
          'Deploy failed: AiAuthoringBundle is invalid'
        );
      });

      it('points to the Output panel when a plain failure carries actions', async () => {
        mockAgentInstance.publish.mockRejectedValue(
          new SfError('Unauthorized', 'AuthError', ['Re-authorize the org with "sf org login web".'])
        );

        registerPublishAgentCommand();
        await commandSpy.mock.calls[0][1](vscode.Uri.file('/test/TestAgent.agent'));

        expect(errorMessageSpy).toHaveBeenCalledWith(
          'Failed to publish agent: Unauthorized. See the Output panel for next steps.'
        );
        expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
          '\t1. Re-authorize the org with "sf org login web".'
        );
        expect(fakeChannelService.showChannelOutput).not.toHaveBeenCalled();
        expect(fakeTelemetryInstance.sendException).toHaveBeenCalledWith('agent_publish_failed', 'Unauthorized');
      });

      it('does not log a Next steps block when the error has no actions', async () => {
        mockAgentInstance.publish.mockRejectedValue(new Error('boom'));

        registerPublishAgentCommand();
        await commandSpy.mock.calls[0][1](vscode.Uri.file('/test/TestAgent.agent'));

        expect(fakeChannelService.appendLine).not.toHaveBeenCalledWith(expect.stringMatching(/Next steps:/));
        expect(errorMessageSpy).toHaveBeenCalledWith('Failed to publish agent: boom');
      });
    });
  });

  describe('publish error helpers', () => {
    it('getPublishedAgent reads data.publishedAgent from the wrapped or original error', () => {
      const err = new SfError('x');
      err.setData({ publishedAgent: { developerName: 'A', botId: 'b', botVersionId: 'v' } });
      expect(getPublishedAgent(err, err)?.botVersionId).toBe('v');

      // Original is a plain error-like object, wrapped error lost the data.
      const original = {
        message: 'x',
        data: { publishedAgent: { developerName: 'A', botId: 'b', botVersionId: 'w' } }
      };
      expect(getPublishedAgent(original, new SfError('x'))?.botVersionId).toBe('w');
    });

    it('getPublishedAgent ignores missing or malformed data', () => {
      const noData = new SfError('x');
      expect(getPublishedAgent(noData, noData)).toBeUndefined();
      const otherData = new SfError('x');
      otherData.setData({ publishedAgent: { developerName: 'A' } });
      expect(getPublishedAgent(otherData, otherData)).toBeUndefined();
      const arrayData = new SfError('x');
      arrayData.setData(['publishedAgent']);
      expect(getPublishedAgent(arrayData, arrayData)).toBeUndefined();
    });

    it('getErrorActions returns string actions and falls back to the original error', () => {
      const withActions = new SfError('x', 'E', ['do this', '  ']);
      expect(getErrorActions(withActions, withActions)).toEqual(['do this']);
      expect(getErrorActions({ actions: ['from original'] }, new SfError('x'))).toEqual(['from original']);
      expect(getErrorActions(new Error('x'), new SfError('x'))).toEqual([]);
    });

    it('toSentence adds a period only when the text lacks sentence punctuation', () => {
      expect(toSentence('Unauthorized')).toBe('Unauthorized.');
      expect(toSentence('Deploy failed.  ')).toBe('Deploy failed.');
      expect(toSentence('Really?')).toBe('Really?');
    });

    it('formatPublishedAgentFailure handles a failed version lookup (no version number or step label)', () => {
      expect(
        formatPublishedAgentFailure('A', { developerName: 'A', botId: 'b', botVersionId: '0X9' }, 'Lookup failed.')
      ).toBe(
        'Agent "A" was published to the org as BotVersion 0X9, but a later step failed: Lookup failed. ' +
          "Don't publish again, because that creates a duplicate version. See the Output panel for next steps."
      );
      expect(
        formatPublishedAgentFailure(
          'A',
          { developerName: 'A', botId: 'b', botVersionId: '0X9', failedStep: 'botVersionLookup' },
          'Lookup failed.'
        )
      ).toContain('but the version lookup step failed');
    });
  });
});
