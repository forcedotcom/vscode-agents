import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { CoreExtensionService } from '../services/coreExtensionService';
import { SfError } from '@salesforce/core';
import { AgentCombinedViewProvider } from '../views/agentCombinedViewProvider';

export const registerPreviewAgentCommand = () => {
  return vscode.commands.registerCommand(Commands.previewAgent, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const channelService = CoreExtensionService.getChannelService();
    telemetryService.sendCommandEvent(Commands.previewAgent);

    // Get the file path from the context menu
    const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName;

    if (!filePath) {
      vscode.window.showErrorMessage('No .agent file selected.');
      return;
    }

    try {
      // Open the Agent Preview panel
      const provider = AgentCombinedViewProvider.getInstance();
      if (!provider) {
        vscode.window.showErrorMessage('Failed to get Agent Preview provider.');
        return;
      }

      // Use the unified local agent ID format: "local:<filepath>"
      const localAgentId = `local:${filePath}`;

      // Set the preselected agent ID (this will be picked up when the session starts)
      provider.setPreselectedAgentId(localAgentId);

      // Open the Agentforce DX view
      await vscode.commands.executeCommand('workbench.view.extension.agentforce-dx');
      await vscode.commands.executeCommand('setContext', 'sf:project_opened', true);

      // Focus the panel to ensure it's visible
      if (provider.webviewView) {
        provider.webviewView.show?.(false);
      }

      // Wait for the webview to be ready, then trigger the agent selection
      // The startSession handler will detect the "local:" prefix and handle compilation
      setTimeout(() => {
        if (provider.webviewView?.webview) {
          provider.webviewView.webview.postMessage({
            command: 'selectAgent',
            data: { agentId: localAgentId }
          });
        }
      }, 500);

    } catch (e) {
      const error = SfError.wrap(e);
      channelService.appendLine('❌ Error previewing .agent file!');
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