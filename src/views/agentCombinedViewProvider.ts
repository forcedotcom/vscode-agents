import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentPreview } from '@salesforce/agents-bundle';
import { CoreExtensionService } from '../services/coreExtensionService';
// import { Lifecycle } from '@salesforce/core-bundle';
// import type { ApexLog } from '@salesforce/types/tooling';

export class AgentCombinedViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sf.agent.combined.view';
  private agentPreview?: AgentPreview;
  private sessionId = Date.now().toString();
  private apexDebugging = false;

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
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'agent-chat-and-trace', 'dist')]
    };
    webviewView.webview.onDidReceiveMessage(async message => {
      try {
        if (message.command === 'startSession') {
          webviewView.webview.postMessage({
            command: 'sessionStarting',
            data: { message: 'Starting session...' }
          });
          const conn = await CoreExtensionService.getDefaultConnection();

          this.agentPreview = new AgentPreview(conn, message.data);

          const session = await this.agentPreview.start();
          this.sessionId = session.sessionId;

          webviewView.webview.postMessage({
            command: 'sessionStarted',
            data: session.messages.find(msg => msg.type === 'Inform')
          });
        } else if (message.command === 'setApexDebugging') {
          this.apexDebugging = message.data;
        } else if (message.command === 'sendChatMessage') {
          if (!this.agentPreview || !this.sessionId) {
            throw new Error('Session has not been started.');
          }

          webviewView.webview.postMessage({
            command: 'messageStarting',
            data: { message: 'Sending message...' }
          });

          const session = await this.agentPreview.send(this.sessionId, message.data.message);

          webviewView.webview.postMessage({
            command: 'messageSent',
            data: session.messages.at(-1)
          });

          if (this.apexDebugging) {
            // Note: getApexLogs method needs to be implemented in CoreExtensionService
            // For now, commenting out this functionality
            // TODO: Implement Apex debugging functionality
          }
        } else if (message.command === 'endSession') {
          if (this.agentPreview && this.sessionId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await this.agentPreview.end(this.sessionId, 'UserRequested' as any);
            this.agentPreview = undefined;
            this.sessionId = Date.now().toString();
          }
        }
      } catch (err) {
        console.error('AgentCombinedViewProvider Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        webviewView.webview.postMessage({
          command: 'error',
          data: { message: errorMessage }
        });
      }
    });

    webviewView.webview.html = this.getHtmlForWebview();
  }

  private getHtmlForWebview(): string {
    // Read the built HTML file which contains everything inlined
    const htmlPath = path.join(this.context.extensionPath, 'agent-chat-and-trace', 'dist', 'index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    // Add VSCode webview API script injection
    const vscodeScript = `
      <script>
        const vscode = acquireVsCodeApi();
        window.vscode = vscode;
      </script>
    `;
    
    // Insert the vscode script before the closing head tag
    html = html.replace('</head>', `${vscodeScript}</head>`);
    
    return html;
  }
}