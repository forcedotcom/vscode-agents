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
      const conn = await CoreExtensionService.getDefaultConnection();

      // Attempt to compile the Agent
      // Type cast needed due to local dependency setup with separate @salesforce/core instances
      const compilationResult = await Agent.compileAgentScript(conn as any, fileContents);
      
      if (compilationResult.status === 'failure') {
        // Show the output channel
        channelService.showChannelOutput();
        channelService.clear();
        // Show error details in output
        channelService.appendLine('❌ Agent validation failed!');
        channelService.appendLine('────────────────────────────────────────────────────────────────────────');
        
        if (compilationResult.errors && compilationResult.errors.length > 0) {
          compilationResult.errors.forEach(error => {
            channelService.appendLine(`Error: ${error.description}`);
            channelService.appendLine(`  Location: Line ${error.lineStart}:${error.colStart} - Line ${error.lineEnd}:${error.colEnd}`);
            channelService.appendLine('');
          });
        } else {
          channelService.appendLine('Compilation failed with no specific error details.');
        }
      } else {
        vscode.window.showInformationMessage('Agent validation successful! 🎉');
      }

  });
};
