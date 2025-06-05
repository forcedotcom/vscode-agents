import * as vscode from 'vscode';
import { AgentPreview } from '@salesforce/agents-bundle';
import { CoreExtensionService } from '../services/coreExtensionService';
import path from 'path';
import { Lifecycle } from '@salesforce/core-bundle';

export class AgentChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sf.agent.chat.view';
  private agentPreview?: AgentPreview;
  private sessionId = Date.now().toString();

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: vscode.WebviewViewResolveContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'agent-chat', 'dist')]
    };
    webviewView.webview.onDidReceiveMessage(async message => {
      try {
        if (message.command === 'startSession') {
          webviewView.webview.postMessage({
            command: 'sessionStarting',
            data: { message: 'Starting session...' }
          });
          const conn = await CoreExtensionService.getDefaultConnection();

          this.agentPreview = new AgentPreview(conn);

          const session = await this.agentPreview.start(message.data);
          this.sessionId = session.sessionId;

          webviewView.webview.postMessage({
            command: 'sessionStarted',
            data: session.messages.find(msg => msg.type === 'Inform')
          });
        } else if (message.command === 'sendChatMessage') {
          if (!this.agentPreview || !this.sessionId) {
            throw new Error('Session has not been started.');
          }

          const response = await this.agentPreview.send(this.sessionId, message.text);

          await Lifecycle.getInstance().emit('chatResponse', response);
          webviewView.webview.postMessage({
            command: 'chatResponse',
            data: response.messages.find(msg => msg.type === 'Inform')
          });
        } else if (message.command === 'endSession') {
          if (!this.agentPreview || !this.sessionId) {
            throw new Error('No active session to end.');
          }

          await this.agentPreview.end(this.sessionId, 'UserRequest');
          await this.saveChatToFile(message.data);
          this.agentPreview = undefined;
        } else if (message.command === 'queryAgents') {
          const conn = await CoreExtensionService.getDefaultConnection();
          const query = await conn.query(
            "SELECT Id, MasterLabel FROM BotDefinition WHERE IsDeleted = false AND Id IN (SELECT BotDefinitionId FROM BotVersion WHERE Status='Active') AND DeveloperName \!='Copilot_for_Salesforce'"
          );
          if (query.records.length > 0) {
            webviewView.webview.postMessage({ command: 'setAgents', data: query.records });
          } else {
            vscode.window.showErrorMessage('There are no agents in the default org');
          }
        }
      } catch (error) {
        console.error('Error:', error);
        if (error instanceof Error && error.name === 'ERROR_HTTP_404') {
          error.message =
            "Unfortunately, we cannot chat. Please ensure you're using JWT authentication and have followed the <a href='https://developer.salesforce.com/docs/einstein/genai/guide/agent-api-get-started.html'>steps</a> to setup your Connected App";
        }
        webviewView.webview.postMessage({
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
