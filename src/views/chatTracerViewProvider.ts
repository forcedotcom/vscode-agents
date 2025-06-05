import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { Lifecycle } from '@salesforce/core-bundle';
import { AgentPreviewSendResponse } from '@salesforce/agents-bundle';
interface TopicDetails {
  name: string;
  description: string;
  instructions: string[];
  actions: string[];
}

interface PromptDetails {
  prompt: string;
  topic: TopicDetails;
  reasoning: string;
  response: string;
  planId: string;
}

export interface SessionDetails {
  id: string;
  startTime: string;
  prompts: PromptDetails[];
}
export class ChatTracerViewProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new ChatTracerViewProvider(context);
    return vscode.window.registerCustomEditorProvider(Commands.showChatTracer, provider, {
      webviewOptions: { retainContextWhenHidden: true }
    });
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveCustomTextEditor(_document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'agent-trace', 'dist')]
    };

    // @ts-expect-error non-async function
    Lifecycle.getInstance().on('chatResponse', (data: AgentPreviewSendResponse) => {
      // TODO: Add agent trace to library (TD-0244806)
      //  below is a theoretical snippet, and info/type to use as mock
      // const conn = await CoreExtensionService.getDefaultConnection()
      // const agent = new Agent(conn)
      // const traceInfo = Agent.trace(data.messages.get(0).id)
      const traceInfo: SessionDetails = {
        startTime: new Date().toString(),
        id: data.messages?.at(0)?.id ?? 'undefined',
        prompts: [
          {
            prompt: "hello, what's the weather like",
            planId: data.messages?.at(0)?.planId ?? 'undefined plan id',
            topic: {
              name: 'Weather Information',
              description: 'provide information about the weather, like temperature, wind',
              instructions: [
                'If the user inquires about specific weather conditions (e.g., rain, wind), include this information in your response.',
                'If a user requests a forecast, imagine a detailed weather forecast for the next 7 days for Coral Cloud Resort and Port Aurelia.'
              ],
              actions: []
            },
            reasoning:
              'SMALL_TALK: The response is small talk, as it is asking the user for more information without providing any specific data. Nothing in the response indicates a prompt injection.',
            response: data.messages?.at(0)?.message ?? 'undefined response'
          }
        ]
      };

      webviewPanel.webview.postMessage({ command: 'setTrace', data: traceInfo });
    });

    // Get correct path to the CSS file
    const styleUri = webviewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'agent-trace', 'dist', 'assets', 'index.css')
    );

    const indexPath = vscode.Uri.joinPath(this.context.extensionUri, 'agent-trace', 'dist', 'assets', 'index.js');

    const indexUri = webviewPanel.webview.asWebviewUri(indexPath);
    webviewPanel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Agentforce DX: Agent Chat Trace</title>
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
