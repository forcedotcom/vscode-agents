import * as vscode from 'vscode';
import { Org } from '@salesforce/core-bundle';
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
        if (message.command === 'startSession') {
          if (!this.agentPreview) {
            const org = await Org.create({ aliasOrUsername: 'aliasAgente' });
            const conn = org.getConnection() as any;
            const agentId = 'idAgente';
            this.agentPreview = new AgentPreview(conn);

            const session = await this.agentPreview.start(agentId);
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
          this.sessionId = undefined;
          this.agentPreview = undefined;

          webviewView.webview.postMessage({ command: 'sessionEnded' });
        } else if (message.command === 'selectAgent') {
          console.log('Agent selected:', message.agent);
          // TODO: logic to get bot id from agent name
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
}
