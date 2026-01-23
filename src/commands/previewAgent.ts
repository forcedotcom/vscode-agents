import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { CoreExtensionService } from '../services/coreExtensionService';
import { SfError, SfProject } from '@salesforce/core';
import { AgentCombinedViewProvider } from '../views/agentCombinedViewProvider';
import { Agent, AgentSource } from '@salesforce/agents';
import { Logger } from '../utils/logger';

export const registerPreviewAgentCommand = () => {
  return vscode.commands.registerCommand(Commands.previewAgent, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const logger = new Logger(CoreExtensionService.getChannelService());
    telemetryService.sendCommandEvent(Commands.previewAgent);

    // Get the file path from the context menu
    const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName;

    if (!filePath) {
      vscode.window.showErrorMessage('No .agent file selected.');
      return;
    }

    // Clear previous output and show channel
    logger.clear();
    logger.show();
    
    // Log SF_TEST_API setting value
    logger.debug(`SF_TEST_API = ${process.env.SF_TEST_API ?? 'false'}`);

    try {
      // Open the Agent Preview panel
      const provider = AgentCombinedViewProvider.getInstance();
      if (!provider) {
        vscode.window.showErrorMessage('Failed to get Agent Preview provider.');
        return;
      }

      // Use the file path directly as the agent ID
      const agentId = filePath;

      // Open the Agentforce DX view
      await vscode.commands.executeCommand('workbench.view.extension.agentforce-dx');
      await vscode.commands.executeCommand('setContext', 'sf:project_opened', true);

      // Focus the panel to ensure it's visible
      if (provider.webviewView) {
        provider.webviewView.show?.(false);
      }

      // Wait for webview to be ready
      let webviewReady = false;
      const webviewTimeout = 10000; // 10 seconds timeout
      const webviewStartTime = Date.now();
      while (Date.now() - webviewStartTime < webviewTimeout) {
        if (provider.webviewView?.webview) {
          const html = provider.webviewView.webview.html || '';
          if (html.length > 0) {
            webviewReady = true;
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!webviewReady) {
        vscode.window.showWarningMessage('Webview is taking longer than expected to load. Please try again.');
        return;
      }

      // Determine agent source by checking the PreviewableAgent list
      // For script agents opened from file, the agentId is the file path
      let agentSource: AgentSource | undefined;
      try {
        const conn = await CoreExtensionService.getDefaultConnection();
        const project = SfProject.getInstance();
        const allAgents = await Agent.listPreviewable(conn, project);
        // For script agents, the agentId in the list should match the file path
        const agent = allAgents.find(a => a.id === agentId);
        if (agent) {
          agentSource = agent.source;
        } else {
          // If not found in list, assume it's a script agent (file path)
          agentSource = AgentSource.SCRIPT;
        }
      } catch (err) {
        // If we can't determine source, default to SCRIPT for file-based previews
        console.warn('Could not determine agent source, defaulting to SCRIPT:', err);
        agentSource = AgentSource.SCRIPT;
      }

      // Update webview to show the selected agent in the dropdown
      if (provider.webviewView?.webview) {
        provider.webviewView.webview.postMessage({
          command: 'selectAgent',
          data: { agentId: agentId, agentSource: agentSource }
        });
      }

      // Set the agent ID and start the preview session directly
      provider.setAgentId(agentId);
      // For script agents opened from command, default to simulation mode (isLiveMode = false)
      await provider.startPreviewSession(agentId, agentSource, false);
    } catch (e) {
      const error = SfError.wrap(e);
      logger.error('Error previewing the .agent file', error);
      logger.show();
    }
  });
};
