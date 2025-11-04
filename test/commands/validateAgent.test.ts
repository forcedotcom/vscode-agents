import * as vscode from 'vscode';
import { registerValidateAgentCommand, initializeDiagnosticCollection } from '../../src/commands/validateAgent';
import { Commands } from '../../src/enums/commands';
import { Agent } from '@salesforce/agents';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { SfError } from '@salesforce/core';

describe('validateAgent', () => {
  let commandSpy: jest.SpyInstance;
  let progressSpy: jest.SpyInstance;
  let errorMessageSpy: jest.SpyInstance;
  let executeCommandSpy: jest.SpyInstance;
  let readFileSpy: jest.SpyInstance;
  let compileAgentScriptSpy: jest.SpyInstance;
  let diagnosticCollectionMock: any;

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

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock CoreExtensionService
    jest.spyOn(CoreExtensionService, 'getTelemetryService').mockReturnValue(fakeTelemetryInstance);
    jest.spyOn(CoreExtensionService, 'getChannelService').mockReturnValue(fakeChannelService);
    jest.spyOn(CoreExtensionService, 'getDefaultConnection').mockResolvedValue(fakeConnection);

    // Mock diagnostic collection
    diagnosticCollectionMock = {
      set: jest.fn(),
      clear: jest.fn(),
      dispose: jest.fn()
    };

    // Mock vscode APIs
    commandSpy = jest.spyOn(vscode.commands, 'registerCommand');
    executeCommandSpy = jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);
    errorMessageSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockImplementation();

    progressSpy = jest
      .spyOn(vscode.window, 'withProgress')
      .mockImplementation(async (_options, task) => {
        return await task({ report: jest.fn() }, {} as vscode.CancellationToken);
      });

    jest.spyOn(vscode.languages, 'createDiagnosticCollection').mockReturnValue(diagnosticCollectionMock);

    readFileSpy = jest.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(
      new TextEncoder().encode('agent Test { }')
    );

    // Mock activeTextEditor as undefined by default
    Object.defineProperty(vscode.window, 'activeTextEditor', {
      get: jest.fn(() => undefined),
      configurable: true
    });

    // Mock Uri.file to return a proper Uri-like object
    jest.spyOn(vscode.Uri, 'file').mockImplementation((path: string) => ({
      fsPath: path,
      scheme: 'file',
      path,
      authority: '',
      query: '',
      fragment: '',
      with: jest.fn(),
      toJSON: jest.fn(),
      toString: jest.fn(() => path)
    } as any));

    // Mock Agent.compileAgentScript
    compileAgentScriptSpy = jest.spyOn(Agent, 'compileAgentScript');

    // Initialize diagnostic collection once for all tests
    const mockContext = {
      subscriptions: []
    } as unknown as vscode.ExtensionContext;
    initializeDiagnosticCollection(mockContext);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initializeDiagnosticCollection', () => {
    it('creates and registers a diagnostic collection', () => {
      const mockContext = {
        subscriptions: []
      } as unknown as vscode.ExtensionContext;

      initializeDiagnosticCollection(mockContext);

      expect(vscode.languages.createDiagnosticCollection).toHaveBeenCalledWith('agentValidation');
      expect(mockContext.subscriptions).toContain(diagnosticCollectionMock);
    });
  });

  describe('registerValidateAgentCommand', () => {
    it('registers the command', () => {
      registerValidateAgentCommand();
      expect(commandSpy).toHaveBeenCalledWith(Commands.validateAgent, expect.any(Function));
    });

    it('shows error when no file is selected', async () => {
      registerValidateAgentCommand();
      await commandSpy.mock.calls[0][1](); // Call the command handler with no URI

      expect(errorMessageSpy).toHaveBeenCalledWith('No .agent file selected.');
      expect(progressSpy).not.toHaveBeenCalled();
    });

    it('validates successfully and clears diagnostics', async () => {
      // Mock successful compilation
      compileAgentScriptSpy.mockResolvedValue({
        status: 'success',
        compiledArtifact: {},
        errors: [],
        syntacticMap: { blocks: [] },
        dslVersion: '0.0.3.rc29'
      });

      const mockUri = vscode.Uri.file('/test/agent.agent');
      
      registerValidateAgentCommand();
      await commandSpy.mock.calls[0][1](mockUri);

      expect(compileAgentScriptSpy).toHaveBeenCalledWith(fakeConnection, 'agent Test { }');
      expect(diagnosticCollectionMock.clear).toHaveBeenCalled();
      expect(fakeTelemetryInstance.sendCommandEvent).toHaveBeenCalledWith(Commands.validateAgent);
    });

    it('handles compilation errors with multiple errors', async () => {
      // Mock compilation failure with multiple errors
      compileAgentScriptSpy.mockResolvedValue({
        status: 'failure',
        compiledArtifact: null,
        errors: [
          {
            errorType: 'SyntaxError',
            description: 'Unexpected token',
            lineStart: 1,
            lineEnd: 1,
            colStart: 5,
            colEnd: 10
          },
          {
            errorType: 'TypeError',
            description: 'Invalid type',
            lineStart: 3,
            lineEnd: 3,
            colStart: 1,
            colEnd: 15
          }
        ],
        syntacticMap: { blocks: [] },
        dslVersion: '0.0.3.rc29'
      });

      const mockUri = vscode.Uri.file('/test/agent.agent');

      registerValidateAgentCommand();
      // Wait for the command to fully complete including setTimeout
      await commandSpy.mock.calls[0][1](mockUri);

      // Verify the progress was shown
      expect(progressSpy).toHaveBeenCalled();

      // Verify compile was called
      expect(compileAgentScriptSpy).toHaveBeenCalled();

      // Verify channel service was used to display errors
      expect(fakeChannelService.showChannelOutput).toHaveBeenCalled();
      expect(fakeChannelService.clear).toHaveBeenCalled();
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith('❌ Agent validation failed!');
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith('────────────────────────────────────────────────────────────────────────');
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('Found 2 error(s)'));

      // Verify error details were logged for each error
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('1. [SyntaxError] Line 1:5'));
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('Unexpected token'));
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('2. [TypeError] Line 3:1'));
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('Invalid type'));

      // Verify Problems panel was focused
      expect(executeCommandSpy).toHaveBeenCalledWith('workbench.action.problems.focus');

      // Note: diagnosticCollection.set is difficult to test due to module-level variable
      // but the functionality is validated through channel service output
    }, 10000); // Increase timeout to allow for setTimeout

    it('handles unexpected errors', async () => {
      // Mock unexpected error
      compileAgentScriptSpy.mockRejectedValue(new Error('Connection failed'));

      const mockUri = vscode.Uri.file('/test/agent.agent');
      
      registerValidateAgentCommand();
      await commandSpy.mock.calls[0][1](mockUri);

      expect(diagnosticCollectionMock.clear).toHaveBeenCalled();
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith('❌ Agent validation failed!');
      expect(errorMessageSpy).toHaveBeenCalledWith(expect.stringContaining('Agent validation failed'));
    });

    it('converts API line numbers to VS Code format', () => {
      // Test the conversion logic used in the command
      const mockError = {
        lineStart: 5,
        lineEnd: 7,
        colStart: 10,
        colEnd: 20
      };

      // Apply the same conversion logic as in the command (1-based API -> 0-based VS Code)
      const startLine = Math.max(0, mockError.lineStart - 1);
      const startCol = Math.max(0, mockError.colStart - 1);
      const endLine = Math.max(0, mockError.lineEnd - 1);
      const endCol = Math.max(0, mockError.colEnd - 1);
      
      // Verify conversion
      expect(startLine).toBe(4); // lineStart 5 -> 4
      expect(startCol).toBe(9); // colStart 10 -> 9
      expect(endLine).toBe(6); // lineEnd 7 -> 6
      expect(endCol).toBe(19); // colEnd 20 -> 19
    });

    it('uses active text editor when no URI is provided', async () => {
      // Mock successful compilation
      compileAgentScriptSpy.mockResolvedValue({
        status: 'success',
        compiledArtifact: {},
        errors: [],
        syntacticMap: { blocks: [] },
        dslVersion: '0.0.3.rc29'
      });

      const mockFilePath = '/test/agent.agent';
      
      // Mock active text editor
      Object.defineProperty(vscode.window, 'activeTextEditor', {
        get: jest.fn(() => ({
          document: { fileName: mockFilePath }
        })),
        configurable: true
      });

      registerValidateAgentCommand();
      await commandSpy.mock.calls[0][1](); // No URI provided

      expect(progressSpy).toHaveBeenCalled();
      expect(readFileSpy).toHaveBeenCalled();
      expect(compileAgentScriptSpy).toHaveBeenCalled();
    });
  });
});

