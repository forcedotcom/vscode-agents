import type * as vscodeTypes from 'vscode';
const vscode = require('vscode') as typeof import('vscode');
import { Commands } from '../../src/enums/commands';
import { registerActivateAgentCommand } from '../../src/commands/activateAgent';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { getAgentNameFromPath, getConnectionAndProject, getPublishedAgents } from '../../src/commands/agentUtils';
import { SfProject, ConfigAggregator, Org } from '@salesforce/core';
import { Agent } from '@salesforce/agents';

jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showQuickPick: jest.fn(),
    withProgress: jest.fn(),
    activeTextEditor: undefined
  },
  workspace: {
    fs: {
      stat: jest.fn()
    }
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn().mockResolvedValue(undefined)
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath })
  },
  ProgressLocation: { Notification: 1 },
  FileType: { File: 1, Directory: 2 },
  QuickPickItemKind: { Separator: -1, Default: 0 }
}));

jest.mock('@salesforce/core', () => ({
  SfProject: { getInstance: jest.fn() },
  ConfigAggregator: { create: jest.fn() },
  Org: { create: jest.fn() },
  SfError: {
    wrap: (err: Error) => err
  }
}));

jest.mock('@salesforce/agents', () => ({
  Agent: {
    init: jest.fn(),
    listRemote: jest.fn()
  },
  ProductionAgent: jest.fn()
}));

jest.mock('../../src/commands/agentUtils', () => ({
  getAgentNameFromPath: jest.fn(),
  getAgentNameFromFile: jest.fn(),
  getConnectionAndProject: jest.fn(),
  getPublishedAgents: jest.fn()
}));

