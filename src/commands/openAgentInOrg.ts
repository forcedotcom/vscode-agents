import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { SfProject } from '@salesforce/core-bundle';
import { Agent } from '@salesforce/agents-bundle';
import { sync } from 'cross-spawn';
import { CoreExtensionService } from '../services/coreExtensionService';

export const registerOpenAgentInOrgCommand = () => {
  return vscode.commands.registerCommand(Commands.openAgentInOrg, async () => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    telemetryService.sendCommandEvent(Commands.openAgentInOrg);
    const project = SfProject.getInstance();
    const agents = await Agent.list(project);
    if (agents.length === 0) {
      vscode.window.showErrorMessage(`Could not find agents in the current project.`);
      return;
    }
    // we need to prompt the user which agent to ope
    const agentName = await vscode.window.showQuickPick(agents, { placeHolder: 'Agent name (type to search)' });

    if (!agentName) {
      telemetryService.sendException('no_agent_selected', 'No Agent selected');
      return;
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
