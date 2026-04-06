import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { CoreExtensionService } from '../services/coreExtensionService';
import { getAgentNameFromPath, selectAgentFromProject, getConnectionAndProject, handleCommandError } from './agentUtils';
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
      agentName = await selectAgentFromProject(logger, telemetryService);
      if (!agentName) {
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
          const { org } = await getConnectionAndProject();

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
          handleCommandError(error, 'Unable to open agent', 'open_agent_authoring_failed', logger, telemetryService);
        }
      }
    );
  });
};
