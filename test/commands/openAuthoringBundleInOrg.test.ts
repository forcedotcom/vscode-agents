import * as vscode from 'vscode';
import { registerOpenAuthoringBundleInOrgCommand } from '../../src/commands/openAuthoringBundleInOrg';
import { Commands } from '../../src/enums/commands';
import { SfProject, ConfigAggregator, Org } from '@salesforce/core';
import { CoreExtensionService } from '../../src/services/coreExtensionService';
import { Agent } from '@salesforce/agents';
import * as agentUtils from '../../src/commands/agentUtils';

describe('registerOpenAuthoringBundleInOrgCommand', () => {
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
      instanceUrl: 'https://test.salesforce.com'
    };
    mockConfigAggregator = {
      getPropertyValue: jest.fn().mockReturnValue('test-org')
    };
    mockOrg = {
      getConnection: jest.fn().mockReturnValue(mockConnection),
      getFrontDoorUrl: jest
        .fn()
        .mockResolvedValue('https://test.salesforce.com/secur/frontdoor.jsp?otp=xxx&startURL=yyy')
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
    registerOpenAuthoringBundleInOrgCommand();
    expect(commandSpy).toHaveBeenCalledWith(Commands.openAuthoringBundleInOrg, expect.any(Function));
  });

  it('opens selected agent authoring bundle in org', async () => {
    registerOpenAuthoringBundleInOrgCommand();
    await commandSpy.mock.calls[0][1]();

    expect(progressSpy).toHaveBeenCalled();
    expect(projectSpy).toHaveBeenCalled();
    expect(quickPickSpy).toHaveBeenCalledWith(['Agent1', 'Agent2'], { placeHolder: 'Agent name (type to search)' });
    expect(configAggregatorSpy).toHaveBeenCalled();
    expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
      'AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=Agent1'
    );
    expect(openExternalSpy).toHaveBeenCalledWith(
      'https://test.salesforce.com/secur/frontdoor.jsp?otp=xxx&startURL=yyy'
    );
  });

  it('shows error message when opening agent fails', async () => {
    mockOrg.getFrontDoorUrl.mockRejectedValue(new Error('Connection error'));
    registerOpenAuthoringBundleInOrgCommand();
    await commandSpy.mock.calls[0][1]();

    expect(errorMessageSpy).toHaveBeenCalledWith('Unable to open agent: Connection error');
    expect(fakeTelemetryInstance.sendException).toHaveBeenCalledWith('open_agent_authoring_failed', 'Connection error');
  });

  it('uses agent name from path when uri is provided', async () => {
    jest.spyOn(agentUtils, 'getAgentNameFromPath').mockResolvedValue('MyAgent');

    const mockUri = { fsPath: '/path/to/aiAuthoringBundles/MyAgent/MyAgent.agent' } as vscode.Uri;

    registerOpenAuthoringBundleInOrgCommand();
    await commandSpy.mock.calls[0][1](mockUri);

    expect(agentUtils.getAgentNameFromPath).toHaveBeenCalledWith('/path/to/aiAuthoringBundles/MyAgent/MyAgent.agent');
    expect(quickPickSpy).not.toHaveBeenCalled();
    expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
      'AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=MyAgent'
    );
    expect(openExternalSpy).toHaveBeenCalled();
  });

  it('opens by project name only, without a version parameter', async () => {
    quickPickSpy.mockResolvedValue('My Agent/1');

    registerOpenAuthoringBundleInOrgCommand();
    await commandSpy.mock.calls[0][1]();

    const redirect = mockOrg.getFrontDoorUrl.mock.calls[0][0] as string;
    expect(redirect).toBe('AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=My%20Agent%2F1');
    expect(redirect).not.toContain('projectVersionNumber');
  });

  it('opens the bundle version named by a versioned aiAuthoringBundles folder', async () => {
    jest.spyOn(agentUtils, 'getAgentNameFromPath').mockResolvedValue('Agent_Frank_3');

    const mockUri = { fsPath: '/path/to/aiAuthoringBundles/Agent_Frank_3/Agent_Frank_3.agent' } as vscode.Uri;

    registerOpenAuthoringBundleInOrgCommand();
    await commandSpy.mock.calls[0][1](mockUri);

    expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
      'AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=Agent_Frank&projectVersionNumber=3'
    );
    expect(quickPickSpy).not.toHaveBeenCalled();
  });

  it('does not treat a picked bot name ending in digits as a version', async () => {
    quickPickSpy.mockResolvedValue('Sales_2' as any);

    registerOpenAuthoringBundleInOrgCommand();
    await commandSpy.mock.calls[0][1]();

    expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
      'AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=Sales_2'
    );
  });

  it('falls back to the picker without a version when the path cannot be resolved', async () => {
    jest.spyOn(agentUtils, 'getAgentNameFromPath').mockRejectedValue(new Error('Invalid path'));
    jest.spyOn(console, 'warn').mockImplementation();

    registerOpenAuthoringBundleInOrgCommand();
    await commandSpy.mock.calls[0][1]({ fsPath: '/path/to/aiAuthoringBundles/Agent_Frank_3' } as vscode.Uri);

    expect(quickPickSpy).toHaveBeenCalled();
    expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
      'AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=Agent1'
    );
  });

  it('shows error when no agents found in project', async () => {
    jest.spyOn(Agent, 'list').mockResolvedValue([]);

    registerOpenAuthoringBundleInOrgCommand();
    await commandSpy.mock.calls[0][1]();

    expect(errorMessageSpy).toHaveBeenCalledWith("Couldn't find any agents in the current DX project.");
    expect(progressSpy).not.toHaveBeenCalled();
  });

  it('handles user canceling agent selection', async () => {
    quickPickSpy.mockResolvedValue(undefined);

    registerOpenAuthoringBundleInOrgCommand();
    await commandSpy.mock.calls[0][1]();

    expect(fakeTelemetryInstance.sendException).toHaveBeenCalledWith('no_agent_selected', 'No Agent selected');
    expect(progressSpy).not.toHaveBeenCalled();
  });
});
