import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { SfProject, ConfigAggregator, Org } from '@salesforce/core';
import { Agent } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { getAgentNameFromPath } from './agentUtils';
import { Logger } from '../utils/logger';

export const registerOpenAgentInOrgCommand = () => {
  return vscode.commands.registerCommand(Commands.openAgentInOrg, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const logger = new Logger(CoreExtensionService.getChannelService());
    const commandName = Commands.openAgentInOrg;
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
        cancellable: true
      },
      async progress => {
        progress.report({ message: 'Opening agent in the default org...' });

        try {
          // Get org connection
          const configAggregator = await ConfigAggregator.create();
          const org = await Org.create({
            aliasOrUsername: configAggregator.getPropertyValue<string>('target-org') ?? 'undefined'
          });
          const conn = org.getConnection();

          // Query BotDefinition to get the Bot ID (same as CLI does)
          const query = `SELECT Id FROM BotDefinition WHERE DeveloperName='${agentName}'`;
          const result = await conn.singleRecordQuery<{ Id: string }>(query, { tooling: false });

          if (!result?.Id) {
            vscode.window.showErrorMessage(`Agent "${agentName}" not found in org.`);
            logger.error(`Agent "${agentName}" not found in org.`);
            logger.debug(
              'Suggestion: Ensure the agent is deployed to your org with the "project deploy start" CLI command.'
            );
            telemetryService?.sendException('agent_not_found', `Agent "${agentName}" not found in org`);
            return;
          }

          const botId = result.Id;

          // Construct the Agent Builder redirect URL (same as CLI)
          const redirectUri = `AiCopilot/copilotStudio.app#/copilot/builder?copilotId=${botId}`;

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
          telemetryService?.sendException('open_agent_failed', errorMessage);
        }
      }
    );
  });
};
