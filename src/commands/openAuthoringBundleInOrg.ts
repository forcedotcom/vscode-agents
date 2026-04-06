import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { SfProject, ConfigAggregator, Org } from '@salesforce/core';
import { Agent } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { getAgentNameFromPath } from './agentUtils';
import { Logger } from '../utils/logger';

export const registerOpenAuthoringBundleInOrgCommand = () => {
  return vscode.commands.registerCommand(Commands.openAuthoringBundleInOrg, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const logger = new Logger(CoreExtensionService.getChannelService());
    const commandName = Commands.openAuthoringBundleInOrg;
    const hrstart = process.hrtime();
    telemetryService?.sendCommandEvent(commandName, hrstart, { commandName });

    let agentName: string | undefined;

    // If called from context menu with a file/directory, use that to determine the agent
    if (uri?.fsPath) {
      try {
        agentName = await getAgentNameFromPath(uri.fsPath);
      } catch (error) {
        console.warn('Failed to get agent name from path, falling back to picker:', error);
      }
    }

    // If no agent name from context, prompt user to select
    if (!agentName) {
      const project = SfProject.getInstance();
      const agents = await Agent.list(project);
      if (agents.length === 0) {
        vscode.window.showErrorMessage(`Couldn't find any agents in the current DX project.`);
        logger.error("Couldn't find any agents in the current DX project.");
        logger.debug(
          'Suggestion: Retrieve your agent metadata to your DX project with the "project retrieve start" CLI command.'
        );
        return;
      }
      // we need to prompt the user which agent to open
      agentName = await vscode.window.showQuickPick(agents, { placeHolder: 'Agent name (type to search)' });

      if (!agentName) {
        telemetryService?.sendException('no_agent_selected', 'No Agent selected');
        return;
      }
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Open Agent in Org',
        cancellable: true
      },
      async progress => {
        progress.report({ message: `Opening ${agentName}` });

        try {
          // Get org connection
          const configAggregator = await ConfigAggregator.create();
          const targetOrg = configAggregator.getPropertyValue<string>('target-org');

          if (!targetOrg) {
            vscode.window.showErrorMessage('No default org configured. Set a target org with "sf config set target-org".');
            logger.error('No default org configured.');
            telemetryService?.sendException('no_target_org', 'No default org configured');
            return;
          }

          const org = await Org.create({ aliasOrUsername: targetOrg });

          // For aiAuthoringBundles (.agent files), use the agent authoring builder URL
          // URL format: AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=AgentName
          const redirectUri = `AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=${agentName}`;

          // Generate frontdoor URL with authentication
          const frontdoorUrl = await org.getFrontDoorUrl(redirectUri);

          // Open in browser using VS Code
          // Cast to any to prevent VS Code from parsing/encoding the URL
          // This preserves the already-encoded URL exactly as-is
          await vscode.env.openExternal(frontdoorUrl as any); // doesn't change string

          vscode.window.showInformationMessage('Agent opened successfully in the default org.');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Unable to open agent: ${errorMessage}`);
          logger.error(`Unable to open agent: ${errorMessage}`);
          telemetryService?.sendException('open_agent_authoring_failed', errorMessage);
        }
      }
    );
  });
};
