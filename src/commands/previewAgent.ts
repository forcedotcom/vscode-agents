import * as vscode from 'vscode';
import * as path from 'path';
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

    // Clear previous output
    logger.clear();

    // Log SF_TEST_API setting value
    logger.debug(`SF_TEST_API = ${process.env.SF_TEST_API ?? 'false'}`);

    try {
      // Open the Agent Preview panel
      const provider = AgentCombinedViewProvider.getInstance();
      if (!provider) {
        vscode.window.showErrorMessage('Failed to get Agent Preview provider.');
        telemetryService.sendException('previewAgent_failed', 'Failed to get Agent Preview provider.');
        return;
      }

      // For script agents, the dropdown uses aabName (bundle name) as the agent ID,
      // not the file path. Extract the aabName from the file path.
      // The aabName is the parent directory of the .agent file.
      const aabName = path.basename(path.dirname(filePath));

      // Determine agent source and find the matching agent ID for the dropdown
      // We need to match the ID format that handleGetAvailableAgents uses
      let agentId = aabName; // Default to aabName for script agents
      let agentSource: AgentSource = AgentSource.SCRIPT;

      try {
        const conn = await CoreExtensionService.getDefaultConnection();
        const project = SfProject.getInstance();
        const allAgents = await Agent.listPreviewable(conn, project);

        // Find the matching agent - for script agents, match by aabName
        const agent = allAgents.find(a => a.aabName === aabName || a.id === aabName);
        if (agent) {
          // Use the same ID format as handleGetAvailableAgents: agent.id || agent.aabName
          agentId = agent.id || agent.aabName || aabName;
          agentSource = agent.source;
        }
      } catch (err) {
        // If we can't fetch agents, continue with aabName as the ID
        console.warn('Could not fetch agents list, using aabName as agent ID:', err);
      }

      // Set the agent ID early so it's available when the webview requests available agents
      // This ensures the agent is pre-selected even if the webview mounts before we post selectAgent
      provider.setAgentId(agentId);

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

      // Send selectAgent message to update the webview UI
      // This is a backup in case the webview loaded before getAvailableAgents responded
      // The user will click play to start the preview session
      if (provider.webviewView?.webview) {
        provider.webviewView.webview.postMessage({
          command: 'selectAgent',
          data: { agentId: agentId, agentSource: agentSource }
        });
      }
    } catch (e) {
      const sfError = SfError.wrap(e);
      logger.error('Error previewing the .agent file', sfError);
      telemetryService.sendException('previewAgent_failed', sfError.message);
    }
  });
};
