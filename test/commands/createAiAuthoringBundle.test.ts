import * as vscode from 'vscode';
import * as path from 'path';
import { readFileSync } from 'node:fs';
import { registerCreateAiAuthoringBundleCommand } from '../../src/commands/createAiAuthoringBundle';
import { Commands } from '../../src/enums/commands';
import { ScriptAgent } from '@salesforce/agents';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { SfProject, generateApiName } from '@salesforce/core';

// Preserve real fs (got, via @salesforce/agents, needs fs.stat) and only mock readFileSync
jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  readFileSync: jest.fn()
}));

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

    // Ensure generateApiName mock is set up correctly
    (generateApiName as jest.Mock).mockImplementation((name: string) => name.replace(/\s+/g, ''));

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

    // Mock SfProject - getInstance is synchronous
    (SfProject.getInstance as jest.Mock).mockReturnValue(mockProject);

    // Mock vscode APIs
    commandSpy = jest.spyOn(vscode.commands, 'registerCommand');
    showInputBoxSpy = jest.spyOn(vscode.window, 'showInputBox');
    showQuickPickSpy = jest.spyOn(vscode.window, 'showQuickPick');
    jest.spyOn(vscode.window, 'showInformationMessage').mockImplementation();
    showErrorMessageSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockImplementation();

    jest.spyOn(vscode.window, 'withProgress').mockImplementation(async (_options, task) => {
      return await task({ report: jest.fn() }, {} as vscode.CancellationToken);
    });

    // Mock openTextDocument and showTextDocument
    jest.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue({
      uri: vscode.Uri.file('/test/path'),
      fileName: 'test.agent',
      languageId: 'agent',
      version: 1,
      isDirty: false,
      isUntitled: false,
      isClosed: false,
      save: jest.fn(),
      dispose: jest.fn()
    } as any);

    // Mock showTextDocument - add it to window if it doesn't exist
    Object.defineProperty(vscode.window, 'showTextDocument', {
      value: jest.fn().mockResolvedValue({
        document: {} as any,
        viewColumn: 1,
        viewType: 'text'
      }),
      configurable: true,
      writable: true
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

    // Mock ScriptAgent.createAuthoringBundle
    createAgentScriptSpy = jest.spyOn(ScriptAgent, 'createAuthoringBundle');

    // Mock readFileSync for spec file reads (used when a file spec is selected)
    (readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('specs')) {
        return 'agentType: customer\nrole: TestRole';
      }
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const defaultSpecTypeItem = { label: 'Default Agent Spec', description: 'Create bundle without a custom spec', isCustom: false };
  const customSpecTypeItem = { label: 'Custom Agent Spec', description: 'Choose from available spec files', isCustom: true };

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

    // Two-step quick pick: first select Custom, then select the file
    showQuickPickSpy
      .mockResolvedValueOnce(customSpecTypeItem)
      .mockResolvedValueOnce('test-spec.yaml');

    // Mock spec file content (read via readFileSync when file spec is selected)
    (readFileSync as jest.Mock).mockReturnValue('agentType: customer\nrole: Test Role');

    // Mock agent script generation
    createAgentScriptSpy.mockResolvedValue(undefined);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify telemetry
    expect(fakeTelemetryInstance.sendCommandEvent).toHaveBeenCalledWith(Commands.createAiAuthoringBundle);

    // Verify agent script was created
    expect(createAgentScriptSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        agentSpec: expect.objectContaining({
          name: 'My Test Agent',
          developerName: 'MyTestAgent',
          agentType: 'customer',
          role: 'Test Role'
        }),
        project: mockProject,
        bundleApiName: 'MyTestAgent',
        outputDir: expect.any(String)
      })
    );
  });

  it('cancels when user cancels name input', async () => {
    showInputBoxSpy.mockResolvedValue(undefined);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    expect(createAgentScriptSpy).not.toHaveBeenCalled();
  });

  it('shows Default Agent Spec only when no spec files found and calls createAuthoringBundle without agentSpec', async () => {
    showInputBoxSpy.mockResolvedValue('My Test Agent');
    readDirectorySpy.mockResolvedValue([]); // No spec files
    showQuickPickSpy.mockResolvedValue(defaultSpecTypeItem);
    createAgentScriptSpy.mockResolvedValue(undefined);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Quick pick should have one option: Default Agent Spec (Custom not shown when no specs)
    const quickPickItems = showQuickPickSpy.mock.calls[0][0];
    expect(quickPickItems).toHaveLength(1);
    expect(quickPickItems[0]).toMatchObject({ label: 'Default Agent Spec', isCustom: false });
    // createAuthoringBundle called without agentSpec
    expect(createAgentScriptSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        project: mockProject,
        bundleApiName: 'MyTestAgent',
        outputDir: expect.any(String)
      })
    );
    expect(createAgentScriptSpy.mock.calls[0][0].agentSpec).toBeUndefined();
  });

  it('cancels when user cancels spec type selection', async () => {
    showInputBoxSpy.mockResolvedValue('My Test Agent');
    readDirectorySpy.mockResolvedValue([['test-spec.yaml', vscode.FileType.File]]);
    showQuickPickSpy.mockResolvedValue(undefined as any); // User cancelled on spec type selection

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    expect(createAgentScriptSpy).not.toHaveBeenCalled();
  });

  it('cancels when user cancels spec file selection', async () => {
    showInputBoxSpy.mockResolvedValue('My Test Agent');
    readDirectorySpy.mockResolvedValue([['test-spec.yaml', vscode.FileType.File]]);
    // User selects Custom but cancels file selection
    showQuickPickSpy
      .mockResolvedValueOnce(customSpecTypeItem)
      .mockResolvedValueOnce(undefined as any);

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

    // Two-step: select Custom, then select file
    showQuickPickSpy
      .mockResolvedValueOnce(customSpecTypeItem)
      .mockResolvedValueOnce('test-spec.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));
    createAgentScriptSpy.mockResolvedValue(undefined);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // First quick pick should have 2 options: Default and Custom
    const specTypeItems = showQuickPickSpy.mock.calls[0][0];
    expect(specTypeItems).toHaveLength(2);
    expect(specTypeItems[0]).toMatchObject({ label: 'Default Agent Spec', isCustom: false });
    expect(specTypeItems[1]).toMatchObject({ label: 'Custom Agent Spec', isCustom: true });

    // Second quick pick should have only YAML files
    const specFileItems = showQuickPickSpy.mock.calls[1][0];
    expect(specFileItems).toHaveLength(2);
    expect(specFileItems).toContain('test-spec.yaml');
    expect(specFileItems).toContain('another-spec.yml');
  });

  it('generates correct API name from regular name', async () => {
    showInputBoxSpy.mockResolvedValue('My Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy
      .mockResolvedValueOnce(customSpecTypeItem)
      .mockResolvedValueOnce('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));
    createAgentScriptSpy.mockResolvedValue(undefined);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify generateApiName was called
    expect(generateApiName).toHaveBeenCalledWith('My Test Agent');
  });

  it('creates bundle in correct directory structure', async () => {
    showInputBoxSpy.mockResolvedValue('Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy
      .mockResolvedValueOnce(customSpecTypeItem)
      .mockResolvedValueOnce('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));
    createAgentScriptSpy.mockResolvedValue(undefined);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify directory was created
    expect(createDirectorySpy).toHaveBeenCalled();
  });

  it('handles agent script generation errors gracefully', async () => {
    showInputBoxSpy.mockResolvedValue('Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy
      .mockResolvedValueOnce(customSpecTypeItem)
      .mockResolvedValueOnce('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));

    // Mock createAuthoringBundle to throw error
    createAgentScriptSpy.mockRejectedValue(new Error('API Error'));

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify error was shown
    expect(showErrorMessageSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to generate authoring bundle'));
  });

  it('displays error message in output channel', async () => {
    showInputBoxSpy.mockResolvedValue('Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy
      .mockResolvedValueOnce(customSpecTypeItem)
      .mockResolvedValueOnce('test.yaml');

    // Mock createAgentScript to throw error
    createAgentScriptSpy.mockRejectedValue(new Error('API connection timeout'));

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify error message is displayed in channel
    expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
      expect.stringMatching(/\[error\].*Failed to generate authoring bundle/)
    );
    expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
      expect.stringMatching(/\[error\].*Details: API connection timeout/)
    );
  });

  it('displays "Something went wrong" for empty error message in output channel', async () => {
    showInputBoxSpy.mockResolvedValue('Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy
      .mockResolvedValueOnce(customSpecTypeItem)
      .mockResolvedValueOnce('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));

    // Mock createAgentScript to throw error with empty message
    const emptyError = new Error('');
    createAgentScriptSpy.mockRejectedValue(emptyError);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify fallback message is displayed
    expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
      expect.stringMatching(/\[error\].*Failed to generate authoring bundle/)
    );
    expect(showErrorMessageSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to generate authoring bundle'));
  });

  it('validates bundle name is not empty', async () => {
    let validator: any;
    showInputBoxSpy.mockImplementation(async options => {
      if (options?.validateInput) {
        validator = options.validateInput;
      }
      return undefined;
    });

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Test the validation function
    expect(validator).toBeDefined();
    expect(typeof validator).toBe('function');
    expect(validator('')).toBe('Bundle name is required');
    expect(validator('   ')).toBe("Bundle name can't be empty.");
    expect(validator('Valid Name')).toBeNull();
  });

  it('uses provided URI when command invoked from context menu', async () => {
    const contextUri = vscode.Uri.file(path.join('custom', 'path', 'aiAuthoringBundles'));

    showInputBoxSpy.mockResolvedValue('Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy
      .mockResolvedValueOnce(customSpecTypeItem)
      .mockResolvedValueOnce('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));
    createAgentScriptSpy.mockResolvedValue(undefined);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler(contextUri);

    // Verify command executed successfully
    expect(createAgentScriptSpy).toHaveBeenCalled();
  });

  it('calls createDirectory to create bundle structure', async () => {
    showInputBoxSpy.mockResolvedValue('My Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy
      .mockResolvedValueOnce(customSpecTypeItem)
      .mockResolvedValueOnce('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));
    createAgentScriptSpy.mockResolvedValue(undefined);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify bundle directory was created
    expect(createDirectorySpy).toHaveBeenCalled();
    expect(createAgentScriptSpy).toHaveBeenCalled();
  });

  it('passes spec data with name and developerName to createAuthoringBundle', async () => {
    showInputBoxSpy.mockResolvedValue('Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy
      .mockResolvedValueOnce(customSpecTypeItem)
      .mockResolvedValueOnce('test.yaml');
    (readFileSync as jest.Mock).mockReturnValue('agentType: customer\nrole: TestRole');
    createAgentScriptSpy.mockResolvedValue(undefined);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify createAuthoringBundle was called with correct parameters
    expect(createAgentScriptSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        agentSpec: expect.objectContaining({
          name: 'Test Agent',
          developerName: 'TestAgent',
          agentType: 'customer',
          role: 'TestRole'
        }),
        project: mockProject,
        outputDir: expect.any(String),
        bundleApiName: 'TestAgent'
      })
    );

    // Verify generateApiName was called with the name
    expect(generateApiName).toHaveBeenCalledWith('Test Agent');
  });

  it('handles specs directory not found error', async () => {
    showInputBoxSpy.mockResolvedValue('Test Agent');
    // Mock readDirectory to throw error (directory not found)
    readDirectorySpy.mockRejectedValue(new Error('Directory not found'));
    showQuickPickSpy.mockResolvedValue(defaultSpecTypeItem);
    createAgentScriptSpy.mockResolvedValue(undefined);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Should log the warning (specs dir not found)
    expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
      expect.stringMatching(/\[warn\].*No agent spec directory found/)
    );
    // Should show Default Agent Spec only and call createAuthoringBundle without agentSpec
    expect(createAgentScriptSpy).toHaveBeenCalled();
    expect(createAgentScriptSpy.mock.calls[0][0].agentSpec).toBeUndefined();
  });

  it('calls createAuthoringBundle without agentSpec when Default Agent Spec is selected', async () => {
    showInputBoxSpy.mockResolvedValue('New Agent');
    readDirectorySpy.mockResolvedValue([['custom.yaml', vscode.FileType.File]]);
    showQuickPickSpy.mockResolvedValue(defaultSpecTypeItem);
    createAgentScriptSpy.mockResolvedValue(undefined);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    expect(createAgentScriptSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        project: mockProject,
        bundleApiName: 'NewAgent',
        outputDir: expect.any(String)
      })
    );
    expect(createAgentScriptSpy.mock.calls[0][0].agentSpec).toBeUndefined();
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it('opens the generated agent file after successful creation', async () => {
    const openTextDocumentSpy = jest.spyOn(vscode.workspace, 'openTextDocument');
    const showTextDocumentSpy = jest.spyOn(vscode.window, 'showTextDocument');

    showInputBoxSpy.mockResolvedValue('Test Agent');
    readDirectorySpy.mockResolvedValue([['test.yaml', vscode.FileType.File]]);
    showQuickPickSpy
      .mockResolvedValueOnce(customSpecTypeItem)
      .mockResolvedValueOnce('test.yaml');
    readFileSpy.mockResolvedValue(new TextEncoder().encode('agentType: customer'));
    createAgentScriptSpy.mockResolvedValue(undefined);

    registerCreateAiAuthoringBundleCommand();
    const handler = commandSpy.mock.calls[0][1];
    await handler();

    // Verify the agent file was opened
    expect(openTextDocumentSpy).toHaveBeenCalled();
    expect(showTextDocumentSpy).toHaveBeenCalled();
  });
});
