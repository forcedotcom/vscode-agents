import * as vscode from 'vscode';
import * as path from 'path';
import { Commands } from '../enums/commands';
import { SfProject, ConfigAggregator, Org } from '@salesforce/core';
import { Agent } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { getAgentNameFromPath } from './agentUtils';
import { Logger } from '../utils/logger';

export const registerDeactivateAgentCommand = () => {
  return vscode.commands.registerCommand(Commands.deactivateAgent, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const logger = new Logger(CoreExtensionService.getChannelService());
    telemetryService.sendCommandEvent(Commands.deactivateAgent);

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

      // Confirm deactivation with user
      const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to deactivate agent "${agentName}"?`,
        { modal: true },
        'Deactivate'
      );

      if (confirmation !== 'Deactivate') {
        return;
      }

      // Clear previous output and show channel
      logger.clear();
      logger.show();
      
      logger.debug(`Deactivating agent ${agentName}...`);

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Deactivating agent: ${agentName}...`,
          cancellable: false
        },
        async () => {
          // Get connection to the org
          const configAggregator = await ConfigAggregator.create();
          const org = await Org.create({
            aliasOrUsername: configAggregator.getPropertyValue<string>('target-org') ?? 'undefined'
          });

          // Create Agent instance and deactivate it
          // For published agents, filePath is optional
          const agent = await Agent.init({
            connection: org.getConnection() as any,
            project: project as any,
            apiNameOrId: agentName
          });

          await agent.deactivate();

          logger.debug(`Successfully deactivated agent ${agentName}.`);
          vscode.window.showInformationMessage(`Agent "${agentName}" was deactivated successfully.`);
        }
      );
    } catch (error) {
      const errorMessage = `Failed to deactivate agent: ${(error as Error).message}`;
      logger.error(errorMessage, error);
      logger.show();
      vscode.window.showErrorMessage(errorMessage);
      telemetryService.sendException('agent_deactivation_failed', errorMessage);
    }
  });
};
