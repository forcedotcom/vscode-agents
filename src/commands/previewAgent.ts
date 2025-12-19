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

      // Use the file path directly as the agent ID (no 'local:' prefix)
      // The agent source will be determined from the PreviewableAgent list
      const agentId = filePath;

      // Set the preselected agent ID (this will be picked up when the session starts)
      provider.setAgentId(agentId);

      // Open the Agentforce DX view
      await vscode.commands.executeCommand('workbench.view.extension.agentforce-dx');
      await vscode.commands.executeCommand('setContext', 'sf:project_opened', true);

      // Focus the panel to ensure it's visible
      if (provider.webviewView) {
        provider.webviewView.show?.(false);
      }

      // Wait for the webview to be ready, then trigger the agent selection
      // The startSession handler will determine the agent source from the PreviewableAgent list
      setTimeout(() => {
        if (provider.webviewView?.webview) {
          provider.webviewView.webview.postMessage({
            command: 'selectAgent',
            data: { agentId: agentId }
          });
        }
      }, 500);
    } catch (e) {
      const error = SfError.wrap(e);
      channelService.appendLine('❌ Error previewing the .agent file.');
      channelService.appendLine('');
      channelService.appendLine('Error Details:');
      channelService.appendLine('────────────────────────────────────────────────────────────────────────');
      channelService.appendLine(error.message || 'Something went wrong.');

      if (error.stack) {
        channelService.appendLine('');
        channelService.appendLine('Stack Trace:');
        channelService.appendLine('────────────────────────────────────────────────────────────────────────');
        channelService.appendLine(error.stack);
      }
    }
  });
};
