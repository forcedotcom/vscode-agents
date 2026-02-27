import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { SfProject, SfError } from '@salesforce/core';
import { Agent } from '@salesforce/agents';
import { sync } from 'cross-spawn';
import { CoreExtensionService } from '../services/coreExtensionService';
import { getAgentNameFromPath } from './agentUtils';
import { Logger } from '../utils/logger';

export const registerOpenAgentInOrgCommand = () => {
  return vscode.commands.registerCommand(Commands.openAgentInOrg, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const logger = new Logger(CoreExtensionService.getChannelService());
    const commandName = Commands.openAgentInOrg;
    const hrstart = process.hrtime();
    telemetryService.sendCommandEvent(commandName, hrstart, { commandName });

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
        progress.report({ message: 'Opening agent in the default org...' });
        const result = sync('sf', ['org', 'open', 'agent', '--name', agentName]);
        if (result.status !== 0) {
          vscode.window.showErrorMessage(`Unable to open agent: ${result.stderr.toString()}`);
          telemetryService.sendException('sf_command_failed', `stderr: ${result.stderr.toString()}`);
        } else {
          vscode.window.showInformationMessage('Agent was opened successfully in the default org.');
        }
      }
    );
  });
};
