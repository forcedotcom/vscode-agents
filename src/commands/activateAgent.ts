import * as vscode from 'vscode';
import * as path from 'path';
import { Commands } from '../enums/commands';
import { SfProject, ConfigAggregator, Org } from '@salesforce/core-bundle';
import { Agent } from '@salesforce/agents-bundle';
import { CoreExtensionService } from '../services/coreExtensionService';
import { getAgentNameFromPath, getAgentNameFromFile } from './agentUtils';

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
        if (!fileName.endsWith('.bot-meta.xml') && !fileName.endsWith('.botVersion-meta.xml')) {
          vscode.window.showErrorMessage('This command can only be used on bot or bot version metadata files.');
          return;
        }
      } else if (stat.type === vscode.FileType.Directory) {
        // For directories, we accept them if they're in a bots or botVersions path structure
        if (!targetPath.includes('bots') && !targetPath.includes('botVersions')) {
          vscode.window.showErrorMessage('This command can only be used on directories containing bot files.');
          return;
        }
      } else {
        vscode.window.showErrorMessage('Invalid file or directory selection.');
        return;
      }

      const project = SfProject.getInstance();
      const agentName = await getAgentNameFromPath(targetPath);

      channelService.appendLine(`Activating agent: ${agentName}`);
      channelService.showChannelOutput();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Activating agent: ${agentName}`,
          cancellable: false
        },
        async () => {
          // Get connection to the org
          const configAggregator = await ConfigAggregator.create();
          const org = await Org.create({
            aliasOrUsername: configAggregator.getPropertyValue<string>('target-org') ?? 'undefined'
          });

          // Create Agent instance and activate it
          const agent = new Agent({
            connection: org.getConnection(),
            project: project,
            nameOrId: agentName
          });

          await agent.activate();

          channelService.appendLine(`Successfully activated agent: ${agentName}`);
          vscode.window.showInformationMessage(`Agent "${agentName}" has been activated successfully.`);
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

