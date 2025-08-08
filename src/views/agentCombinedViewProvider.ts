import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentPreview, Agent } from '@salesforce/agents-bundle';
import { CoreExtensionService } from '../services/coreExtensionService';
// import { Lifecycle } from '@salesforce/core-bundle';
import type { ApexLog } from '@salesforce/types/tooling';

export class AgentCombinedViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sf.agent.combined.view';
  private agentPreview?: AgentPreview;
  private sessionId = Date.now().toString();
  private apexDebugging = false;
  private webviewView?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {
    // Listen for configuration changes
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('agentforceDx.showAgentTracer')) {
          this.notifyConfigurationChange();
        }
      })
    );
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: vscode.WebviewViewResolveContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ) {
    this.webviewView = webviewView;
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
          
          // End existing session if one exists
          if (this.agentPreview && this.sessionId) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await this.agentPreview.end(this.sessionId, 'UserRequested' as any);
            } catch (err) {
              console.warn('Error ending previous session:', err);
            }
          }
          
          const conn = await CoreExtensionService.getDefaultConnection();

          // Extract agentId from the message data and pass it as botId
          const agentId = message.data?.agentId;
          
          if (!agentId || typeof agentId !== 'string') {
            throw new Error(`Invalid agent ID: ${agentId}. Expected a string.`);
          }
          
          // Validate that the agentId follows Salesforce Bot ID format (starts with "0X" and is 15 or 18 characters)
          if (!agentId.startsWith('0X') || (agentId.length !== 15 && agentId.length !== 18)) {
            throw new Error(`The Bot ID provided must begin with "0X" and be either 15 or 18 characters. Found: ${agentId}`);
          }
          
          console.log('Starting session with agent ID:', agentId);
          this.agentPreview = new AgentPreview(conn, agentId);
          
          // Enable debug mode if apex debugging is active
          if (this.apexDebugging) {
            this.agentPreview.toggleApexDebugMode(this.apexDebugging);
          }

          const session = await this.agentPreview.start();
          this.sessionId = session.sessionId;

          // Find the agent's welcome message or create a default one
          const agentMessage = session.messages.find(msg => msg.type === 'Inform');
          webviewView.webview.postMessage({
            command: 'sessionStarted',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: agentMessage ? { content: (agentMessage as any).message || (agentMessage as any).data || (agentMessage as any).body || "Hi! I'm ready to help. What can I do for you?" } : { content: "Hi! I'm ready to help. What can I do for you?" }
          });
        } else if (message.command === 'setApexDebugging') {
          this.apexDebugging = message.data;
          // If we have an active agent preview, update its debug mode
          if (this.agentPreview) {
            this.agentPreview.toggleApexDebugMode(this.apexDebugging);
          }
          
          webviewView.webview.postMessage({
            command: 'debugModeChanged',
            data: { enabled: this.apexDebugging }
          });
        } else if (message.command === 'sendChatMessage') {
          if (!this.agentPreview || !this.sessionId) {
            throw new Error('Session has not been started.');
          }

          webviewView.webview.postMessage({
            command: 'messageStarting',
            data: { message: 'Sending message...' }
          });

          const response = await this.agentPreview.send(this.sessionId, message.data.message);

          // Get the latest agent response
          const latestMessage = response.messages.at(-1);
          webviewView.webview.postMessage({
            command: 'messageSent',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: latestMessage ? { content: (latestMessage as any).message || (latestMessage as any).data || (latestMessage as any).body || "I received your message." } : { content: "I received your message." }
          });

          if (this.apexDebugging && response.apexDebugLog) {
            try {
              const logPath = await this.saveApexDebugLog(response.apexDebugLog);
              if (logPath) {
                // Try to launch the apex replay debugger if the command is available
                try {
                    await vscode.commands.executeCommand('sf.launch.replay.debugger.logfile.path', logPath);
                    
                    // Notify webview that debug log was processed and debugger launched
                    webviewView.webview.postMessage({
                      command: 'debugLogProcessed',
                      data: { 
                        message: `Debug log saved and Apex Replay Debugger launched. Log file: ${logPath}`,
                        logPath: logPath
                      }
                    });
             
                } catch (commandErr) {
                  // If command execution fails, just log it but don't show user message
                  console.warn('Could not launch Apex Replay Debugger:', commandErr);
                }
              }
            } catch (err) {
              console.error('Error handling apex debug log:', err);
              const errorMessage = err instanceof Error ? err.message : 'Unknown error';
              vscode.window.showErrorMessage(`Error processing debug log: ${errorMessage}`);
              
              // Notify webview about the error
              webviewView.webview.postMessage({
                command: 'debugLogError',
                data: { 
                  message: `Error processing debug log: ${errorMessage}`
                }
              });
            }
          } else if (this.apexDebugging && !response.apexDebugLog) {
            // Debug mode is enabled but no debug log was returned
            webviewView.webview.postMessage({
              command: 'debugLogInfo',
              data: { 
                message: 'Debug mode is enabled, but no Apex debug log was generated for this request.'
              }
            });
          }
        } else if (message.command === 'endSession') {
          if (this.agentPreview && this.sessionId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await this.agentPreview.end(this.sessionId, 'UserRequested' as any);
            this.agentPreview = undefined;
            this.sessionId = Date.now().toString();
            webviewView.webview.postMessage({
              command: 'sessionEnded',
              data: {}
            });
          }
        } else if (message.command === 'getAvailableAgents') {
          // Get available agents from the Salesforce org
          try {
            const conn = await CoreExtensionService.getDefaultConnection();
            const remoteAgents = await Agent.listRemote(conn);
            
            if (!remoteAgents || remoteAgents.length === 0) {
              webviewView.webview.postMessage({
                command: 'availableAgents',
                data: []
              });
              return;
            }

            // Filter to only agents with active BotVersions and map to the expected format
            const activeAgents = remoteAgents
              .filter((bot) => {
                // Check if the bot has any active BotVersions
                return bot.BotVersions?.records?.some((version) => version.Status === 'Active');
              })
              .map((bot) => ({
                name: bot.MasterLabel || bot.DeveloperName || 'Unknown Agent',
                id: bot.Id // Use the Bot ID from org
              }))
              .filter((agent) => agent.id); // Only include agents with valid IDs
            
            webviewView.webview.postMessage({
              command: 'availableAgents',
              data: activeAgents
            });
          } catch (err) {
            console.error('Error getting available agents from org:', err);
            // Return empty list if there's an error
            webviewView.webview.postMessage({
              command: 'availableAgents',
              data: []
            });
          }
        } else if (message.command === 'clearChat') {
          // Clear chat doesn't need to do anything on the backend for now
          // The frontend handles clearing the message state
        } else if (message.command === 'getTraceData') {
          // TODO: Implement trace data retrieval
          // This would fetch actual trace data from the agent session
          webviewView.webview.postMessage({
            command: 'traceData',
            data: {
              sessionId: this.sessionId,
              traces: [] // Placeholder for actual trace data
            }
          });
        } else if (message.command === 'getConfiguration') {
          // Get configuration values
          const config = vscode.workspace.getConfiguration();
          const section = message.data?.section;
          if (section) {
            const value = config.get(section);
            webviewView.webview.postMessage({
              command: 'configuration',
              data: { section, value }
            });
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

  private notifyConfigurationChange() {
    if (this.webviewView) {
      const config = vscode.workspace.getConfiguration();
      const showAgentTracer = config.get('agentforceDx.showAgentTracer');
      this.webviewView.webview.postMessage({
        command: 'configuration',
        data: { section: 'agentforceDx.showAgentTracer', value: showAgentTracer }
      });
    }
  }

  private async saveApexDebugLog(apexLog: ApexLog): Promise<string | undefined> {
    try {
      const conn = await CoreExtensionService.getDefaultConnection();
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found to save apex debug logs.');
        return undefined;
      }

      const logId = apexLog.Id;
      if (!logId) {
        vscode.window.showErrorMessage('No Apex debug log ID found.');
        return undefined;
      }

      // Get the log content from Salesforce
      // Apex debug logs are retrieved via the Tooling API
      const url = `${conn.tooling._baseUrl()}/sobjects/ApexLog/${logId}/Body`;
      const logContent = await conn.tooling.request(url);

      // Apex debug logs are written to: .sfdx/tools/debug/logs
      const apexDebugLogPath = vscode.Uri.joinPath(workspaceFolder.uri, '.sfdx', 'tools', 'debug', 'logs');
      await vscode.workspace.fs.createDirectory(apexDebugLogPath);
      const filePath = vscode.Uri.joinPath(apexDebugLogPath, `${logId}.log`);

      // Write apex debug log to file
      const logContentStr = typeof logContent === 'string' ? logContent : JSON.stringify(logContent);
      await vscode.workspace.fs.writeFile(filePath, Buffer.from(logContentStr));

      vscode.window.showInformationMessage(`Apex debug log saved to ${filePath.path}`);
      return filePath.path;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      vscode.window.showErrorMessage(`Error saving Apex debug log: ${errorMessage}`);
      return undefined;
    }
  }
}