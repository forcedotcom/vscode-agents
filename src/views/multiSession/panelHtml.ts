import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentSource } from '@salesforce/agents';
import type { Session } from './session';

export function renderSessionPanelHtml(
  context: vscode.ExtensionContext,
  session: Session
): string {
  const htmlPath = path.join(context.extensionPath, 'webview', 'dist', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  const bootstrap = {
    localId: session.id,
    agentId: session.agentId,
    agentSource: session.agentSource,
    agentName: session.agentName ?? null,
    liveMode: session.liveMode,
    apexDebug: session.apexDebug,
    status: session.status,
    multiSession: true
  };

  const injected = `
    <script>
      const vscode = acquireVsCodeApi();
      window.vscode = vscode;
      window.AgentSource = ${JSON.stringify({
        SCRIPT: AgentSource.SCRIPT,
        PUBLISHED: AgentSource.PUBLISHED
      })};
      window.afdxSessionBootstrap = ${JSON.stringify(bootstrap)};
      document.addEventListener('DOMContentLoaded', function () {
        document.body.classList.add('afdx-session-mode');
      });
    </script>
  `;

  html = html.replace('</head>', `${injected}</head>`);
  return html;
}
