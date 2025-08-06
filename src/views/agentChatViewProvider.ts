import * as vscode from 'vscode';
import { AgentPreview } from '@salesforce/agents-bundle';
import { CoreExtensionService } from '../services/coreExtensionService';
import path from 'path';
import { Lifecycle } from '@salesforce/core-bundle';
import type { ApexLog } from '@salesforce/types/tooling';

export class AgentChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sf.agent.chat.view';
  private agentPreview?: AgentPreview;
  private sessionId = Date.now().toString();
  private apexDebugging = false;
  private webviewView?: vscode.WebviewView;
  private static activeInstance?: AgentChatViewProvider;

  constructor(private readonly context: vscode.ExtensionContext) {
    AgentChatViewProvider.activeInstance = this;
  }

  private postMessageToWebview(message: any): boolean {
    if (this.webviewView && this.webviewView.webview) {
      try {
        this.webviewView.webview.postMessage(message);
        return true;
      } catch (error) {
        console.error('Failed to post message to webview:', error);
        return false;
      }
    }
    return false;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: vscode.WebviewViewResolveContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ) {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'agent-chat', 'dist')]
    };
    webviewView.webview.onDidReceiveMessage(async message => {
      try {
        if (message.command === 'startSession') {
          this.postMessageToWebview({
            command: 'sessionStarting',
            data: { message: 'Starting session...' }
          });
          const conn = await CoreExtensionService.getDefaultConnection();

          this.agentPreview = new AgentPreview(conn, message.data);

          const session = await this.agentPreview.start();
          this.sessionId = session.sessionId;

          // Set context to show stop button
          vscode.commands.executeCommand('setContext', 'sf.agent.sessionActive', true);

          this.postMessageToWebview({
            command: 'sessionConnected',
            data: { message: 'Starting session... done.' }
          });

          this.postMessageToWebview({
            command: 'sessionStarted',
            data: session.messages.find(msg => msg.type === 'Inform')
          });
        } else if (message.command === 'setApexDebugging') {
          this.apexDebugging = message.data;
        } else if (message.command === 'sendChatMessage') {
          if (!this.agentPreview || !this.sessionId) {
            throw new Error('Session has not been started.');
          }

          // Set debug mode
          this.agentPreview.toggleApexDebugMode(this.apexDebugging);

          const response = await this.agentPreview.send(this.sessionId, message.text);

          await Lifecycle.getInstance().emit('chatResponse', response);
          this.postMessageToWebview({
            command: 'chatResponse',
            data: response.messages.find(msg => msg.type === 'Inform')
          });
          if (this.apexDebugging && response.apexDebugLog) {
            const logPath = await this.saveApexDebugLog(response.apexDebugLog);
            // run the apex debug log command
            if (logPath) {
              vscode.commands.executeCommand('sf.launch.replay.debugger.logfile.path', logPath);
            }
          }
        } else if (message.command === 'endSession') {
          if (!this.agentPreview || !this.sessionId) {
            throw new Error('No active session to end.');
          }

          await this.agentPreview.end(this.sessionId, 'UserRequest');
          await this.saveChatToFile(message.data);
          this.agentPreview = undefined;
          
          // Clear context to show play button
          vscode.commands.executeCommand('setContext', 'sf.agent.sessionActive', false);
        } else if (message.command === 'queryAgents') {
          const conn = await CoreExtensionService.getDefaultConnection();
          const query = await conn.query(
            "SELECT Id, MasterLabel FROM BotDefinition WHERE IsDeleted = false AND Id IN (SELECT BotDefinitionId FROM BotVersion WHERE Status='Active') AND DeveloperName != 'Copilot_for_Salesforce'"
          );
          if (query.records.length > 0) {
            this.postMessageToWebview({ command: 'setAgents', data: query.records });
          } else {
            vscode.window.showErrorMessage('There are no agents in the default org');
          }
        } else if (message.command === 'triggerAgentSelection') {
          // Execute the VS Code command to show agent selection
          vscode.commands.executeCommand('sf.agent.listAgents');
        }
      } catch (error) {
        console.error('Error:', error);
        if (error instanceof Error && error.name === 'ERROR_HTTP_404') {
          error.message =
            "Unfortunately, we cannot chat. Please ensure you're using JWT authentication and have followed the <a href='https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html'>steps</a> to setup your Connected App";
        }
        this.postMessageToWebview({
          command: 'chatError',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Get correct path to the CSS file
    const styleUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'agent-chat', 'dist', 'assets', 'index.css')
    );
    const indexPath = vscode.Uri.joinPath(this.context.extensionUri, 'agent-chat', 'dist', 'assets', 'index.js');

    const indexUri = webviewView.webview.asWebviewUri(indexPath);

    webviewView.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Agentforce DX: Chat with Agent</title>
        <link rel="stylesheet" type="text/css" href="${styleUri}" />
        <script>
          window.addEventListener('error', (event) => {
            console.error('Webview error:', event.message);
          });
        </script>
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="${indexUri}"></script>
      </body>
      </html>
    `;
  }

  public stopSession(): void {
    // Send a message to the webview to trigger the stop session functionality
    this.postMessageToWebview({ command: 'stopButtonClicked' });
    // Clear context to show play button
    vscode.commands.executeCommand('setContext', 'sf.agent.sessionActive', false);
  }

  public static getActiveInstance(): AgentChatViewProvider | undefined {
    return AgentChatViewProvider.activeInstance;
  }

  public selectAgentFromCommand(agentId: string, agentLabel: string): void {
    // Update the webview to reflect the agent selection and start the session
    this.postMessageToWebview({
      command: 'agentSelectedFromCommand',
      data: { id: agentId, label: agentLabel }
    });
  }

  private async saveApexDebugLog(apexLog: ApexLog): Promise<string | undefined> {
    try {
      // Get the current workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found to save apex debug logs.');
        return;
      }

      const logId = apexLog.Id;
      if (!logId) {
        vscode.window.showErrorMessage('No Apex debug log ID found.');
        return;
      }

      // Query for the log content
      const conn = await CoreExtensionService.getDefaultConnection();
      const url = `${conn.tooling._baseUrl()}/sobjects/ApexLog/${logId}/Body`;
      const logContent = await conn.tooling.request<string>(url);

      // Apex debug logs are written to: .sfdx/tools/debug/logs
      const apexDebugLogPath = vscode.Uri.joinPath(workspaceFolder.uri, '.sfdx', 'tools', 'debug', 'logs');
      await vscode.workspace.fs.createDirectory(apexDebugLogPath);
      const filePath = vscode.Uri.joinPath(apexDebugLogPath, `${logId}.log`);

      // Write apex debug log to file
      await vscode.workspace.fs.writeFile(filePath, Buffer.from(logContent, 'utf8'));

      vscode.window.showInformationMessage(`Apex debug log saved to ${filePath.path}`);
      return filePath.path;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Error saving Apex debug log: ${errorMessage}`);
    }
  }

  private async saveChatToFile(messages: string[]): Promise<void> {
    try {
      // Get the current workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
      }

      // Define file path inside 'Chats with agents' folder
      const folderPath = vscode.Uri.joinPath(
        workspaceFolder.uri,
        process.env['SF_AGENT_PREVIEW_OUTPUT_DIR'] ?? path.join('temp', 'agent-preview')
      );
      await vscode.workspace.fs.createDirectory(folderPath);
      const filePath = vscode.Uri.joinPath(folderPath, `${this.sessionId}.json`);

      // Convert messages to JSON
      const fileContent = JSON.stringify({ sessionId: this.sessionId, messages }, null, 2);

      // Write to file
      await vscode.workspace.fs.writeFile(filePath, Buffer.from(fileContent, 'utf8'));

      vscode.window.showInformationMessage(`Chat history saved to ${filePath.path}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Error saving chat: ${errorMessage}`);
    }
  }
}
