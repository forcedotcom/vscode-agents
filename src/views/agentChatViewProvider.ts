import * as vscode from 'vscode';
import { Connection, Org } from '@salesforce/core-bundle';
import { AgentPreview } from '@salesforce/agents';

export class AgentChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sf.agent.chat.view';
  private agentPreview?: AgentPreview;
  private sessionId?: string;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'agent-chat', 'dist')]
    };
    webviewView.webview.onDidReceiveMessage(async message => {
      try {
        //TODO: Pass default org
        const org = await Org.create({ aliasOrUsername: 'aliasAgente' });
        const conn = org.getConnection() as Connection;
        if (message.command === 'startSession') {
          if (!this.agentPreview) {
            this.agentPreview = new AgentPreview(conn as any);

            const session = await this.agentPreview.start(message.data);
            this.sessionId = session.sessionId;
            console.log('Session started:', session);

            webviewView.webview.postMessage({
              command: 'sessionStarted',
              data: session.messages.find(msg => msg.type === 'Inform')
            });
          }
        } else if (message.command === 'sendChatMessage') {
          if (!this.agentPreview || !this.sessionId) {
            throw new Error('Session has not been started.');
          }

          const response = await this.agentPreview.send(this.sessionId, message.text);
          console.log('Response received:', response);

          webviewView.webview.postMessage({
            command: 'chatResponse',
            data: response.messages.find(msg => msg.type === 'Inform')
          });
        } else if (message.command === 'endSession') {
          if (!this.agentPreview || !this.sessionId) {
            throw new Error('No active session to end.');
          }

          await this.agentPreview.end(this.sessionId, 'UserRequest');
          console.log('Session ended:', this.sessionId);
          this.saveChatToFile(message.data);
          this.sessionId = undefined;
          this.agentPreview = undefined;

          webviewView.webview.postMessage({ command: 'sessionEnded' });
        } else if (message.command === 'queryAgents') {
          const query = await conn.query('SELECT Id, MasterLabel FROM BotDefinition');
          if (query.records.length > 0) {
            webviewView.webview.postMessage({ command: 'setAgents', data: query.records });
          } else {
            vscode.window.showErrorMessage('There are no agents in the default org');
          }
        }
      } catch (error) {
        console.error('Error:', error);
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

  private async saveChatToFile(messages: any[]) {
    try {
      // Get the current workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
      }

      // Define file path inside 'Chats with agents' folder
      const folderPath = vscode.Uri.joinPath(workspaceFolder.uri, 'Chats with agents');
      await vscode.workspace.fs.createDirectory(folderPath);
      const filePath = vscode.Uri.joinPath(folderPath, `${this.sessionId}.json`);

      // Convert messages to JSON
      const fileContent = JSON.stringify({ sessionId: this.sessionId, messages }, null, 2);

      // Write to file
      await vscode.workspace.fs.writeFile(filePath, Buffer.from(fileContent, 'utf8'));

      vscode.window.showInformationMessage(`Chat history successfully saved to ${filePath.path}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Error saving chat: ${errorMessage}`);
    }
  }
}
