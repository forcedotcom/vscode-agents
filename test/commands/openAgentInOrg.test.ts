import * as vscode from 'vscode';
import { registerOpenAgentInOrgCommand } from '../../src/commands/openAgentInOrg';
import { Commands } from '../../src/enums/commands';
import { SfProject, ConfigAggregator, Org } from '@salesforce/core';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { Agent } from '@salesforce/agents';
import * as agentUtils from '../../src/commands/agentUtils';

describe('registerOpenAgentInOrgCommand', () => {
  let commandSpy: jest.SpyInstance;
  let projectSpy: jest.SpyInstance;
  let quickPickSpy: jest.SpyInstance;
  let progressSpy: jest.SpyInstance;
  let errorMessageSpy: jest.SpyInstance;
  let openExternalSpy: jest.SpyInstance;
  let configAggregatorSpy: jest.SpyInstance;
  let orgCreateSpy: jest.SpyInstance;

  const fakeTelemetryInstance: any = {
    sendException: jest.fn(),
    sendCommandEvent: jest.fn()
  };
  const fakeChannelService: any = {
    appendLine: jest.fn(),
    showChannelOutput: jest.fn(),
    clear: jest.fn()
  };
  let mockConnection: any;
  let mockConfigAggregator: any;
  let mockOrg: any;

  beforeEach(() => {
    // Reset mocks
    mockConnection = {
      instanceUrl: 'https://test.salesforce.com',
      singleRecordQuery: jest.fn().mockResolvedValue({ Id: '0XxD60000004Cj2KAE' })
    };
    mockConfigAggregator = {
      getPropertyValue: jest.fn().mockReturnValue('test-org')
    };
    mockOrg = {
      getConnection: jest.fn().mockReturnValue(mockConnection),
      getFrontDoorUrl: jest.fn().mockResolvedValue('https://test.salesforce.com/secur/frontdoor.jsp?otp=xxx&startURL=yyy')
    };

    jest.spyOn(CoreExtensionService, 'getTelemetryService').mockReturnValue(fakeTelemetryInstance);
    jest.spyOn(CoreExtensionService, 'getChannelService').mockReturnValue(fakeChannelService);

    configAggregatorSpy = jest.spyOn(ConfigAggregator, 'create').mockResolvedValue(mockConfigAggregator as any);
    orgCreateSpy = jest.spyOn(Org, 'create').mockResolvedValue(mockOrg as any);

    jest.spyOn(Agent, 'list').mockResolvedValue(['Agent1', 'Agent2']);

    commandSpy = jest.spyOn(vscode.commands, 'registerCommand');
    projectSpy = jest.spyOn(SfProject, 'getInstance').mockReturnValue({
      getDefaultPackage: jest.fn().mockReturnValue({ fullPath: '/fake/path' })
    } as unknown as SfProject);
    quickPickSpy = jest.spyOn(vscode.window, 'showQuickPick').mockResolvedValue('Agent1' as any);
    errorMessageSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockImplementation();
    openExternalSpy = jest.spyOn(vscode.env, 'openExternal').mockResolvedValue(true);
    progressSpy = jest
      .spyOn(vscode.window, 'withProgress')
      .mockImplementation((_options, task) => task({ report: jest.fn() }, {} as vscode.CancellationToken));
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
    expect(configAggregatorSpy).toHaveBeenCalled();
    expect(mockConfigAggregator.getPropertyValue).toHaveBeenCalledWith('target-org');
    expect(orgCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ aliasOrUsername: expect.any(String) }));
    expect(mockConnection.singleRecordQuery).toHaveBeenCalledWith(
      "SELECT Id FROM BotDefinition WHERE DeveloperName='Agent1'",
      { tooling: false }
    );
    expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith('AiCopilot/copilotStudio.app#/copilot/builder?copilotId=0XxD60000004Cj2KAE');
    expect(openExternalSpy).toHaveBeenCalledWith('https://test.salesforce.com/secur/frontdoor.jsp?otp=xxx&startURL=yyy');
  });

  it('shows error message when agent not found in org', async () => {
    mockConnection.singleRecordQuery.mockResolvedValue({ Id: null });
    registerOpenAgentInOrgCommand();
    await commandSpy.mock.calls[0][1]();

    expect(errorMessageSpy).toHaveBeenCalledWith('Agent "Agent1" not found in org.');
    expect(fakeTelemetryInstance.sendException).toHaveBeenCalledWith('agent_not_found', 'Agent "Agent1" not found in org');
  });

  it('shows error message when opening agent fails', async () => {
    mockOrg.getFrontDoorUrl.mockRejectedValue(new Error('Connection error'));
    registerOpenAgentInOrgCommand();
    await commandSpy.mock.calls[0][1]();

    expect(errorMessageSpy).toHaveBeenCalledWith('Unable to open agent: Connection error');
    expect(fakeTelemetryInstance.sendException).toHaveBeenCalledWith('open_agent_failed', 'Connection error');
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

    expect(errorMessageSpy).toHaveBeenCalledWith("Couldn't find any agents in the current DX project.");
    expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
      expect.stringMatching(/\[error\].*Couldn't find any agents in the current DX project/)
    );
    expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
      expect.stringMatching(/\[debug\].*Suggestion: Retrieve your agent metadata/)
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
    jest.spyOn(agentUtils, 'getAgentNameFromPath').mockResolvedValue('Agent2');
    mockConnection.singleRecordQuery.mockResolvedValue({ Id: '0XxD60000004Cj3KAE' });

    const mockUri = { fsPath: '/path/to/Agent2.bot-meta.xml' } as vscode.Uri;

    registerOpenAgentInOrgCommand();
    await commandSpy.mock.calls[0][1](mockUri);

    expect(agentUtils.getAgentNameFromPath).toHaveBeenCalledWith('/path/to/Agent2.bot-meta.xml');
    expect(quickPickSpy).not.toHaveBeenCalled(); // Should not show picker
    expect(mockConnection.singleRecordQuery).toHaveBeenCalledWith(
      "SELECT Id FROM BotDefinition WHERE DeveloperName='Agent2'",
      { tooling: false }
    );
    expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith('AiCopilot/copilotStudio.app#/copilot/builder?copilotId=0XxD60000004Cj3KAE');
    expect(openExternalSpy).toHaveBeenCalled();
  });
});
