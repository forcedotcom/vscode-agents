import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { Agent } from '@salesforce/agents';
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
      // Get the demo agent developer name from VSCode setting
      const config = vscode.workspace.getConfiguration('salesforce.agentforceDX');
      const demoAgentName = config.get<string>('demoAgentName');
      if (!demoAgentName) {
        vscode.window.showErrorMessage('Demo agent name not configured. Please set the "Salesforce › Agentforce DX: Demo Agent Name" setting to the developer name of an agent to preview.');
        return;
      }

      // Get connection and find the agent ID
      const conn = await CoreExtensionService.getDefaultConnection();
      const remoteAgents = await Agent.listRemote(conn);
      const demoAgent = remoteAgents.find(bot => bot.DeveloperName === demoAgentName);

      if (!demoAgent) {
        vscode.window.showErrorMessage(`Could not find agent with developer name '${demoAgentName}' in the org.`);
        return;
      }

      console.log('Found demo agent:', demoAgent.Id, 'with name:', demoAgent.DeveloperName);

      // for when the APIs are real
      // Read and compile the .agent file
      // 
      // const fileContents = Buffer.from((await vscode.workspace.fs.readFile(vscode.Uri.file(filePath)))).toString();
      // try {
      //   await Agent.compileAfScript(conn, fileContents);
      // } catch (compileError) {
      //   const error = SfError.wrap(compileError);
      //   channelService.showChannelOutput();
      //   channelService.clear();
      //   channelService.appendLine('❌ Agent validation failed! Cannot preview invalid agent.');
      //   channelService.appendLine('────────────────────────────────────────────────────────────────────────');
      //   channelService.appendLine(`Error: ${error.message}`);
      //   return;
      // }

      // Open the Agent Preview panel and select the demo agent
      const provider = AgentCombinedViewProvider.getInstance();
      if (!provider) {
        vscode.window.showErrorMessage('Failed to get Agent Preview provider.');
        return;
      }

      // Set the preselected agent ID and open the view
      provider.setPreselectedAgentId(demoAgent.Id);
      await vscode.commands.executeCommand('workbench.view.extension.agentforce-dx');
      vscode.commands.executeCommand('setContext', 'sf:project_opened', true);
      
      // Focus the panel to ensure it's visible
      if (provider.webviewView) {
        provider.webviewView.show?.(false);
      }
      
      // Wait a bit for the webview to be ready, then send selectAgent message
      // This works whether the panel is new or already open
      setTimeout(() => {
        if (provider.webviewView?.webview) {
          provider.webviewView.webview.postMessage({
            command: 'selectAgent',
            data: { agentId: demoAgent.Id }
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