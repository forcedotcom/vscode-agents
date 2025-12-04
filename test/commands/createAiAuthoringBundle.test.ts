import * as vscode from 'vscode';
import * as path from 'path';
import { registerCreateAiAuthoringBundleCommand } from '../../src/commands/createAiAuthoringBundle';
import { Commands } from '../../src/enums/commands';
import { Agent } from '@salesforce/agents';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { SfProject, generateApiName } from '@salesforce/core';

// Mock generateApiName
jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  generateApiName: jest.fn((name: string) => name.replace(/\s+/g, '')),
  SfProject: {
    getInstance: jest.fn()
  }
}));

describe('createAiAuthoringBundle', () => {
  let commandSpy: jest.SpyInstance;
  let showInputBoxSpy: jest.SpyInstance;
  let showQuickPickSpy: jest.SpyInstance;
  let showErrorMessageSpy: jest.SpyInstance;
  let createDirectorySpy: jest.SpyInstance;
  let readDirectorySpy: jest.SpyInstance;
  let readFileSpy: jest.SpyInstance;
  let createAgentScriptSpy: jest.SpyInstance;

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

  let mockProject: any;

  const createMockProject = () => ({
    getPath: jest.fn().mockReturnValue('/test/project'),
    getDefaultPackage: jest.fn().mockReturnValue({
      fullPath: '/test/project/force-app'
    })
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock setTimeout to execute immediately
    jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
      callback();
      return 0 as any;
    });

    // Mock CoreExtensionService
    jest.spyOn(CoreExtensionService, 'getTelemetryService').mockReturnValue(fakeTelemetryInstance);
    jest.spyOn(CoreExtensionService, 'getChannelService').mockReturnValue(fakeChannelService);
    jest.spyOn(CoreExtensionService, 'getDefaultConnection').mockResolvedValue(fakeConnection);

    // Create a new mock project for each test
    mockProject = createMockProject();

    // Mock SfProject
    (SfProject.getInstance as jest.Mock).mockResolvedValue(mockProject);

    // Mock vscode APIs
    commandSpy = jest.spyOn(vscode.commands, 'registerCommand');
    showInputBoxSpy = jest.spyOn(vscode.window, 'showInputBox');
    showQuickPickSpy = jest.spyOn(vscode.window, 'showQuickPick');
    jest.spyOn(vscode.window, 'showInformationMessage').mockImplementation();
    showErrorMessageSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockImplementation();

    jest.spyOn(vscode.window, 'withProgress').mockImplementation(async (_options, task) => {
      return await task({ report: jest.fn() }, {} as vscode.CancellationToken);
    });

    // Mock file system operations
    createDirectorySpy = jest.spyOn(vscode.workspace.fs, 'createDirectory').mockResolvedValue(undefined);
    jest.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue(undefined);
    readDirectorySpy = jest.spyOn(vscode.workspace.fs, 'readDirectory');
    readFileSpy = jest.spyOn(vscode.workspace.fs, 'readFile');

    // Mock Uri.file
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

    // Mock Agent.createAgentScript
    createAgentScriptSpy = jest.spyOn(Agent, 'createAuthoringBundle');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers the command', () => {
    registerCreateAiAuthoringBundleCommand();
    expect(commandSpy).toHaveBeenCalledWith(Commands.createAiAuthoringBundle, expect.any(Function));
  });

  it('creates bundle successfully with valid inputs', async () => {
    // Mock user inputs
    showInputBoxSpy.mockResolvedValue('My Test Agent');

    // Mock spec files
    readDirectorySpy.mockResolvedValue([
      ['test-spec.yaml', vscode.FileType.File],
      ['another-spec.yml', vscode.FileType.File]
    ]);

    showQuickPickSpy.mockResolvedValue('test-spec.yaml');

    // Mock spec file content
    const specContent = 'agentType: customer\nrole: Test Role';
    readFileSpy.mockResolvedValue(new TextEncoder().encode(specContent));

    // Mock agent script generation
    createAgentScriptSpy.mockResolvedValue('agent MyTestAgent { }');

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify telemetry
    expect(fakeTelemetryInstance.sendCommandEvent).toHaveBeenCalledWith(Commands.createAiAuthoringBundle);

    // Verify agent script was created
    expect(createAgentScriptSpy).toHaveBeenCalled();
  });

  it('cancels when user cancels name input', async () => {
    showInputBoxSpy.mockResolvedValue(undefined);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    expect(createAgentScriptSpy).not.toHaveBeenCalled();
  });

  it('shows error when no spec files found', async () => {
    showInputBoxSpy.mockResolvedValue('My Test Agent');
    readDirectorySpy.mockResolvedValue([]); // No spec files

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    expect(showErrorMessageSpy).toHaveBeenCalledWith(expect.stringContaining('No agent spec YAML files found'));
  });

  it('cancels when user cancels spec selection', async () => {
    showInputBoxSpy.mockResolvedValue('My Test Agent');
    readDirectorySpy.mockResolvedValue([['test-spec.yaml', vscode.FileType.File]]);
    showQuickPickSpy.mockResolvedValue(undefined); // User cancelled

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    expect(createAgentScriptSpy).not.toHaveBeenCalled();
  });

  it('filters only YAML files from specs directory', async () => {
    showInputBoxSpy.mockResolvedValue('My Test Agent');

    readDirectorySpy.mockResolvedValue([
      ['test-spec.yaml', vscode.FileType.File],
      ['another-spec.yml', vscode.FileType.File],
      ['not-spec.json', vscode.FileType.File], // Should be filtered out
      ['readme.md', vscode.FileType.File], // Should be filtered out
      ['subdir', vscode.FileType.Directory] // Should be filtered out
    ]);

    showQuickPickSpy.mockResolvedValue('test-spec.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));
    createAgentScriptSpy.mockResolvedValue('agent MyTestAgent { }');

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify only YAML files were shown
    expect(showQuickPickSpy).toHaveBeenCalledWith(['test-spec.yaml', 'another-spec.yml'], expect.any(Object));
  });

  it('generates correct API name from regular name', async () => {
    showInputBoxSpy.mockResolvedValue('My Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy.mockResolvedValue('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));
    createAgentScriptSpy.mockResolvedValue('agent MyTestAgent { }');

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify generateApiName was called
    expect(generateApiName).toHaveBeenCalledWith('My Test Agent');
  });

  it('creates bundle in correct directory structure', async () => {
    showInputBoxSpy.mockResolvedValue('Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy.mockResolvedValue('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));
    createAgentScriptSpy.mockResolvedValue('agent TestAgent { }');

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify directory was created
    expect(createDirectorySpy).toHaveBeenCalled();
  });

  it('handles agent script generation errors gracefully', async () => {
    showInputBoxSpy.mockResolvedValue('Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy.mockResolvedValue('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));

    // Mock createAgentScript to throw error
    createAgentScriptSpy.mockRejectedValue(new Error('API Error'));

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify error was shown
    expect(showErrorMessageSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to generate authoring bundle'));
  });

  it('displays error message without "Error:" prefix in output channel', async () => {
    showInputBoxSpy.mockResolvedValue('Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy.mockResolvedValue('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));

    // Mock createAgentScript to throw error
    createAgentScriptSpy.mockRejectedValue(new Error('API connection timeout'));

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify error message is displayed without "Error:" prefix
    expect(fakeChannelService.appendLine).toHaveBeenCalledWith('API connection timeout');
    expect(fakeChannelService.appendLine).not.toHaveBeenCalledWith(
      expect.stringContaining('Error: API connection timeout')
    );
  });

  it('displays "Something went wrong" for empty error message in output channel', async () => {
    showInputBoxSpy.mockResolvedValue('Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy.mockResolvedValue('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));

    // Mock createAgentScript to throw error with empty message
    const emptyError = new Error('');
    createAgentScriptSpy.mockRejectedValue(emptyError);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify fallback message is displayed
    expect(fakeChannelService.appendLine).toHaveBeenCalledWith('Something went wrong');
  });

  it('validates bundle name is not empty', async () => {
    let validator: any;
    showInputBoxSpy.mockImplementation(async options => {
      validator = options?.validateInput;
      return undefined;
    });

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Test the validation function
    expect(validator('')).toBeTruthy();
    expect(validator('   ')).toBeTruthy();
    expect(validator('Valid Name')).toBeNull();
  });

  it('uses provided URI when command invoked from context menu', async () => {
    const contextUri = vscode.Uri.file(path.join('custom', 'path', 'aiAuthoringBundles'));

    showInputBoxSpy.mockResolvedValue('Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy.mockResolvedValue('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));
    createAgentScriptSpy.mockResolvedValue('agent TestAgent { }');

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler(contextUri);

    // Verify command executed successfully
    expect(createAgentScriptSpy).toHaveBeenCalled();
  });

  it('calls createDirectory to create bundle structure', async () => {
    showInputBoxSpy.mockResolvedValue('My Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy.mockResolvedValue('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));
    createAgentScriptSpy.mockResolvedValue('agent MyTestAgent { }');

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];

    // Handle the command execution - it will fail at openTextDocument but that's ok
    try {
      await handler();
    } catch (error) {
      // Expected to fail at openTextDocument/showTextDocument
    }

    // Verify bundle directory was created
    expect(createDirectorySpy).toHaveBeenCalled();
    expect(createAgentScriptSpy).toHaveBeenCalled();
  });

  it('passes spec data with name and developerName to createAgentScript', async () => {
    showInputBoxSpy.mockResolvedValue('Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy.mockResolvedValue('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer\nrole: TestRole'));
    createAgentScriptSpy.mockResolvedValue('agent TestAgent { }');

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify createAgentScript was called
    expect(createAgentScriptSpy).toHaveBeenCalledWith(
      fakeConnection,
      expect.objectContaining({
        name: 'Test Agent',
        agentType: 'customer',
        role: 'TestRole'
      })
    );

    // Verify generateApiName was called with the name
    expect(generateApiName).toHaveBeenCalledWith('Test Agent');
  });

  it('handles specs directory not found error', async () => {
    showInputBoxSpy.mockResolvedValue('Test Agent');
    // Mock readDirectory to throw error (directory not found)
    readDirectorySpy.mockRejectedValue(new Error('Directory not found'));

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Should show error about no spec files
    expect(showErrorMessageSpy).toHaveBeenCalledWith(expect.stringContaining('No agent spec YAML files found'));
    // Should log the error
    expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('No agent spec directory found')
    );
  });

  it('handles null agent script from createAgentScript', async () => {
    showInputBoxSpy.mockResolvedValue('Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy.mockResolvedValue('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));

    // Mock createAgentScript to return null
    createAgentScriptSpy.mockResolvedValue(null);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify error was shown
    expect(showErrorMessageSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to generate authoring bundle'));
    expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
      expect.stringContaining('Failed to generate agent script')
    );
  });
});
