import * as vscode from 'vscode';
import { registerOpenAgentInOrgCommand } from '../../src/commands/openAgentInOrg';
import { Commands } from '../../src/enums/commands';
import { SfProject } from '@salesforce/core-bundle';
import { sync } from 'cross-spawn';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { Agent } from '@salesforce/agents-bundle';

jest.mock('cross-spawn', () => ({
  sync: jest.fn()
}));

describe('registerOpenAgentInOrgCommand', () => {
  let commandSpy: jest.SpyInstance;
  let projectSpy: jest.SpyInstance;
  let quickPickSpy: jest.SpyInstance;
  let progressSpy: jest.SpyInstance;
  let errorMessageSpy: jest.SpyInstance;
  const fakeTelemetryInstance: any = {
    sendException: jest.fn(),
    sendCommandEvent: jest.fn()
  };
  beforeEach(() => {
    jest.spyOn(CoreExtensionService, 'getTelemetryService').mockReturnValue(fakeTelemetryInstance);
    // @ts-ignore
    jest.spyOn(CoreExtensionService, 'getChannelService').mockReturnValue({});

    jest.spyOn(Agent, 'list').mockResolvedValue(['Agent1', 'Agent2']);

    commandSpy = jest.spyOn(vscode.commands, 'registerCommand');
    projectSpy = jest.spyOn(SfProject, 'getInstance').mockReturnValue({
      getDefaultPackage: jest.fn().mockReturnValue({ fullPath: '/fake/path' })
    } as unknown as SfProject);
    quickPickSpy = jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue([{ title: 'Agent1' }] as any);
    errorMessageSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockImplementation();
    progressSpy = jest
      .spyOn(vscode.window, 'withProgress')
      .mockImplementation((_options, task) => task({ report: jest.fn() }, {} as vscode.CancellationToken));
    (sync as jest.Mock).mockReturnValue({ status: 0 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers the command', () => {
    registerOpenAgentInOrgCommand();
    expect(commandSpy).toHaveBeenCalledWith(Commands.openAgentInOrg, expect.any(Function));
  });

  it('opens selected agent in org', async () => {
    registerOpenAgentInOrgCommand();
    await commandSpy.mock.calls[0][1]();

    expect(progressSpy).toHaveBeenCalled();
    expect(projectSpy).toHaveBeenCalled();
    expect(quickPickSpy).toHaveBeenCalledWith(['Agent1', 'Agent2'], { placeHolder: 'Agent name (type to search)' });
    expect(sync).toHaveBeenCalledWith('sf', ['org', 'open', 'agent', '--name', [{ title: 'Agent1' }]]);
  });

  it('shows error message when command fails', async () => {
    (sync as jest.Mock).mockReturnValue({ status: 1, stderr: Buffer.from('Error opening agent') });
    registerOpenAgentInOrgCommand();
    await commandSpy.mock.calls[0][1]();

    expect(errorMessageSpy).toHaveBeenCalledWith('Unable to open agent: Error opening agent');
  });
});
