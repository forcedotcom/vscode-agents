import * as vscode from 'vscode';
import * as path from 'path';
import { Commands } from '../enums/commands';
import { SfProject } from '@salesforce/core-bundle';
import { Agent } from '@salesforce/agents-bundle';
import { sync } from 'cross-spawn';
import { CoreExtensionService } from '../services/coreExtensionService';
import { getAgentNameFromPath } from './agentUtils';

export const registerOpenAgentInOrgCommand = () => {
  return vscode.commands.registerCommand(Commands.openAgentInOrg, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const channelService = CoreExtensionService.getChannelService();
    telemetryService.sendCommandEvent(Commands.openAgentInOrg);
    
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
        vscode.window.showErrorMessage(`Could not find agents in the current project.`);
        channelService.appendLine('Could not find agents in the current project.');
        channelService.appendLine('Suggestion: retrieve your agents (Bot) metadata locally.');
        return;
      }
      // we need to prompt the user which agent to open
      agentName = await vscode.window.showQuickPick(agents, { placeHolder: 'Agent name (type to search)' });

      if (!agentName) {
        telemetryService.sendException('no_agent_selected', 'No Agent selected');
        return;
      }
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        cancellable: true
      },
      async progress => {
        progress.report({ message: 'Running SFDX: Open an Agent in the Default Org.' });
        const result = sync('sf', ['org', 'open', 'agent', '--name', agentName]);
        if (result.status !== 0) {
          vscode.window.showErrorMessage(`Unable to open agent: ${result.stderr.toString()}`);
          telemetryService.sendException('sf_command_failed', `stderr: ${result.stderr.toString()}`);
        } else {
          vscode.window.showInformationMessage('SFDX: Open an Agent in the Default Org successfully ran.');
        }
      }
    );
  });
};
