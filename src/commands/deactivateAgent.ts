import * as vscode from 'vscode';
import * as path from 'path';
import { Commands } from '../enums/commands';
import { SfError } from '@salesforce/core';
import { Agent } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { getAgentNameFromPath, getConnectionAndProject, getPublishedAgents } from './agentUtils';
import { Logger } from '../utils/logger';

export const registerDeactivateAgentCommand = () => {
  return vscode.commands.registerCommand(Commands.deactivateAgent, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const logger = new Logger(CoreExtensionService.getChannelService());
    const commandName = Commands.deactivateAgent;
    const hrstart = process.hrtime();
    telemetryService.sendCommandEvent(commandName, hrstart, { commandName });

    try {
      const { conn, project } = await getConnectionAndProject();
      let agentName: string;
      let apiNameOrId: string;

      if (!uri) {
        // Command palette - show activated agents
        const agents = await getPublishedAgents(conn);
        const activated = agents.filter(a => a.isActivated);

        if (activated.length === 0) {
          const msg = agents.length === 0
            ? 'No published agents found in the org.'
            : 'No published agents are currently active.';
          vscode.window.showInformationMessage(msg);
          return;
        }

        const picked = await vscode.window.showQuickPick(
          activated.map(a => ({ label: a.name, agentId: a.id })),
          { placeHolder: 'Select an active agent to deactivate' }
        );
        if (!picked) {
          return;
        }
        agentName = picked.label;
        apiNameOrId = picked.agentId;
      } else {
        // Context menu - validate the file/directory
        const targetPath = uri.fsPath;
        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(targetPath));
        const fileName = path.basename(targetPath);

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

        agentName = await getAgentNameFromPath(targetPath);
        apiNameOrId = agentName;
      }

      const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to deactivate agent "${agentName}"?`,
        { modal: true },
        'Deactivate'
      );

      if (confirmation !== 'Deactivate') {
        return;
      }

      logger.clear();
      logger.debug(`Deactivating agent ${agentName}...`);

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Deactivating agent: ${agentName}...`,
          cancellable: false
        },
        async () => {
          const agent = await Agent.init({
            connection: conn,
            project: project,
            apiNameOrId
          });

          await agent.deactivate();
          vscode.window.showInformationMessage(`Agent "${agentName}" was deactivated successfully.`);

          // Refresh the panel's agent list to reflect the new deactivation state
          void vscode.commands.executeCommand('sf.agent.combined.view.refreshAgents', agentName);
        }
      );
    } catch (error) {
      const sfError = SfError.wrap(error);
      const errorMessage = `Failed to deactivate agent: ${sfError.message}`;
      logger.error(errorMessage, sfError);
      vscode.window.showErrorMessage(errorMessage);
      telemetryService.sendException('agent_deactivation_failed', errorMessage);
    }
  });
};
