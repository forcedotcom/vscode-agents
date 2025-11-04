import * as vscode from 'vscode';
import { registerOpenAgentInOrgCommand } from '../../src/commands/openAgentInOrg';
import { Commands } from '../../src/enums/commands';
import { SfProject } from '@salesforce/core';
import { sync } from 'cross-spawn';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { Agent } from '@salesforce/agents';
import * as agentUtils from '../../src/commands/agentUtils';

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
  const fakeChannelService: any = {
    appendLine: jest.fn()
  };
  beforeEach(() => {
    jest.spyOn(CoreExtensionService, 'getTelemetryService').mockReturnValue(fakeTelemetryInstance);
    jest.spyOn(CoreExtensionService, 'getChannelService').mockReturnValue(fakeChannelService);

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

  it('handles error when getting agent name from path', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(agentUtils, 'getAgentNameFromPath').mockRejectedValue(new Error('Invalid path'));

    const mockUri = { fsPath: '/invalid/path.agent' } as vscode.Uri;

    registerOpenAgentInOrgCommand();
    await commandSpy.mock.calls[0][1](mockUri);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to get agent name from path, falling back to picker:',
      expect.any(Error)
    );
    expect(quickPickSpy).toHaveBeenCalled(); // Falls back to picker

    consoleWarnSpy.mockRestore();
  });

  it('shows error when no agents found in project', async () => {
    jest.spyOn(Agent, 'list').mockResolvedValue([]);

    registerOpenAgentInOrgCommand();
    await commandSpy.mock.calls[0][1]();

    expect(errorMessageSpy).toHaveBeenCalledWith('Could not find agents in the current project.');
    expect(fakeChannelService.appendLine).toHaveBeenCalledWith('Could not find agents in the current project.');
    expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
      'Suggestion: retrieve your agents (Bot) metadata locally.'
    );
    expect(progressSpy).not.toHaveBeenCalled(); // Should not proceed
  });

  it('handles user canceling agent selection', async () => {
    quickPickSpy.mockResolvedValue(undefined); // User cancels

    registerOpenAgentInOrgCommand();
    await commandSpy.mock.calls[0][1]();

    expect(fakeTelemetryInstance.sendException).toHaveBeenCalledWith('no_agent_selected', 'No Agent selected');
    expect(progressSpy).not.toHaveBeenCalled(); // Should not proceed
  });

  it('uses agent name from path when uri is provided', async () => {
    jest.spyOn(agentUtils, 'getAgentNameFromPath').mockResolvedValue('AgentFromPath');

    const mockUri = { fsPath: '/path/to/AgentFromPath.agent' } as vscode.Uri;

    registerOpenAgentInOrgCommand();
    await commandSpy.mock.calls[0][1](mockUri);

    expect(agentUtils.getAgentNameFromPath).toHaveBeenCalledWith('/path/to/AgentFromPath.agent');
    expect(quickPickSpy).not.toHaveBeenCalled(); // Should not show picker
    expect(sync).toHaveBeenCalledWith('sf', ['org', 'open', 'agent', '--name', 'AgentFromPath']);
  });
});
