import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { SfProject } from '@salesforce/core-bundle';
import * as path from 'path';

export const registerShowAgentStepsCommand = (context: any) => {
  return vscode.commands.registerCommand(Commands.showAgentSteps, async () => {
    // TODO: maybe an Agent.listLocal() or something similar in the library
    const project = SfProject.getInstance();
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

    const panel = vscode.window.createWebviewPanel(
      'exampleWebview', // Identifies the type of the webview
      'My Webview', // Title of the webview
      vscode.ViewColumn.One, // Where to show the webview
      {
        enableScripts: true // Allow JavaScript to run in the webview
      }
    );

    // Set the HTML content of the webview
    panel.webview.html = getWebviewContent();

    // Handle messages sent from the webview (optional)
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'alert':
            vscode.window.showInformationMessage(message.text);
            return;
        }
      },
      undefined,
      context.subscriptions
    );
  });
};

const getWebviewContent = (): string => {
  return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Webview</title>
            <style>
                body {
                    display: flex;
                    height: 100vh;
                    margin: 0;
                    font-family: Arial, sans-serif;
                }
                .chat-container {
                    width: 50%;
                    background-color: #f5f5f5;
                    padding: 10px;
                    overflow-y: auto;
                }
                .history-container {
                    width: 50%;
                    background-color: #fff;
                    padding: 10px;
                    border-left: 1px solid #ccc;
                    overflow-y: auto;
                }
                .chat-message {
                    background-color: #d1f7c4;
                    padding: 5px;
                    margin: 5px 0;
                    border-radius: 5px;
                }
                .history-step {
                    background-color: #e0e0e0;
                    padding: 8px;
                    margin: 5px 0;
                    border-radius: 5px;
                    font-size: 14px;
                }
                button {
                    margin-top: 10px;
                    padding: 8px 16px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #45a049;
                }
            </style>
        </head>
        <body>
            <div class="chat-container">
                <h2>Chat</h2>
                <div id="chat-messages">
                    <!-- Chat messages will go here -->
                </div>
                <textarea id="message-input" placeholder="Type your message..." rows="3" style="width: 100%;"></textarea>
                <button onclick="sendMessage()">Send</button>
            </div>
            <div class="history-container">
                <h2>History of Steps</h2>
                <div id="history">
                    <!-- History of steps will go here -->
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();

                function sendMessage() {
                    const message = document.getElementById('message-input').value;
                    if (message) {
                        // Add message to chat
                        const chatMessages = document.getElementById('chat-messages');
                        const messageDiv = document.createElement('div');
                        messageDiv.className = 'chat-message';
                        messageDiv.innerText = message;
                        chatMessages.appendChild(messageDiv);

                        // Clear the input
                        document.getElementById('message-input').value = '';

                        // Send message to extension (optional)
                        vscode.postMessage({
                            command: 'newMessage',
                            text: message
                        });
                    }
                }

                // Listen for incoming messages from the extension (optional)
                window.addEventListener('message', event => {
                    const message = event.data; // The JSON data from the extension
                    switch (message.command) {
                        case 'updateHistory':
                            updateHistory(message.steps);
                            break;
                    }
                });

                function updateHistory(steps) {
                    const historyDiv = document.getElementById('history');
                    historyDiv.innerHTML = '';
                    steps.forEach(step => {
                        const stepDiv = document.createElement('div');
                        stepDiv.className = 'history-step';
                        stepDiv.innerText = step;
                        historyDiv.appendChild(stepDiv);
                    });
                }
            </script>
        </body>
        </html>
    `;
};
