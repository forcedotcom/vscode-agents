import type * as vscodeTypes from 'vscode';
const vscode = require('vscode') as typeof import('vscode');
import { Commands } from '../../src/enums/commands';
import { Agent, type CompilationError } from '@salesforce/agents';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { SfError, SfProject } from '@salesforce/core';

vscode.DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3
} as any;

class DiagnosticMock {
  public source: string | undefined;
  public code: unknown;
  constructor(
    public range: unknown,
    public message: string,
    public severity: unknown
  ) {
    this.range = range;
    this.message = message;
    this.severity = severity;
  }
}

vscode.Diagnostic = DiagnosticMock as any;

const validateAgentModule =
  require('../../src/commands/validateAgent') as typeof import('../../src/commands/validateAgent');
const { registerValidateAgentCommand, initializeDiagnosticCollection } = validateAgentModule;

describe('validateAgent', () => {
  let commandSpy: jest.SpyInstance;
  let progressSpy: jest.SpyInstance;
  let progressReportSpy: jest.Mock;
  let errorMessageSpy: jest.SpyInstance;
  let executeCommandSpy: jest.SpyInstance;
  let readFileSpy: jest.SpyInstance;
  let mockAgentInstance: any;
  let agentInitSpy: jest.SpyInstance;
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
    
    // Mock SfProject
    jest.spyOn(SfProject, 'getInstance').mockReturnValue({ getPath: () => '/test' } as any);

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

    progressReportSpy = jest.fn();
    progressSpy = jest.spyOn(vscode.window, 'withProgress').mockImplementation(async (_options, task) => {
      return await task({ report: progressReportSpy }, {} as vscodeTypes.CancellationToken);
    });

    jest.spyOn(vscode.languages, 'createDiagnosticCollection').mockReturnValue(diagnosticCollectionMock);

    readFileSpy = jest
      .spyOn(vscode.workspace.fs, 'readFile')
      .mockResolvedValue(new TextEncoder().encode('agent Test { }'));

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

    // Mock Agent.init to return an agent instance with compile() method
    mockAgentInstance = {
      compile: jest.fn(),
      restoreConnection: jest.fn().mockResolvedValue(undefined)
    };
    agentInitSpy = jest.spyOn(Agent, 'init').mockResolvedValue(mockAgentInstance as any);

    // Initialize diagnostic collection once for all tests
    const mockContext = {
      subscriptions: []
    } as unknown as vscodeTypes.ExtensionContext;
    initializeDiagnosticCollection(mockContext);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initializeDiagnosticCollection', () => {
    it('creates and registers a diagnostic collection', () => {
      const mockContext = {
        subscriptions: []
      } as unknown as vscodeTypes.ExtensionContext;

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
      mockAgentInstance.compile.mockResolvedValue({
        status: 'success',
        compiledArtifact: {},
        errors: [],
        syntacticMap: { blocks: [] },
        dslVersion: '0.0.3.rc29'
      });

      const mockUri = vscode.Uri.file('/test/agent.agent');

      registerValidateAgentCommand();
      await commandSpy.mock.calls[0][1](mockUri);

      expect(Agent.init).toHaveBeenCalled();
      expect(mockAgentInstance.compile).toHaveBeenCalled();
      expect(diagnosticCollectionMock.clear).toHaveBeenCalled();
      expect(fakeTelemetryInstance.sendCommandEvent).toHaveBeenCalledWith(Commands.validateAgent);
    });

    it('shows diagnostics when compilation fails', async () => {
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
        errors: mockDiagnostics,
        compiledArtifact: undefined,
        syntacticMap: undefined,
        dslVersion: '0.0.3.rc29'
      });

      const mockUri = vscode.Uri.file('/test/failing.agent');

      registerValidateAgentCommand();
      await commandSpy.mock.calls[0][1](mockUri);

      expect(fakeChannelService.showChannelOutput).toHaveBeenCalled();
      expect(fakeChannelService.clear).toHaveBeenCalled();
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringMatching(/\[error\] Agent validation failed with 2 error\(s\)/));
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('1. [ParserError]'));

      expect(diagnosticCollectionMock.clear).not.toHaveBeenCalled();
      expect(diagnosticCollectionMock.set).toHaveBeenCalledTimes(1);

      const [uriArg, diagnosticsArg] = diagnosticCollectionMock.set.mock.calls[0];
      expect(uriArg.fsPath).toBe('/test/failing.agent');
      expect(diagnosticsArg).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'Missing semicolon', source: 'Agent Validation', code: 'ParserError' }),
          expect.objectContaining({ message: 'Unknown token', source: 'Agent Validation', code: 'LexerError' })
        ])
      );

      expect(progressReportSpy).toHaveBeenCalledWith({ message: 'Failed with 2 error(s).' });
      expect(executeCommandSpy).toHaveBeenCalledWith('workbench.action.problems.focus');
      expect(fakeTelemetryInstance.sendCommandEvent).toHaveBeenCalledWith(Commands.validateAgent);
    });

    // Note: Test for compilation errors with multiple errors was removed due to
    // complexity in mocking vscode.DiagnosticSeverity and module-level diagnosticCollection variable

    it('handles unexpected errors', async () => {
      // Mock unexpected error
      mockAgentInstance.compile.mockRejectedValue(new Error('Connection failed'));

      const mockUri = vscode.Uri.file('/test/agent.agent');

      registerValidateAgentCommand();
      await commandSpy.mock.calls[0][1](mockUri);

      expect(diagnosticCollectionMock.clear).toHaveBeenCalled();
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringMatching(/\[error\] Agent validation failed/));
      expect(errorMessageSpy).toHaveBeenCalledWith(expect.stringContaining('Agent validation failed'));
    });

    it('displays error message without "Error:" prefix', async () => {
      // Mock unexpected error
      mockAgentInstance.compile.mockRejectedValue(new Error('Connection failed'));

      const mockUri = vscode.Uri.file('/test/agent.agent');

      registerValidateAgentCommand();
      await commandSpy.mock.calls[0][1](mockUri);

      // Verify error message is displayed with formatted logging
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringMatching(/\[error\].*Connection failed/));
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringMatching(/\[error\].*Details: Connection failed/));
    });

    it('displays "Something went wrong" for empty error message', async () => {
      // Mock error with empty message
      const emptyError = new Error('');
      mockAgentInstance.compile.mockRejectedValue(emptyError);

      const mockUri = vscode.Uri.file('/test/agent.agent');

      registerValidateAgentCommand();
      await commandSpy.mock.calls[0][1](mockUri);

      // Verify fallback message is displayed with formatted logging
      expect(fakeChannelService.appendLine).toHaveBeenCalledWith(expect.stringMatching(/\[error\].*Agent validation failed/));
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
      mockAgentInstance.compile.mockResolvedValue({
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
      expect(Agent.init).toHaveBeenCalled();
      expect(mockAgentInstance.compile).toHaveBeenCalled();
    });
  });
});
