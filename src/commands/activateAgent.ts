import * as vscode from 'vscode';
import * as path from 'path';
import { Commands } from '../enums/commands';
import { SfError } from '@salesforce/core';
import { Agent, ProductionAgent } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { getAgentNameFromPath, getConnectionAndProject, getPublishedAgents } from './agentUtils';
import { Logger } from '../utils/logger';

function buildVersionPickerItems(versions: Array<{ VersionNumber: number; Status: string }>) {
  return versions
    .sort((a, b) => b.VersionNumber - a.VersionNumber)
    .map(v => ({
      label: `Version ${v.VersionNumber}`,
      description: v.Status === 'Active' ? '(Active)' : '',
      versionNumber: v.VersionNumber
    }));
}

async function activateWithProgress(
  agent: ProductionAgent,
  agentName: string,
  versionNumber: number,
  logger: Logger
): Promise<void> {
  logger.debug(`Activating agent ${agentName} v${versionNumber}...`);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Activating agent: ${agentName} v${versionNumber}...`,
      cancellable: false
    },
    async () => {
      const result = await agent.activate(versionNumber);
      vscode.window.showInformationMessage(
        `Agent "${agentName}" v${result.VersionNumber} activated.`
      );

      // Refresh the panel's agent list to reflect the new activation state
      void vscode.commands.executeCommand('sf.agent.combined.view.refreshAgents');
    }
  );
}

export const registerActivateAgentCommand = () => {
  return vscode.commands.registerCommand(Commands.activateAgent, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const logger = new Logger(CoreExtensionService.getChannelService());
    const commandName = Commands.activateAgent;
    const hrstart = process.hrtime();
    telemetryService.sendCommandEvent(commandName, hrstart, { commandName });

    try {
      const { conn, project } = await getConnectionAndProject();
      let agentName: string;

      if (!uri) {
        // Command palette - show deactivated agents
        const agents = await getPublishedAgents(conn);
        const deactivated = agents.filter(a => !a.isActivated);

        if (deactivated.length === 0) {
          const msg = agents.length === 0
            ? 'No published agents found in the org.'
            : 'All published agents are already active.';
          vscode.window.showInformationMessage(msg);
          return;
        }

        const picked = await vscode.window.showQuickPick(
          deactivated.map(a => ({ label: a.name, agentId: a.id })),
          { placeHolder: 'Select a deactivated agent to activate' }
        );
        if (!picked) {
          return;
        }
        agentName = picked.agentId;
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
      }

      logger.clear();

      const agent = await Agent.init({
        connection: conn,
        project: project,
        apiNameOrId: agentName
      });

      const botMetadata = await agent.getBotMetadata();
      const versions = botMetadata.BotVersions.records.filter(
        (v: { IsDeleted?: boolean }) => !v.IsDeleted
      );

      if (versions.length === 0) {
        vscode.window.showErrorMessage(`No versions found for agent "${agentName}".`);
        return;
      }

      let selectedVersion: number;

      if (versions.length === 1) {
        selectedVersion = versions[0].VersionNumber;
      } else {
        const picked = await vscode.window.showQuickPick(
          buildVersionPickerItems(versions),
          { placeHolder: `Select a version to activate for "${agentName}"` }
        );
        if (!picked) {
          return;
        }
        selectedVersion = picked.versionNumber;
      }

      await activateWithProgress(agent, agentName, selectedVersion, logger);
    } catch (error) {
      const sfError = SfError.wrap(error);
      const errorMessage = `Failed to activate agent: ${sfError.message}`;
      logger.error(errorMessage, sfError);
      vscode.window.showErrorMessage(errorMessage);
      telemetryService.sendException('agent_activation_failed', errorMessage);
    }
  });
};
