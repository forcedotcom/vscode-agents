import * as vscode from 'vscode';
import * as path from 'path';
import { Commands } from '../enums/commands';
import { SfProject, ConfigAggregator, Org } from '@salesforce/core-bundle';
import { Agent } from '@salesforce/agents-bundle';
import { CoreExtensionService } from '../services/coreExtensionService';
import { getAgentNameFromPath, getAgentNameFromFile } from './agentUtils';

export const registerDeactivateAgentCommand = () => {
  return vscode.commands.registerCommand(Commands.deactivateAgent, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const channelService = CoreExtensionService.getChannelService();
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
        if (!fileName.endsWith('.bot-meta.xml') && !fileName.endsWith('.botVersion-meta.xml') && !fileName.endsWith('.genAiPlannerBundle')) {
          vscode.window.showErrorMessage('This command can only be used on bot, bot version, or genAiPlannerBundle files.');
          return;
        }
      } else if (stat.type === vscode.FileType.Directory) {
        // For directories, we accept them if they're in a bots or botVersions path structure
        if (!targetPath.includes('bots') && !targetPath.includes('botVersions') && !targetPath.includes('genAiPlannerBundles')) {
          vscode.window.showErrorMessage('This command can only be used on directories containing bot, bot version, or genAiPlannerBundle files.');
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

      channelService.appendLine(`Deactivating agent: ${agentName}`);
      channelService.showChannelOutput();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Deactivating agent: ${agentName}`,
          cancellable: false
        },
        async () => {
          // Get connection to the org
          const configAggregator = await ConfigAggregator.create();
          const org = await Org.create({
            aliasOrUsername: configAggregator.getPropertyValue<string>('target-org') ?? 'undefined'
          });

          // Create Agent instance and deactivate it
          const agent = new Agent({
            connection: org.getConnection(),
            project,
            nameOrId: agentName
          });

          await agent.deactivate();

          channelService.appendLine(`Successfully deactivated agent: ${agentName}`);
          vscode.window.showInformationMessage(`Agent "${agentName}" has been deactivated successfully.`);
        }
      );
    } catch (error) {
      const errorMessage = `Failed to deactivate agent: ${(error as Error).message}`;
      channelService.appendLine(errorMessage);
      vscode.window.showErrorMessage(errorMessage);
      telemetryService.sendException('agent_deactivation_failed', errorMessage);
    }
  });
};

