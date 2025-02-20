import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { SfProject } from '@salesforce/core-bundle';
import * as path from 'path';

export const registerShowAgentStepsCommand = (context: any) => {
  return vscode.commands.registerCommand(Commands.showAgentSteps, async () => {
    // TODO: maybe an Agent.listLocal() or something similar in the library
    const project = SfProject.getInstance();
    console.log('Context:\n', context);
    const defaultPath = project.getDefaultPackage().fullPath;
    const agents = (
      await vscode.workspace.fs.readDirectory(vscode.Uri.file(path.join(defaultPath, 'main', 'default', 'bots')))
    ).map(f => f[0]);

    // TODO: move to utils
    // we need to prompt the user which agent to open
    const agentName = await vscode.window.showQuickPick(agents, { title: 'Choose which Agent to open' });

    if (!agentName) {
      throw new Error('No Agent selected');
    }

    const panel = vscode.window.createWebviewPanel('agentStepsWebview', 'Agent Steps', vscode.ViewColumn.One, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(defaultPath, 'agent-steps', 'dist'))]
    });

    // Base URI for loading assets
    const baseUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(defaultPath, 'agent-steps', 'dist')));

    // Get index.html path
    const indexPath = vscode.Uri.file(path.join(defaultPath, 'agent-steps', 'dist', 'index.html'));

    // Convert index.html to a valid Webview URI
    const indexUri = panel.webview.asWebviewUri(indexPath);
    console.log('Webview Index URI:', indexUri.toString());

    // Load HTML in Webview
    panel.webview.html = getWebviewContent(indexUri.toString(), baseUri.toString());
  });
};

const getWebviewContent = (indexUri: string, _baseUri: string): string => {
  return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Agent Steps</title>
        </head>
        <body>
            <h1>Webview Loaded!</h1>
            <p>Loading React app...</p>
            <div id="root"></div>
            <p>... loaded React app</p>
            <script type="module" src="${indexUri}"></script>
        </body>
        </html>
    `;
};
