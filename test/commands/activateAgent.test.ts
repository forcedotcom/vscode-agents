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
  Org: { create: jest.fn() }
}));

jest.mock('@salesforce/agents', () => ({
  Agent: jest.fn()
}));

jest.mock('../../src/commands/agentUtils', () => ({
  getAgentNameFromPath: jest.fn(),
  getAgentNameFromFile: jest.fn()
}));

describe('activateAgent command', () => {
  let registerSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let withProgressSpy: jest.SpyInstance;
  let telemetryMock: { sendCommandEvent: jest.Mock; sendException: jest.Mock };
  let channelMock: { appendLine: jest.Mock; showChannelOutput: jest.Mock };

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
      showChannelOutput: jest.fn()
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

  it('activates the agent when inputs are valid', async () => {
    const handler = registerAndGetHandler();
    const uri = { fsPath: '/tmp/sample.bot-meta.xml' } as vscodeTypes.Uri;
    (getAgentNameFromPath as jest.Mock).mockResolvedValue('SampleAgent');
    (SfProject.getInstance as jest.Mock).mockReturnValue({ project: 'test' });
    (ConfigAggregator.create as jest.Mock).mockResolvedValue({
      getPropertyValue: () => 'test-org'
    });
    const fakeConnection = { foo: 'bar' };
    (Org.create as jest.Mock).mockResolvedValue({
      getConnection: () => fakeConnection
    });
    const activateMock = jest.fn().mockResolvedValue(undefined);
    const AgentMock = Agent as unknown as jest.Mock;
    AgentMock.mockImplementation(() => ({
      activate: activateMock
    }));

    await handler(uri);

    expect(channelMock.showChannelOutput).toHaveBeenCalled();
    expect(withProgressSpy).toHaveBeenCalled();
    expect(Agent).toHaveBeenCalledWith({
      connection: fakeConnection,
      project: { project: 'test' },
      nameOrId: 'SampleAgent'
    });
    expect(activateMock).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith('Agent "SampleAgent" was activated successfully.');
  });
});
