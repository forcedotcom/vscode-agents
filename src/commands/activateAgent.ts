import * as vscode from 'vscode';
import * as path from 'path';
import { Commands } from '../enums/commands';
import { SfProject, ConfigAggregator, Org } from '@salesforce/core';
import { Agent } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { getAgentNameFromPath } from './agentUtils';

export const registerActivateAgentCommand = () => {
  return vscode.commands.registerCommand(Commands.activateAgent, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const channelService = CoreExtensionService.getChannelService();
    telemetryService.sendCommandEvent(Commands.activateAgent);

    // Get the file or directory path from the context menu
    const targetPath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName;

    if (!targetPath) {
      vscode.window.showErrorMessage('No agent file or directory selected.');
      return;
    }

    try {
      // Check if it's a valid target (file or directory)
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(targetPath));
      const fileName = path.basename(targetPath);

      // Validate that this is a supported context
      if (stat.type === vscode.FileType.File) {
        if (
          !fileName.endsWith('.bot-meta.xml') &&
          !fileName.endsWith('.botVersion-meta.xml') &&
          !fileName.endsWith('.genAiPlannerBundle')
        ) {
          vscode.window.showErrorMessage(
            'You can use this command on only bot, botVersion, or genAiPlannerBundle metadata files.'
          );
          return;
        }
      } else if (stat.type === vscode.FileType.Directory) {
        // For directories, we accept them if they're in a bots or botVersions path structure
        if (
          !targetPath.includes('bots') &&
          !targetPath.includes('botVersions') &&
          !targetPath.includes('genAiPlannerBundles')
        ) {
          vscode.window.showErrorMessage(
            'You can use this command on only directories that contain bot, botVersion, or genAiPlannerBundle metadata files.'
          );
          return;
        }
      } else {
        vscode.window.showErrorMessage('Invalid file or directory selection.');
        return;
      }

      const project = SfProject.getInstance();
      const agentName = await getAgentNameFromPath(targetPath);

      channelService.appendLine(`Activating agent ${agentName}...`);
      channelService.showChannelOutput();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Activating agent: ${agentName}...`,
          cancellable: false
        },
        async () => {
          // Get connection to the org
          const configAggregator = await ConfigAggregator.create();
          const org = await Org.create({
            aliasOrUsername: configAggregator.getPropertyValue<string>('target-org') ?? 'undefined'
          });

          // Create Agent instance and activate it
          // For published agents, filePath is optional
          const agent = await Agent.init({
            connection: org.getConnection() as any,
            project: project as any,
            apiNameOrId: agentName
          });

          await agent.activate();

          channelService.appendLine(`Successfully activated agent ${agentName}.`);
          vscode.window.showInformationMessage(`Agent "${agentName}" was activated successfully.`);
        }
      );
    } catch (error) {
      const errorMessage = `Failed to activate agent: ${(error as Error).message}`;
      channelService.appendLine(errorMessage);
      vscode.window.showErrorMessage(errorMessage);
      telemetryService.sendException('agent_activation_failed', errorMessage);
    }
  });
};
