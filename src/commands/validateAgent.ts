import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { Agent } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { SfError } from '@salesforce/core';

export const registerValidateAgentCommand = () => {
  return vscode.commands.registerCommand(Commands.validateAgent, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const channelService = CoreExtensionService.getChannelService();
    telemetryService.sendCommandEvent(Commands.validateAgent);

    // Get the file path from the context menu
    const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName;

    if (!filePath) {
      vscode.window.showErrorMessage('No .agent file selected.');
      return;
    }

    const fileContents = Buffer.from((await vscode.workspace.fs.readFile(vscode.Uri.file(filePath)))).toString();

    // Attempt to compile the Agent
    try {
      await Agent.compileAgent(await CoreExtensionService.getDefaultConnection(), fileContents);
      vscode.window.showInformationMessage('Agent validation successful! 🎉');
    } catch (compileError) {
      const error = SfError.wrap(compileError);
      // Show the output channel
      channelService.showChannelOutput();
      channelService.clear();
      // Show error details in output
      channelService.appendLine('❌ Agent validation failed!');
      channelService.appendLine('────────────────────────────────────────────────────────────────────────');
      channelService.appendLine(`Error: ${error.message}`);
    }
  });
};
