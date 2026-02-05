/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { SfProject, ConfigAggregator, Org, SfError } from '@salesforce/core';
import { Agent } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { Logger } from '../utils/logger';

interface AgentQuickPickItem extends vscode.QuickPickItem {
  agentId: string;
  developerName: string;
  isCurrentlyActive: boolean;
}

export const registerManageAgentActivationCommand = () => {
  return vscode.commands.registerCommand(Commands.manageAgentActivation, async () => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const logger = new Logger(CoreExtensionService.getChannelService());
    telemetryService.sendCommandEvent(Commands.manageAgentActivation);

    logger.clear();
    logger.debug('Fetching all agents from org...');

    try {
      // Get connection
      const configAggregator = await ConfigAggregator.create();
      const org = await Org.create({
        aliasOrUsername: configAggregator.getPropertyValue<string>('target-org') ?? 'undefined'
      });
      const conn = org.getConnection();
      const project = SfProject.getInstance();

      // Fetch all agents from org using Agent.listRemote()
      const botMetadataList = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Fetching agents from org...',
          cancellable: false
        },
        async () => {
          return await Agent.listRemote(conn);
        }
      );

      if (botMetadataList.length === 0) {
        vscode.window.showInformationMessage('No agents found in the org.');
        return;
      }

      logger.debug(`Found ${botMetadataList.length} agents in org`);

      // Create QuickPick items - check BotVersions for active status
      const items: AgentQuickPickItem[] = botMetadataList.map(bot => {
        const botVersions = bot.BotVersions?.records ?? [];
        // Check if ANY version is active (for accurate display)
        const hasActiveVersion = botVersions.some(v => v.Status === 'Active');
        // The library operates on the LAST version only
        const latestVersion = botVersions[botVersions.length - 1];
        const latestIsActive = latestVersion?.Status === 'Active';

        // Determine display status and whether library can actually change it
        const isActive = hasActiveVersion;
        const hasMixedVersions = hasActiveVersion !== latestIsActive;

        let description = isActive ? '$(check) Active' : '$(circle-slash) Inactive';
        if (hasMixedVersions) {
          // Warn user that this agent has mixed version statuses
          description += ' $(warning) (mixed versions)';
        }

        return {
          label: bot.MasterLabel,
          description,
          detail: `API Name: ${bot.DeveloperName}`,
          picked: isActive,
          agentId: bot.Id,
          developerName: bot.DeveloperName,
          isCurrentlyActive: isActive
        };
      });

      // Sort by label
      items.sort((a, b) => a.label.localeCompare(b.label));

      // Show multi-select QuickPick
      const selectedItems = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: 'Select agents to activate (unselected will be deactivated)',
        title: 'Manage Agent Activation',
        ignoreFocusOut: true
      });

      if (!selectedItems) {
        // User cancelled
        return;
      }

      // Calculate changes
      const selectedIds = new Set(selectedItems.map(item => item.agentId));
      const toActivate = selectedItems.filter(item => !item.isCurrentlyActive);
      const toDeactivate = items.filter(item => item.isCurrentlyActive && !selectedIds.has(item.agentId));

      if (toActivate.length === 0 && toDeactivate.length === 0) {
        vscode.window.showInformationMessage('No changes to apply.');
        return;
      }

      // Confirm changes
      const activateNames = toActivate.map(a => a.label).join(', ');
      const deactivateNames = toDeactivate.map(a => a.label).join(', ');

      let confirmMessage = '';
      if (toActivate.length > 0) {
        confirmMessage += `Activate: ${activateNames}`;
      }
      if (toDeactivate.length > 0) {
        if (confirmMessage) {
          confirmMessage += '\n';
        }
        confirmMessage += `Deactivate: ${deactivateNames}`;
      }

      const confirmation = await vscode.window.showWarningMessage(
        `Apply the following changes?\n\n${confirmMessage}`,
        { modal: true },
        'Apply Changes'
      );

      if (confirmation !== 'Apply Changes') {
        return;
      }

      // Process changes
      const errors: string[] = [];

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Updating agent activation status...',
          cancellable: false
        },
        async progress => {
          const total = toActivate.length + toDeactivate.length;

          // Activate agents
          for (let i = 0; i < toActivate.length; i++) {
            const item = toActivate[i];
            try {
              progress.report({
                message: `Activating ${item.label}...`,
                increment: 100 / total
              });

              logger.debug(`Initializing agent for activation: ${item.developerName} (ID: ${item.agentId})`);

              const agent = await Agent.init({
                connection: conn as any,
                project: project as any,
                apiNameOrId: item.agentId
              });
              await agent.activate();

              logger.debug(`Activated agent: ${item.label}`);
            } catch (error) {
              const sfError = SfError.wrap(error);
              errors.push(`Failed to activate ${item.label}: ${sfError.message}`);
              logger.error(`Failed to activate ${item.label}`, sfError);
            }
          }

          // Deactivate agents
          for (let i = 0; i < toDeactivate.length; i++) {
            const item = toDeactivate[i];
            try {
              progress.report({
                message: `Deactivating ${item.label}...`,
                increment: 100 / total
              });

              // Find the original bot metadata to log version details
              const botMetadata = botMetadataList.find(b => b.Id === item.agentId);
              const versions = botMetadata?.BotVersions?.records ?? [];
              const versionStatuses = versions.map((v, idx) => `v${idx + 1}: ${v.Status}`).join(', ');
              logger.debug(
                `Agent "${item.label}" has ${versions.length} version(s): [${versionStatuses}]`
              );
              logger.debug(`Initializing agent for deactivation: ${item.developerName} (ID: ${item.agentId})`);

              const agent = await Agent.init({
                connection: conn as any,
                project: project as any,
                apiNameOrId: item.agentId
              });
              await agent.deactivate();

              logger.debug(`Deactivated agent: ${item.label}`);
            } catch (error) {
              const sfError = SfError.wrap(error);
              errors.push(`Failed to deactivate ${item.label}: ${sfError.message}`);
              logger.error(`Failed to deactivate ${item.label}`, sfError);
            }
          }
        }
      );

      // Refresh the agent picker in the webview
      await vscode.commands.executeCommand('sf.agent.combined.view.refreshAgents');

      // Show result
      const successCount = toActivate.length + toDeactivate.length - errors.length;
      if (errors.length > 0) {
        vscode.window.showWarningMessage(
          `Updated ${successCount} agent(s). ${errors.length} failed. Check Agentforce DX Extension output for details.`
        );
      } else {
        vscode.window.showInformationMessage(
          `Agent activation status updated successfully. ${successCount} agent(s) changed.`
        );
      }
    } catch (error) {
      const sfError = SfError.wrap(error);
      const errorMessage = `Failed to manage agent activation: ${sfError.message}`;
      logger.error(errorMessage, sfError);
      vscode.window.showErrorMessage(errorMessage);
      telemetryService.sendException('manage_agent_activation_failed', errorMessage);
    }
  });
};
