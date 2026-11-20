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
      singleRecordQuery: jest.fn().mockResolvedValue({ Id: '0XxD60000004Cj2KAE' }),
      metadata: { list: jest.fn().mockResolvedValue([]) }
    };
    jest.spyOn(vscode.workspace, 'findFiles').mockResolvedValue([]);
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
    expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
      'AiCopilot/copilotStudio.app#/copilot/builder?copilotId=0XxD60000004Cj2KAE'
    );
    expect(openExternalSpy).toHaveBeenCalledWith(
      'https://test.salesforce.com/secur/frontdoor.jsp?otp=xxx&startURL=yyy'
    );
  });

  it('shows error message when agent not found in org', async () => {
    mockConnection.singleRecordQuery.mockResolvedValue({ Id: null });
    registerOpenAgentInOrgCommand();
    await commandSpy.mock.calls[0][1]();

    expect(errorMessageSpy).toHaveBeenCalledWith('Agent "Agent1" not found in org.');
    expect(fakeTelemetryInstance.sendException).toHaveBeenCalledWith(
      'agent_not_found',
      'Agent "Agent1" not found in org'
    );
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
      expect.stringMatching(/\[error].*Couldn't find any agents in the current DX project/)
    );
    expect(fakeChannelService.appendLine).toHaveBeenCalledWith(
      expect.stringMatching(/\[debug].*Suggestion: Retrieve your agent metadata/)
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
    expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
      'AiCopilot/copilotStudio.app#/copilot/builder?copilotId=0XxD60000004Cj3KAE'
    );
    expect(openExternalSpy).toHaveBeenCalled();
  });

  describe('Agent Script detection', () => {
    const authoringUrl = 'AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=Agent1';

    it('opens the new builder from a local aiAuthoringBundles folder when the org listing is unavailable', async () => {
      mockConnection.metadata.list.mockRejectedValue(new Error('listing unavailable'));
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([
        { fsPath: '/ws/force-app/main/default/aiAuthoringBundles/Agent1/Agent1.agent' }
      ]);

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(vscode.workspace.findFiles).toHaveBeenCalledWith(
        '**/aiAuthoringBundles/Agent1*/*.agent',
        '**/node_modules/**'
      );
      expect(mockConnection.singleRecordQuery).not.toHaveBeenCalled();
      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(authoringUrl);
      expect(openExternalSpy).toHaveBeenCalled();
    });

    it('opens the new builder when only the org has an AiAuthoringBundle', async () => {
      mockConnection.metadata.list.mockResolvedValue([
        { fullName: 'Other_Agent', type: 'AiAuthoringBundle' },
        { fullName: 'Agent1', type: 'AiAuthoringBundle' }
      ]);

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockConnection.metadata.list).toHaveBeenCalledWith([{ type: 'AiAuthoringBundle' }]);
      expect(mockConnection.singleRecordQuery).not.toHaveBeenCalled();
      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(authoringUrl);
    });

    it('opens by project name only, never mapping a BotVersion/planner version to the bundle version', async () => {
      jest.spyOn(agentUtils, 'getAgentNameFromPath').mockResolvedValue('Agent1');
      mockConnection.metadata.list.mockResolvedValue([{ fullName: 'Agent1_2', type: 'AiAuthoringBundle' }]);

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]({
        fsPath: '/ws/genAiPlannerBundles/Agent1_v3.genAiPlannerBundle'
      } as vscode.Uri);

      const redirect = mockOrg.getFrontDoorUrl.mock.calls[0][0] as string;
      expect(redirect).toBe(authoringUrl);
      expect(redirect).not.toContain('projectVersionNumber');
      expect(redirect).not.toContain('v3');
    });

    it('opens the legacy builder when the org has no AiAuthoringBundle with this name', async () => {
      mockConnection.metadata.list.mockResolvedValue({ fullName: 'Other_Agent', type: 'AiAuthoringBundle' });

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
        'AiCopilot/copilotStudio.app#/copilot/builder?copilotId=0XxD60000004Cj2KAE'
      );
    });

    it('falls back to the legacy builder when the org bundle listing fails', async () => {
      mockConnection.metadata.list.mockRejectedValue(new Error('INVALID_TYPE: AiAuthoringBundle'));

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
        'AiCopilot/copilotStudio.app#/copilot/builder?copilotId=0XxD60000004Cj2KAE'
      );
    });

    it('falls back to the legacy builder when the org listing fails and findFiles throws', async () => {
      mockConnection.metadata.list.mockRejectedValue(new Error('listing unavailable'));
      (vscode.workspace.findFiles as jest.Mock).mockRejectedValue(new Error('no workspace'));

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
        'AiCopilot/copilotStudio.app#/copilot/builder?copilotId=0XxD60000004Cj2KAE'
      );
    });

    it('falls back to the legacy builder when the org bundle listing returns nothing', async () => {
      mockConnection.metadata.list.mockResolvedValue(undefined);

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockConnection.metadata.list).toHaveBeenCalled();
      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
        'AiCopilot/copilotStudio.app#/copilot/builder?copilotId=0XxD60000004Cj2KAE'
      );
    });

    it('detects the org bundle without searching local files', async () => {
      mockConnection.metadata.list.mockResolvedValue([{ fullName: 'Agent1', type: 'AiAuthoringBundle' }]);

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockConnection.metadata.list).toHaveBeenCalled();
      expect(vscode.workspace.findFiles).not.toHaveBeenCalled();
      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(authoringUrl);
    });

    it('opens the new builder for a script agent without querying BotDefinition or reporting not found', async () => {
      mockConnection.metadata.list.mockResolvedValue([{ fullName: 'Agent1', type: 'AiAuthoringBundle' }]);
      mockConnection.singleRecordQuery.mockResolvedValue({ Id: null });

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockConnection.singleRecordQuery).not.toHaveBeenCalled();
      expect(errorMessageSpy).not.toHaveBeenCalled();
      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(authoringUrl);
    });

    it('matches org bundle names exactly (case-sensitive)', async () => {
      mockConnection.metadata.list.mockResolvedValue([{ fullName: 'agent1', type: 'AiAuthoringBundle' }]);

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
        'AiCopilot/copilotStudio.app#/copilot/builder?copilotId=0XxD60000004Cj2KAE'
      );
    });

    it('falls back to the legacy builder when the org bundle is namespaced (known limitation)', async () => {
      mockConnection.metadata.list.mockResolvedValue([{ fullName: 'ns__Agent1', type: 'AiAuthoringBundle' }]);

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
        'AiCopilot/copilotStudio.app#/copilot/builder?copilotId=0XxD60000004Cj2KAE'
      );
    });

    it('shows an error when opening the new builder fails', async () => {
      mockConnection.metadata.list.mockResolvedValue([{ fullName: 'Agent1', type: 'AiAuthoringBundle' }]);
      mockOrg.getFrontDoorUrl.mockRejectedValue(new Error('Connection error'));

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(errorMessageSpy).toHaveBeenCalledWith('Unable to open agent: Connection error');
      expect(openExternalSpy).not.toHaveBeenCalled();
    });

    it('opens the new builder from a BotVersion file when the org has the bundle', async () => {
      jest.spyOn(agentUtils, 'getAgentNameFromPath').mockResolvedValue('Agent1');
      mockConnection.metadata.list.mockResolvedValue([{ fullName: 'Agent1', type: 'AiAuthoringBundle' }]);

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]({
        fsPath: '/ws/bots/Agent1/v2.botVersion-meta.xml'
      } as vscode.Uri);

      expect(quickPickSpy).not.toHaveBeenCalled();
      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(authoringUrl);
    });
    it('opens the new builder when the org only has versioned bundles (<Name>_<N>)', async () => {
      // Real orgs list one AiAuthoringBundle per version, e.g. Agentforce_Service_Assistant_2.._6
      mockConnection.metadata.list.mockResolvedValue([
        { fullName: 'Agent1_2', type: 'AiAuthoringBundle' },
        { fullName: 'Agent1_6', type: 'AiAuthoringBundle' }
      ]);

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockConnection.singleRecordQuery).not.toHaveBeenCalled();
      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(authoringUrl);
    });

    it("doesn't treat another agent's versioned bundle as a match", async () => {
      mockConnection.metadata.list.mockResolvedValue([
        { fullName: 'Agent1_nhalko_2', type: 'AiAuthoringBundle' },
        { fullName: 'Agent10_2', type: 'AiAuthoringBundle' }
      ]);

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
        'AiCopilot/copilotStudio.app#/copilot/builder?copilotId=0XxD60000004Cj2KAE'
      );
    });

    it('opens the new builder when the local bundle folder is versioned (<Name>_<N>) and the org is unreachable', async () => {
      mockConnection.metadata.list.mockRejectedValue(new Error('listing unavailable'));
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([
        { fsPath: '/ws/force-app/main/default/aiAuthoringBundles/Agent1_3/Agent1_3.agent' }
      ]);

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(authoringUrl);
    });

    it("ignores local bundle folders that only share the agent's name prefix", async () => {
      mockConnection.metadata.list.mockRejectedValue(new Error('listing unavailable'));
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([
        { fsPath: '/ws/aiAuthoringBundles/Agent10/Agent10.agent' },
        { fsPath: '/ws/aiAuthoringBundles/Agent1_nhalko_2/Agent1_nhalko_2.agent' }
      ]);

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockConnection.metadata.list).toHaveBeenCalled();
      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
        'AiCopilot/copilotStudio.app#/copilot/builder?copilotId=0XxD60000004Cj2KAE'
      );
    });
    it('treats the org listing as the authority: a local bundle not deployed to the default org opens the legacy path', async () => {
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([
        { fsPath: '/ws/aiAuthoringBundles/Agent1/Agent1.agent' }
      ]);
      mockConnection.metadata.list.mockResolvedValue([{ fullName: 'Other_Agent_1', type: 'AiAuthoringBundle' }]);
      mockConnection.singleRecordQuery.mockResolvedValue({ Id: null });

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(vscode.workspace.findFiles).not.toHaveBeenCalled();
      expect(mockOrg.getFrontDoorUrl).not.toHaveBeenCalled();
      expect(errorMessageSpy).toHaveBeenCalledWith('Agent "Agent1" not found in org.');
    });

    it('warns when the org listing fails', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockConnection.metadata.list.mockRejectedValue(new Error('boom'));

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(warnSpy).toHaveBeenCalledWith('Failed to list AiAuthoringBundle metadata in the org:', 'boom');
    });

    it('treats a hung org listing as unknown after the timeout and falls back to the local bundle', async () => {
      jest.useFakeTimers();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockConnection.metadata.list.mockReturnValue(new Promise(() => undefined));
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([
        { fsPath: '/ws/aiAuthoringBundles/Agent1/Agent1.agent' }
      ]);
      try {
        registerOpenAgentInOrgCommand();
        const run = commandSpy.mock.calls[0][1]();
        await jest.advanceTimersByTimeAsync(agentUtils.LIST_TIMEOUT_MS);
        await run;
      } finally {
        jest.useRealTimers();
      }

      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to list AiAuthoringBundle metadata in the org:',
        'Timed out listing AiAuthoringBundle metadata'
      );
      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(authoringUrl);
    });

    it('warns when searching for local bundles fails', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockConnection.metadata.list.mockRejectedValue(new Error('listing unavailable'));
      (vscode.workspace.findFiles as jest.Mock).mockRejectedValue(new Error('no workspace'));

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(warnSpy).toHaveBeenCalledWith('Failed to search for local authoring bundles:', 'no workspace');
    });

    it('routes a legacy bot named like a bundle version (Sales_2) to the legacy builder', async () => {
      quickPickSpy.mockResolvedValue('Sales_2' as any);
      // Script agent "Sales" with versions 1 and 2 shares an org with a legacy bot "Sales_2"
      mockConnection.metadata.list.mockResolvedValue([
        { fullName: 'Sales_1', type: 'AiAuthoringBundle' },
        { fullName: 'Sales_2', type: 'AiAuthoringBundle' }
      ]);

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockConnection.singleRecordQuery).toHaveBeenCalledWith(
        "SELECT Id FROM BotDefinition WHERE DeveloperName='Sales_2'",
        { tooling: false }
      );
      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
        'AiCopilot/copilotStudio.app#/copilot/builder?copilotId=0XxD60000004Cj2KAE'
      );
    });

    it('still opens the new builder for a script agent whose name ends in _<digits> when it has versions', async () => {
      quickPickSpy.mockResolvedValue('Sales_2' as any);
      mockConnection.metadata.list.mockResolvedValue([{ fullName: 'Sales_2_1', type: 'AiAuthoringBundle' }]);

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
        'AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=Sales_2'
      );
    });

    it('routes a legacy bot Sales_2 to the legacy builder when only a local Sales_2 folder exists (fallback path)', async () => {
      quickPickSpy.mockResolvedValue('Sales_2' as any);
      mockConnection.metadata.list.mockRejectedValue(new Error('listing unavailable'));
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([
        { fsPath: '/ws/aiAuthoringBundles/Sales_2/Sales_2.agent' }
      ]);

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(mockOrg.getFrontDoorUrl).toHaveBeenCalledWith(
        'AiCopilot/copilotStudio.app#/copilot/builder?copilotId=0XxD60000004Cj2KAE'
      );
    });

    it('skips the local search for names with glob metacharacters', async () => {
      quickPickSpy.mockResolvedValue('Agent*' as any);
      mockConnection.metadata.list.mockRejectedValue(new Error('listing unavailable'));

      registerOpenAgentInOrgCommand();
      await commandSpy.mock.calls[0][1]();

      expect(vscode.workspace.findFiles).not.toHaveBeenCalled();
    });
  });

  describe('isAuthoringBundleFor', () => {
    it.each([
      ['Agent1', 'Agent1', true],
      ['Agent1_2', 'Agent1', true],
      ['Agent1_12', 'Agent1', true],
      ['Agent1_', 'Agent1', false],
      ['Agent1_v2', 'Agent1', false],
      ['Agent1_nhalko_2', 'Agent1', false],
      ['Agent10', 'Agent1', false],
      ['Agent1_nhalko_2', 'Agent1_nhalko', true],
      ['agent1_2', 'Agent1', false]
    ])('%s is a bundle for %s: %s', (bundleName, agentName, expected) => {
      expect(agentUtils.isAuthoringBundleFor(bundleName, agentName)).toBe(expected);
    });
  });

  describe('builder URL helpers', () => {
    it('URL-encodes the project name for the new builder', () => {
      expect(agentUtils.getAuthoringBuilderRedirectUri('A&B #1')).toBe(
        'AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=A%26B%20%231'
      );
    });

    it('builds the legacy builder URL from the bot id', () => {
      expect(agentUtils.getLegacyBuilderRedirectUri('0XxD60000004Cj2KAE')).toBe(
        'AiCopilot/copilotStudio.app#/copilot/builder?copilotId=0XxD60000004Cj2KAE'
      );
    });
  });
});
