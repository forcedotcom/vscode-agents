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
  FileType: { File: 1, Directory: 2 }
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

  it('shows deactivated agent picker when no file is selected', async () => {
    setupOrgMocks();
    const mockActivate = jest.fn().mockResolvedValue({ VersionNumber: 1 });
    const mockAgent = {
      activate: mockActivate,
      getBotMetadata: jest.fn().mockResolvedValue({
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

    // Should only show deactivated agents
    expect(quickPickSpy).toHaveBeenCalledWith(
      [expect.objectContaining({ label: 'MyAgent', agentId: 'agent1' })],
      expect.objectContaining({ placeHolder: 'Select a deactivated agent to activate' })
    );
  });

  it('shows message when no published agents found', async () => {
    setupOrgMocks();
    (getPublishedAgents as jest.Mock).mockResolvedValue([]);

    const handler = registerAndGetHandler();
    await handler();

    expect(infoSpy).toHaveBeenCalledWith('No published agents found in the org.');
  });

  it('shows message when all agents are already active', async () => {
    setupOrgMocks();
    (getPublishedAgents as jest.Mock).mockResolvedValue([
      { name: 'Agent1', id: 'agent1', isActivated: true }
    ]);

    const handler = registerAndGetHandler();
    await handler();

    expect(infoSpy).toHaveBeenCalledWith('All published agents are already active.');
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

  it('auto-selects when only one version exists', async () => {
    const mockActivate = jest.fn().mockResolvedValue({ VersionNumber: 1 });
    const mockAgent = {
      activate: mockActivate,
      getBotMetadata: jest.fn().mockResolvedValue({
        BotVersions: {
          records: [{ VersionNumber: 1, Status: 'Inactive' }]
        }
      })
    };
    (Agent.init as jest.Mock).mockResolvedValue(mockAgent);
    (getAgentNameFromPath as jest.Mock).mockResolvedValue('TestAgent');
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });
    setupOrgMocks();

    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/TestAgent.bot-meta.xml' } as vscodeTypes.Uri;
    await handler(uri);

    expect(quickPickSpy).not.toHaveBeenCalled();
    expect(mockActivate).toHaveBeenCalledWith(1);
    expect(infoSpy).toHaveBeenCalledWith('Agent "TestAgent" v1 activated.');
  });

  it('shows version picker when multiple versions exist', async () => {
    const mockActivate = jest.fn().mockResolvedValue({ VersionNumber: 3 });
    const mockAgent = {
      activate: mockActivate,
      getBotMetadata: jest.fn().mockResolvedValue({
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

    quickPickSpy.mockResolvedValue({ label: 'Version 3', versionNumber: 3 });

    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/TestAgent.bot-meta.xml' } as vscodeTypes.Uri;
    await handler(uri);

    expect(quickPickSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Version 3', description: '' }),
        expect.objectContaining({ label: 'Version 2', description: '(Active)' }),
        expect.objectContaining({ label: 'Version 1', description: '' })
      ]),
      expect.objectContaining({ placeHolder: 'Select a version to activate for "TestAgent"' })
    );
    expect(mockActivate).toHaveBeenCalledWith(3);
    expect(infoSpy).toHaveBeenCalledWith('Agent "TestAgent" v3 activated.');
  });

  it('does nothing when user cancels version picker', async () => {
    const mockActivate = jest.fn();
    const mockAgent = {
      activate: mockActivate,
      getBotMetadata: jest.fn().mockResolvedValue({
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

  it('shows error when no versions found', async () => {
    const mockAgent = {
      activate: jest.fn(),
      getBotMetadata: jest.fn().mockResolvedValue({
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

    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/TestAgent.bot-meta.xml' } as vscodeTypes.Uri;
    await handler(uri);

    // Should auto-select since only one non-deleted version
    expect(quickPickSpy).not.toHaveBeenCalled();
    expect(mockActivate).toHaveBeenCalledWith(2);
  });
});
