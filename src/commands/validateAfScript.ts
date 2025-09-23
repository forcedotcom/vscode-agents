import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { Agent } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { SfError } from '@salesforce/core';
import * as path from 'path';

export const registerValidateAfScriptCommand = () => {
  return vscode.commands.registerCommand(Commands.validateAfScript, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const channelService = CoreExtensionService.getChannelService();
    telemetryService.sendCommandEvent(Commands.validateAfScript);

    // Get the file path from the context menu
    const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName;

    if (!filePath) {
      vscode.window.showErrorMessage('No .afscript file selected.');
      return;
    }

    // Show the output channel
    channelService.showChannelOutput();

    // Print header
    const fileName = path.basename(filePath);
    channelService.appendLine('════════════════════════════════════════════════════════════════════════');
    channelService.appendLine(`Validating AF Script: ${fileName}`);
    channelService.appendLine('════════════════════════════════════════════════════════════════════════');
    channelService.appendLine('');

      try {
        // Read the file contents
      const fileContents = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
      const afScriptContent = Buffer.from(fileContents).toString('utf8');

      // Attempt to compile the AF Script
      try {
        await Agent.compileAfScript(await CoreExtensionService.getDefaultConnection(), afScriptContent);
        
        // Show minimal success notification
        vscode.window.showInformationMessage('AF Script validation successful! ');
      } catch (compileError) {
        const error = SfError.wrap(compileError);
        
        // Show error details in output
        channelService.appendLine('❌ AF Script validation failed!');
        channelService.appendLine('');
        channelService.appendLine('Error Details:');
        channelService.appendLine('────────────────────────────────────────────────────────────────────────');
        channelService.appendLine(`Error: ${error.message}`);
        
        if (error.stack) {
          channelService.appendLine('');
          channelService.appendLine('Stack Trace:');
          channelService.appendLine('────────────────────────────────────────────────────────────────────────');
          channelService.appendLine(error.stack);
        }
      }
    } catch (e) {
      const error = SfError.wrap(e);
      
      // Show file read error details
      channelService.appendLine('❌ Error reading .afscript file!');
      channelService.appendLine('');
      channelService.appendLine('Error Details:');
      channelService.appendLine('────────────────────────────────────────────────────────────────────────');
      channelService.appendLine(`Error: ${error.message}`);
      
      if (error.stack) {
        channelService.appendLine('');
        channelService.appendLine('Stack Trace:');
        channelService.appendLine('────────────────────────────────────────────────────────────────────────');
        channelService.appendLine(error.stack);
      }
    }
  });
};
