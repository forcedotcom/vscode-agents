import type * as vscodeTypes from 'vscode';
const vscode = require('vscode') as typeof import('vscode');
import { Commands } from '../../src/enums/commands';
import { registerActivateAgentCommand } from '../../src/commands/activateAgent';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { getAgentNameFromPath } from '../../src/commands/agentUtils';
import { SfProject, ConfigAggregator, Org } from '@salesforce/core';
import { Agent } from '@salesforce/agents';

jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    withProgress: jest.fn(),
    activeTextEditor: undefined
  },
  workspace: {
    fs: {
      stat: jest.fn()
    }
  },
  commands: {
    registerCommand: jest.fn()
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
    init: jest.fn()
  }
}));

jest.mock('../../src/commands/agentUtils', () => ({
  getAgentNameFromPath: jest.fn(),
  getAgentNameFromFile: jest.fn(),
  getVersionNumberFromFileName: jest.requireActual('../../src/commands/agentUtils').getVersionNumberFromFileName
}));

describe('activateAgent command', () => {
  let registerSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let withProgressSpy: jest.SpyInstance;
  let telemetryMock: { sendCommandEvent: jest.Mock; sendException: jest.Mock };
  let channelMock: { appendLine: jest.Mock; showChannelOutput: jest.Mock; clear: jest.Mock };

  const registerAndGetHandler = () => {
    registerActivateAgentCommand();
    expect(registerSpy).toHaveBeenCalledWith(Commands.activateAgent, expect.any(Function));
    return registerSpy.mock.calls[0][1] as (uri?: vscodeTypes.Uri) => Promise<void>;
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
    withProgressSpy = jest.spyOn(vscode.window, 'withProgress').mockImplementation(async (_opts, task) => {
      return task({ report: jest.fn() }, {} as vscodeTypes.CancellationToken);
    });
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });
    Object.defineProperty(vscode.window, 'activeTextEditor', {
      configurable: true,
      get: () => undefined
    });

    // Mock SfProject.getInstance
    (SfProject.getInstance as jest.Mock).mockReturnValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers the command', () => {
    registerActivateAgentCommand();
    expect(registerSpy).toHaveBeenCalledWith(Commands.activateAgent, expect.any(Function));
  });

  it('shows an error when no file is selected', async () => {
    const handler = registerAndGetHandler();
    await handler();
    expect(errorSpy).toHaveBeenCalledWith('No agent file or directory selected.');
  });

  it('validates unsupported file extensions', async () => {
    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/foo.txt' } as vscodeTypes.Uri;
    await handler(uri);
    expect(errorSpy).toHaveBeenCalledWith(
      'You can use this command on only bot, botVersion, or genAiPlannerBundle metadata files.'
    );
  });

  it('validates unsupported directories', async () => {
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.Directory });
    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/random-folder' } as vscodeTypes.Uri;
    await handler(uri);
    expect(errorSpy).toHaveBeenCalledWith(
      'You can use this command on only directories that contain bot, botVersion, or genAiPlannerBundle metadata files.'
    );
  });

  it('activates agent without version when called on .bot-meta.xml file', async () => {
    const mockActivate = jest.fn().mockResolvedValue({});
    const mockAgent = {
      activate: mockActivate
    };
    (Agent.init as jest.Mock).mockResolvedValue(mockAgent);
    (getAgentNameFromPath as jest.Mock).mockResolvedValue('TestAgent');
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });

    const mockOrg = { getConnection: jest.fn().mockReturnValue({}) };
    (Org.create as jest.Mock).mockResolvedValue(mockOrg);
    (ConfigAggregator.create as jest.Mock).mockResolvedValue({
      getPropertyValue: jest.fn().mockReturnValue('test-org')
    });

    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/TestAgent.bot-meta.xml' } as vscodeTypes.Uri;
    await handler(uri);

    expect(mockActivate).toHaveBeenCalledWith(undefined);
    expect(infoSpy).toHaveBeenCalledWith('Agent "TestAgent" was activated successfully.');
  });

  it('activates agent with version number when called on .botVersion-meta.xml file', async () => {
    const mockActivate = jest.fn().mockResolvedValue({});
    const mockAgent = {
      activate: mockActivate
    };
    (Agent.init as jest.Mock).mockResolvedValue(mockAgent);
    (getAgentNameFromPath as jest.Mock).mockResolvedValue('TestAgent');
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });

    const mockOrg = { getConnection: jest.fn().mockReturnValue({}) };
    (Org.create as jest.Mock).mockResolvedValue(mockOrg);
    (ConfigAggregator.create as jest.Mock).mockResolvedValue({
      getPropertyValue: jest.fn().mockReturnValue('test-org')
    });

    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/botVersions/TestAgent/v5.botVersion-meta.xml' } as vscodeTypes.Uri;
    await handler(uri);

    expect(mockActivate).toHaveBeenCalledWith(5);
    expect(infoSpy).toHaveBeenCalledWith('Agent "TestAgent" (version 5) was activated successfully.');
  });

  it('activates agent with version 0 when called on v0.botVersion-meta.xml file', async () => {
    const mockActivate = jest.fn().mockResolvedValue({});
    const mockAgent = {
      activate: mockActivate
    };
    (Agent.init as jest.Mock).mockResolvedValue(mockAgent);
    (getAgentNameFromPath as jest.Mock).mockResolvedValue('TestAgent');
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({ type: vscode.FileType.File });

    const mockOrg = { getConnection: jest.fn().mockReturnValue({}) };
    (Org.create as jest.Mock).mockResolvedValue(mockOrg);
    (ConfigAggregator.create as jest.Mock).mockResolvedValue({
      getPropertyValue: jest.fn().mockReturnValue('test-org')
    });

    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/botVersions/TestAgent/v0.botVersion-meta.xml' } as vscodeTypes.Uri;
    await handler(uri);

    expect(mockActivate).toHaveBeenCalledWith(0);
    expect(infoSpy).toHaveBeenCalledWith('Agent "TestAgent" (version 0) was activated successfully.');
  });
});