describe('activateAgent command', () => {
  let registerSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let quickPickSpy: jest.SpyInstance;
  let warningSpy: jest.SpyInstance;
  let withProgressSpy: jest.SpyInstance;
  let telemetryMock: { sendCommandEvent: jest.Mock; sendException: jest.Mock };
  let channelMock: { appendLine: jest.Mock; showChannelOutput: jest.Mock; clear: jest.Mock };

  const registerAndGetHandler = () => {
    registerActivateAgentCommand();
    expect(registerSpy).toHaveBeenCalledWith(Commands.activateAgent, expect.any(Function));
    return registerSpy.mock.calls[0][1] as (uri?: vscodeTypes.Uri) => Promise<void>;
  };

  const mockConn = {};
  const mockProject = {};

  const setupOrgMocks = () => {
    (getConnectionAndProject as jest.Mock).mockResolvedValue({ conn: mockConn, project: mockProject });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    telemetryMock = {
      sendCommandEvent: jest.fn(),
      sendException: jest.fn()
    };
    channelMock = {
      appendLine: jest.fn(),
      showChannelOutput: jest.fn(),
      clear: jest.fn()
    };
    jest.spyOn(CoreExtensionService, 'getTelemetryService').mockReturnValue(telemetryMock as any);
    jest.spyOn(CoreExtensionService, 'getChannelService').mockReturnValue(channelMock as any);

    registerSpy = jest.spyOn(vscode.commands, 'registerCommand');
    errorSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockImplementation();
    infoSpy = jest.spyOn(vscode.window, 'showInformationMessage').mockImplementation();
    quickPickSpy = jest.spyOn(vscode.window, 'showQuickPick').mockImplementation();
    warningSpy = jest.spyOn(vscode.window, 'showWarningMessage').mockImplementation();
    withProgressSpy = jest.spyOn(vscode.window, 'withProgress').mockImplementation(async (_opts, task) => {
      return task({ report: jest.fn() }, {} as vscodeTypes.CancellationToken);
    });
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });
    Object.defineProperty(vscode.window, 'activeTextEditor', {
      configurable: true,
      get: () => undefined
    });

    (SfProject.getInstance as jest.Mock).mockReturnValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers the command', () => {
    registerActivateAgentCommand();
    expect(registerSpy).toHaveBeenCalledWith(Commands.activateAgent, expect.any(Function));
  });

  it('shows only deactivated agents in picker when no file is selected', async () => {
    setupOrgMocks();
    const mockActivate = jest.fn().mockResolvedValue({ VersionNumber: 1 });
    const mockAgent = {
      activate: mockActivate,
      getBotMetadata: jest.fn().mockResolvedValue({
        Id: '0Xx000000000001',
        BotVersions: {
          records: [{ VersionNumber: 1, Status: 'Inactive' }]
        }
      })
    };
    (Agent.init as jest.Mock).mockResolvedValue(mockAgent);
    (getPublishedAgents as jest.Mock).mockResolvedValue([
      { name: 'MyAgent', id: 'agent1', isActivated: false },
      { name: 'ActiveAgent', id: 'agent2', isActivated: true }
    ]);
    quickPickSpy.mockResolvedValue({ label: 'MyAgent', agentId: 'agent1' });

    const handler = registerAndGetHandler();
    await handler();

    // Should show only deactivated agents
    expect(quickPickSpy).toHaveBeenCalledWith(
      [
        expect.objectContaining({ label: 'MyAgent', agentId: 'agent1' })
      ],
      expect.objectContaining({ placeHolder: 'Select an agent to activate' })
    );
  });

  it('shows message when no deactivated agents found', async () => {
    setupOrgMocks();
    (getPublishedAgents as jest.Mock).mockResolvedValue([]);

    const handler = registerAndGetHandler();
    await handler();

    expect(infoSpy).toHaveBeenCalledWith('No deactivated agents found in the org.');
  });

  it('shows message when only active agents exist', async () => {
    setupOrgMocks();
    (getPublishedAgents as jest.Mock).mockResolvedValue([
      { name: 'Agent1', id: 'agent1', isActivated: true }
    ]);

    const handler = registerAndGetHandler();
    await handler();

    expect(infoSpy).toHaveBeenCalledWith('No deactivated agents found in the org.');
    expect(quickPickSpy).not.toHaveBeenCalled();
  });

  it('validates unsupported file extensions', async () => {
    setupOrgMocks();
    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/foo.txt' } as vscodeTypes.Uri;
    await handler(uri);
    expect(errorSpy).toHaveBeenCalledWith(
      'You can use this command on only bot, botVersion, or genAiPlannerBundle metadata files.'
    );
  });

  it('validates unsupported directories', async () => {
    setupOrgMocks();
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.Directory });
    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/random-folder' } as vscodeTypes.Uri;
    await handler(uri);
    expect(errorSpy).toHaveBeenCalledWith(
      'You can use this command on only directories that contain bot, botVersion, or genAiPlannerBundle metadata files.'
    );
  });

  it('shows picker even with one version so deactivate is available', async () => {
    const mockActivate = jest.fn().mockResolvedValue({ VersionNumber: 1 });
    const mockAgent = {
      activate: mockActivate,
      getBotMetadata: jest.fn().mockResolvedValue({
        Id: '0Xx000000000001',
        BotVersions: {
          records: [{ VersionNumber: 1, Status: 'Inactive' }]
        }
      })
    };
    (Agent.init as jest.Mock).mockResolvedValue(mockAgent);
    (getAgentNameFromPath as jest.Mock).mockResolvedValue('TestAgent');
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });
    setupOrgMocks();

    quickPickSpy.mockResolvedValue({ label: 'Version 1', action: 'activate', versionNumber: 1 });

    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/TestAgent.bot-meta.xml' } as vscodeTypes.Uri;
    await handler(uri);

    expect(quickPickSpy).toHaveBeenCalled();
    const pickerItems = quickPickSpy.mock.calls[0][0];
    expect(pickerItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Version 1', action: 'activate' }),
      expect.objectContaining({ label: 'Deactivate', action: 'deactivate' })
    ]));
    expect(mockActivate).toHaveBeenCalledWith(1);
  });

  it('shows version picker when multiple versions exist', async () => {
    const mockActivate = jest.fn().mockResolvedValue({ VersionNumber: 3 });
    const mockAgent = {
      activate: mockActivate,
      getBotMetadata: jest.fn().mockResolvedValue({
        Id: '0Xx000000000001',
        BotVersions: {
          records: [
            { VersionNumber: 1, Status: 'Inactive' },
            { VersionNumber: 2, Status: 'Active' },
            { VersionNumber: 3, Status: 'Inactive' }
          ]
        }
      })
    };
    (Agent.init as jest.Mock).mockResolvedValue(mockAgent);
    (getAgentNameFromPath as jest.Mock).mockResolvedValue('TestAgent');
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });
    setupOrgMocks();

    quickPickSpy.mockResolvedValue({ label: 'Version 3', action: 'activate', versionNumber: 3 });

    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/TestAgent.bot-meta.xml' } as vscodeTypes.Uri;
    await handler(uri);

    expect(quickPickSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Version 3', description: '', action: 'activate' }),
        expect.objectContaining({ label: 'Version 2', description: '(Active)', action: 'activate' }),
        expect.objectContaining({ label: 'Version 1', description: '', action: 'activate' }),
        expect.objectContaining({ label: 'Deactivate', action: 'deactivate' })
      ]),
      expect.objectContaining({ placeHolder: 'Select a version to activate for "TestAgent"' })
    );
    expect(mockActivate).toHaveBeenCalledWith(3);
    expect(infoSpy).toHaveBeenCalledWith('Agent "TestAgent" v3 activated.');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'sf.agent.combined.view.refreshAgents', '0Xx000000000001'
    );
  });

  it('does nothing when user cancels version picker', async () => {
    const mockActivate = jest.fn();
    const mockAgent = {
      activate: mockActivate,
      getBotMetadata: jest.fn().mockResolvedValue({
        Id: '0Xx000000000001',
        BotVersions: {
          records: [
            { VersionNumber: 1, Status: 'Inactive' },
            { VersionNumber: 2, Status: 'Active' }
          ]
        }
      })
    };
    (Agent.init as jest.Mock).mockResolvedValue(mockAgent);
    (getAgentNameFromPath as jest.Mock).mockResolvedValue('TestAgent');
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });
    setupOrgMocks();

    quickPickSpy.mockResolvedValue(undefined);

    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/TestAgent.bot-meta.xml' } as vscodeTypes.Uri;
    await handler(uri);

    expect(mockActivate).not.toHaveBeenCalled();
  });

  it('deactivates agent when deactivate option is picked', async () => {
    const mockDeactivate = jest.fn().mockResolvedValue({});
    const mockAgent = {
      activate: jest.fn(),
      deactivate: mockDeactivate,
      getBotMetadata: jest.fn().mockResolvedValue({
        Id: '0Xx000000000001',
        BotVersions: {
          records: [
            { VersionNumber: 1, Status: 'Active' },
            { VersionNumber: 2, Status: 'Inactive' }
          ]
        }
      })
    };
    (Agent.init as jest.Mock).mockResolvedValue(mockAgent);
    (getAgentNameFromPath as jest.Mock).mockResolvedValue('TestAgent');
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });
    setupOrgMocks();

    quickPickSpy.mockResolvedValue({ label: 'Deactivate', action: 'deactivate' });
    warningSpy.mockResolvedValue('Deactivate');

    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/TestAgent.bot-meta.xml' } as vscodeTypes.Uri;
    await handler(uri);

    expect(warningSpy).toHaveBeenCalledWith(
      'Are you sure you want to deactivate agent "TestAgent"?',
      { modal: true },
      'Deactivate'
    );
    expect(mockDeactivate).toHaveBeenCalled();
    expect(mockAgent.activate).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith('Agent "TestAgent" was deactivated.');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'sf.agent.combined.view.refreshAgents'
    );
  });

  it('does not deactivate when user cancels confirmation', async () => {
    const mockDeactivate = jest.fn();
    const mockAgent = {
      activate: jest.fn(),
      deactivate: mockDeactivate,
      getBotMetadata: jest.fn().mockResolvedValue({
        Id: '0Xx000000000001',
        BotVersions: {
          records: [{ VersionNumber: 1, Status: 'Active' }]
        }
      })
    };
    (Agent.init as jest.Mock).mockResolvedValue(mockAgent);
    (getAgentNameFromPath as jest.Mock).mockResolvedValue('TestAgent');
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });
    setupOrgMocks();

    quickPickSpy.mockResolvedValue({ label: 'Deactivate', action: 'deactivate' });
    warningSpy.mockResolvedValue(undefined); // User cancelled

    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/TestAgent.bot-meta.xml' } as vscodeTypes.Uri;
    await handler(uri);

    expect(warningSpy).toHaveBeenCalled();
    expect(mockDeactivate).not.toHaveBeenCalled();
  });

  it('always shows deactivate option in version picker', async () => {
    const mockAgent = {
      activate: jest.fn().mockResolvedValue({ VersionNumber: 1 }),
      getBotMetadata: jest.fn().mockResolvedValue({
        Id: '0Xx000000000001',
        BotVersions: {
          records: [
            { VersionNumber: 1, Status: 'Inactive' },
            { VersionNumber: 2, Status: 'Inactive' }
          ]
        }
      })
    };
    (Agent.init as jest.Mock).mockResolvedValue(mockAgent);
    (getAgentNameFromPath as jest.Mock).mockResolvedValue('TestAgent');
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });
    setupOrgMocks();

    quickPickSpy.mockResolvedValue({ label: 'Version 1', action: 'activate', versionNumber: 1 });

    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/TestAgent.bot-meta.xml' } as vscodeTypes.Uri;
    await handler(uri);

    const pickerItems = quickPickSpy.mock.calls[0][0];
    const deactivateItem = pickerItems.find((item: any) => item.action === 'deactivate' && item.label === 'Deactivate');
    expect(deactivateItem).toBeDefined();
  });

  it('shows error when no versions found', async () => {
    const mockAgent = {
      activate: jest.fn(),
      getBotMetadata: jest.fn().mockResolvedValue({
        Id: '0Xx000000000001',
        BotVersions: { records: [] }
      })
    };
    (Agent.init as jest.Mock).mockResolvedValue(mockAgent);
    (getAgentNameFromPath as jest.Mock).mockResolvedValue('TestAgent');
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });
    setupOrgMocks();

    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/TestAgent.bot-meta.xml' } as vscodeTypes.Uri;
    await handler(uri);

    expect(errorSpy).toHaveBeenCalledWith('No versions found for agent "TestAgent".');
  });

  it('filters out deleted versions', async () => {
    const mockActivate = jest.fn().mockResolvedValue({ VersionNumber: 2 });
    const mockAgent = {
      activate: mockActivate,
      getBotMetadata: jest.fn().mockResolvedValue({
        Id: '0Xx000000000001',
        BotVersions: {
          records: [
            { VersionNumber: 1, Status: 'Inactive', IsDeleted: true },
            { VersionNumber: 2, Status: 'Inactive' }
          ]
        }
      })
    };
    (Agent.init as jest.Mock).mockResolvedValue(mockAgent);
    (getAgentNameFromPath as jest.Mock).mockResolvedValue('TestAgent');
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });
    setupOrgMocks();

    quickPickSpy.mockResolvedValue({ label: 'Version 2', action: 'activate', versionNumber: 2 });

    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/TestAgent.bot-meta.xml' } as vscodeTypes.Uri;
    await handler(uri);

    // Deleted version should not appear in picker
    const pickerItems = quickPickSpy.mock.calls[0][0];
    const versionItems = pickerItems.filter((item: any) => item.action === 'activate');
    expect(versionItems).toHaveLength(1);
    expect(versionItems[0].versionNumber).toBe(2);
    expect(mockActivate).toHaveBeenCalledWith(2);
  });
});
