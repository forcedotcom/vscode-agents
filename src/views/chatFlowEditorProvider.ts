import * as vscode from 'vscode';

export class ChatFlowEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new ChatFlowEditorProvider(context);
    return vscode.window.registerCustomEditorProvider('sf.agent.showChatFlow', provider, {
      webviewOptions: { retainContextWhenHidden: true }
    });
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveCustomTextEditor(_document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'chat-trace', 'dist')]
    };
    // Get correct path to the CSS file
    const styleUri = webviewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'chat-trace', 'dist', 'assets', 'index.css')
    );

    const indexPath = vscode.Uri.joinPath(this.context.extensionUri, 'chat-trace', 'dist', 'assets', 'index.js');

    const indexUri = webviewPanel.webview.asWebviewUri(indexPath);
    webviewPanel.webview.html = this.getWebviewContent(indexUri, styleUri);
  }

  private getWebviewContent(indexUri: vscode.Uri, styleUri: vscode.Uri): string {
    return `
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
