import * as vscode from 'vscode';

export class AgentChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sf.agent.chat.view';

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
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="${indexUri}"></script>
      </body>
      </html>
    `;
  }
}
