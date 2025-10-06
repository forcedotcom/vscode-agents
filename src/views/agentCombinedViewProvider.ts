import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AgentPreview, Agent, type AgentTraceResponse } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { getAvailableClientApps, createConnectionWithClientApp } from '../utils/clientAppUtils';
import type { ApexLog } from '@salesforce/types/tooling';

interface AgentMessage {
  type: string;
  message?: string;
  data?: unknown;
  body?: string;
}

export class AgentCombinedViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sf.agent.combined.view';
  private agentPreview?: AgentPreview;
  private sessionId = Date.now().toString();
  private apexDebugging = false;
  private webviewView?: vscode.WebviewView;
  private selectedClientApp?: string;
  private sessionActive = false;
  private currentAgentName?: string;

  constructor(private readonly context: vscode.ExtensionContext) {
    // Listen for configuration changes
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('salesforce.agentforceDX.showAgentTracer')) {
          this.notifyConfigurationChange();
        }
      })
    );
  }

  /**
   * Updates the session active state and context
   */
  private async setSessionActive(active: boolean): Promise<void> {
    this.sessionActive = active;
    await vscode.commands.executeCommand('setContext', 'agentforceDX:sessionActive', active);
  }

  /**
   * Selects an agent and starts a session
   * @param agentId The agent's Bot ID
   */
  public selectAndStartAgent(agentId: string): void {
    if (this.webviewView) {
      this.webviewView.webview.postMessage({
        command: 'selectAgent',
        data: { agentId }
      });
    }
  }

  /**
   * Ends the current agent session
   */
  public async endSession(): Promise<void> {
    if (this.agentPreview && this.sessionId) {
      const agentName = this.currentAgentName;
      await this.agentPreview.end(this.sessionId, 'UserRequest');
      this.agentPreview = undefined;
      this.sessionId = Date.now().toString();
      this.currentAgentName = undefined;
      await this.setSessionActive(false);

      // Show notification
      if (agentName) {
        vscode.window.showInformationMessage(`Agentforce DX: Session ended with ${agentName}`);
      }

      if (this.webviewView) {
        this.webviewView.webview.postMessage({
          command: 'sessionEnded',
          data: {}
        });
      }
    }
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
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist')]
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
              await this.agentPreview.end(this.sessionId, 'UserRequest');
            } catch (err) {
              console.warn('Error ending previous session:', err);
            }
          }

          // If a client app was previously selected, reuse it to avoid re-prompt loops
          const conn = this.selectedClientApp
            ? await createConnectionWithClientApp(this.selectedClientApp)
            : await CoreExtensionService.getDefaultConnection();

          // Extract agentId from the message data and pass it as botId
          const agentId = message.data?.agentId;

          if (!agentId || typeof agentId !== 'string') {
            throw new Error(`Invalid agent ID: ${agentId}. Expected a string.`);
          }

          // Validate that the agentId follows Salesforce Bot ID format (starts with "0X" and is 15 or 18 characters)
          if (!agentId.startsWith('0X') || (agentId.length !== 15 && agentId.length !== 18)) {
            throw new Error(
              `The Bot ID provided must begin with "0X" and be either 15 or 18 characters. Found: ${agentId}`
            );
          }

          console.log('Starting session with agent ID:', agentId);
          this.agentPreview = new AgentPreview(conn, agentId);

          // Get agent name for notifications
          const remoteAgents = await Agent.listRemote(conn);
          const agent = remoteAgents?.find(bot => bot.Id === agentId);
          this.currentAgentName = agent?.MasterLabel || agent?.DeveloperName || 'Unknown Agent';

          // Enable debug mode if apex debugging is active
          if (this.apexDebugging) {
            this.agentPreview.toggleApexDebugMode(this.apexDebugging);
          }

          const session = await this.agentPreview.start();
          this.sessionId = session.sessionId;
          await this.setSessionActive(true);

          // Show notification
          vscode.window.showInformationMessage(`Agentforce DX: Session started with ${this.currentAgentName}`);

          // Find the agent's welcome message or create a default one
          const agentMessage = session.messages.find(msg => msg.type === 'Inform') as AgentMessage;
          webviewView.webview.postMessage({
            command: 'sessionStarted',
            data: agentMessage
              ? {
                  content:
                    (agentMessage as { message?: string; data?: string; body?: string }).message ||
                    (agentMessage as { message?: string; data?: string; body?: string }).data ||
                    (agentMessage as { message?: string; data?: string; body?: string }).body ||
                    "Hi! I'm ready to help. What can I do for you?"
                }
              : { content: "Hi! I'm ready to help. What can I do for you?" }
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
            data: { content: latestMessage?.message || 'I received your message.' }
          });

          if (this.apexDebugging && response.apexDebugLog) {
            try {
              const logPath = await this.saveApexDebugLog(response.apexDebugLog);
              if (logPath) {
                // Try to launch the apex replay debugger if the command is available
                try {
                  // Auto-continue the debugger to run until it hits actual Apex code with breakpoints
                  // This eliminates the need for manual user interaction (clicking "Continue" button)
                  this.setupAutoDebugListeners();
                  await vscode.commands.executeCommand('sf.launch.replay.debugger.logfile.path', logPath);
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
                message: 'Debug mode is enabled, but no Apex was executed during the last turn of your conversation.g'
              }
            });
          }
        } else if (message.command === 'endSession') {
          if (this.agentPreview && this.sessionId) {
            const agentName = this.currentAgentName;
            await this.agentPreview.end(this.sessionId, 'UserRequest');
            this.agentPreview = undefined;
            this.sessionId = Date.now().toString();
            this.currentAgentName = undefined;
            await this.setSessionActive(false);

            // Show notification
            if (agentName) {
              vscode.window.showInformationMessage(`Agentforce DX: Session ended with ${agentName}`);
            }

            webviewView.webview.postMessage({
              command: 'sessionEnded',
              data: {}
            });
          }
        } else if (message.command === 'getAvailableAgents') {
          // First check client app requirements before getting agents
          try {
            // If a client app has already been selected, use it directly and skip prompting
            let conn;
            if (this.selectedClientApp) {
              conn = await createConnectionWithClientApp(this.selectedClientApp);
            } else {
              const clientAppResult = await getAvailableClientApps();

              // Handle the three cases
              if (clientAppResult.type === 'none') {
                // Case 1: No client app available
                webviewView.webview.postMessage({
                  command: 'clientAppRequired',
                  data: {
                    message:
                      'See "Preview an Agent" in the "Agentforce Developer Guide" for complete documentation: https://developer.salesforce.com/docs/einstein/genai/guide/agent-dx-preview.html.',
                    username: clientAppResult.username,
                    error: clientAppResult.error
                  }
                });
                return;
              } else if (clientAppResult.type === 'multiple') {
                // Case 3: Multiple client apps - need user selection
                webviewView.webview.postMessage({
                  command: 'selectClientApp',
                  data: {
                    clientApps: clientAppResult.clientApps,
                    username: clientAppResult.username
                  }
                });
                return;
              } else if (clientAppResult.type === 'single') {
                // Case 2: Single client app - use automatically
                this.selectedClientApp = clientAppResult.clientApps[0].name;
                conn = await createConnectionWithClientApp(this.selectedClientApp);
              } else {
                conn = await CoreExtensionService.getDefaultConnection();
              }
            }

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
              .filter(bot => {
                // Check if the bot has any active BotVersions
                return bot.BotVersions?.records?.some(version => version.Status === 'Active');
              })
              .map(bot => ({
                name: bot.MasterLabel || bot.DeveloperName || 'Unknown Agent',
                id: bot.Id // Use the Bot ID from org
              }))
              .filter(agent => agent.id); // Only include agents with valid IDs

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
          // Legacy no-op: kept for compatibility with older UI messages
        } else if (message.command === 'reset') {
          // Fully reset state: client app selection and session
          try {
            // End any active session
            if (this.agentPreview && this.sessionId) {
              try {
                await this.agentPreview.end(this.sessionId, 'UserRequest');
              } catch (err) {
                console.warn('Error ending session during reset:', err);
              }
            }
            this.agentPreview = undefined;
            this.sessionId = Date.now().toString();
            this.selectedClientApp = undefined;
            this.currentAgentName = undefined;
            await this.setSessionActive(false);

            // Immediately re-evaluate current org and push appropriate UI messages
            try {
              const clientAppResult = await getAvailableClientApps();
              if (clientAppResult.type === 'none') {
                webviewView.webview.postMessage({
                  command: 'clientAppRequired',
                  data: {
                    message:
                      'See "Preview an Agent" in the "Agentforce Developer Guide" for complete documentation: https://developer.salesforce.com/docs/einstein/genai/guide/agent-dx-preview.html.',
                    username: clientAppResult.username,
                    error: clientAppResult.error
                  }
                });
              } else if (clientAppResult.type === 'multiple') {
                webviewView.webview.postMessage({
                  command: 'selectClientApp',
                  data: {
                    clientApps: clientAppResult.clientApps,
                    username: clientAppResult.username
                  }
                });
              } else if (clientAppResult.type === 'single') {
                this.selectedClientApp = clientAppResult.clientApps[0].name;
                const conn = await createConnectionWithClientApp(this.selectedClientApp);
                const remoteAgents = await Agent.listRemote(conn);
                const activeAgents = (remoteAgents || [])
                  .filter(bot => bot.BotVersions?.records?.some(v => v.Status === 'Active'))
                  .map(bot => ({ name: bot.MasterLabel || bot.DeveloperName || 'Unknown Agent', id: bot.Id }))
                  .filter(a => a.id);
                webviewView.webview.postMessage({ command: 'availableAgents', data: activeAgents });
                webviewView.webview.postMessage({ command: 'clientAppReady' });
              }
            } catch (e) {
              console.error('Error reevaluating org after reset:', e);
              webviewView.webview.postMessage({ command: 'clientAppRequired', data: { error: String(e) } });
            }
          } catch (err) {
            console.error('Error during reset:', err);
          }
        } else if (message.command === 'getTraceData') {
          // Serve the sample tracer.json file from webview/src/data
          try {
            const tracerJsonPath = path.join(this.context.extensionPath, 'webview', 'src', 'data', 'tracer.json');
            if (!fs.existsSync(tracerJsonPath)) {
              throw new Error('tracer.json not found at webview/src/data/tracer.json. Please create this file to customize trace data.');
            }
            const data = JSON.parse(fs.readFileSync(tracerJsonPath, 'utf8')) as AgentTraceResponse;
            webviewView.webview.postMessage({
              command: 'traceData',
              data
            });
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            webviewView.webview.postMessage({
              command: 'error',
              data: { message: errorMessage }
            });
          }
        } else if (message.command === 'clientAppSelected') {
          // Handle client app selection (Case 3)
          try {
            const clientAppName = message.data?.clientAppName;
            if (!clientAppName) {
              throw new Error('No client app name provided');
            }

            this.selectedClientApp = clientAppName;

            // Now that we have a client app selected, create the connection
            // and then refresh the available agents
            if (!this.selectedClientApp) {
              throw new Error('Client app not set');
            }
            const conn = await createConnectionWithClientApp(this.selectedClientApp);
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
              .filter(bot => {
                // Check if the bot has any active BotVersions
                return bot.BotVersions?.records?.some(version => version.Status === 'Active');
              })
              .map(bot => ({
                name: bot.MasterLabel || bot.DeveloperName || 'Unknown Agent',
                id: bot.Id // Use the Bot ID from org
              }))
              .filter(agent => agent.id); // Only include agents with valid IDs

            // Notify the UI that client app is ready so it can clear selection UI
            webviewView.webview.postMessage({ command: 'clientAppReady' });

            // Provide updated agent list
            webviewView.webview.postMessage({ command: 'availableAgents', data: activeAgents });
          } catch (err) {
            console.error('Error selecting client app:', err);
            webviewView.webview.postMessage({
              command: 'error',
              data: { message: `Error selecting client app: ${err instanceof Error ? err.message : 'Unknown error'}` }
            });
          }
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
        let errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';

        // Check for specific agent deactivation error
        if (
          errorMessage.includes('404') &&
          errorMessage.includes('NOT_FOUND') &&
          errorMessage.includes('No valid version available')
        ) {
          errorMessage =
            'This agent is currently deactivated and cannot be used for conversations. Please activate the agent first using the "Activate Agent" right click menu option or through the Salesforce Setup.';
        }
        // Check for other common agent errors
        else if (errorMessage.includes('NOT_FOUND') && errorMessage.includes('404')) {
          errorMessage =
            'The selected agent could not be found. It may have been deleted or you may not have access to it.';
        }
        // Check for permission errors
        else if (errorMessage.includes('403') || errorMessage.includes('FORBIDDEN')) {
          errorMessage = "You don't have permission to use this agent. Please check with your administrator.";
        }

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
    const htmlPath = path.join(this.context.extensionPath, 'webview', 'dist', 'index.html');
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

  private notifyConfigurationChange(): void {
    if (this.webviewView) {
      const config = vscode.workspace.getConfiguration();
      const showAgentTracer = config.get('salesforce.agentforceDX.showAgentTracer');

      // Notify webview of configuration changes
      this.webviewView.webview.postMessage({
        command: 'configuration',
        data: { section: 'salesforce.agentforceDX.showAgentTracer', value: showAgentTracer }
      });
    }
  }

  /**
   * Automatically continues the Apex Replay Debugger after it's launched,
   * eliminating the need for manual user interaction (clicking "Continue" button).
   *
   * The debugger initially stops at the first instruction in the log, but users
   * typically want to continue execution until they reach actual Apex code where
   * they have set breakpoints. This method automates that process.
   */
  private setupAutoDebugListeners(): void {
    let debuggerLaunched = false;
    const disposables: vscode.Disposable[] = [];

    // Clean up function
    const cleanup = (): void => {
      disposables.forEach(d => d.dispose());
    };

    // Listen for debug session start
    const startDisposable = vscode.debug.onDidStartDebugSession(session => {
      console.log(`Debug session started - Type: "${session.type}", Name: "${session.name}"`);

      // Check if this is an Apex replay debugger session
      if (
        session.type === 'apex-replay' ||
        session.type === 'apex' ||
        session.name?.toLowerCase().includes('apex') ||
        session.name?.toLowerCase().includes('replay')
      ) {
        debuggerLaunched = true;
        console.log(`Apex replay debugger session detected: ${session.name}`);

        // Set up a timer to continue the debugger once it's ready
        // We need to wait for the debugger to fully initialize and stop at the first instruction
        setTimeout(async () => {
          try {
            if (vscode.debug.activeDebugSession) {
              console.log('Auto-continuing Apex replay debugger to reach breakpoints...');
              await vscode.commands.executeCommand('workbench.action.debug.continue');
              console.log('Successfully auto-continued Apex replay debugger');
            }
          } catch (continueErr) {
            console.warn('Could not auto-continue Apex replay debugger:', continueErr);
          }

          // Clean up listeners after attempting to continue
          cleanup();
        }, 1000); // 1 second delay to ensure debugger is fully ready
      }
    });
    disposables.push(startDisposable);

    // Failsafe cleanup after 15 seconds
    const timeoutDisposable = setTimeout(() => {
      if (!debuggerLaunched) {
        console.log('No Apex debugger session detected within timeout, cleaning up auto-continue listeners');
      }
      cleanup();
    }, 15000);
    disposables.push({ dispose: () => clearTimeout(timeoutDisposable) });
  }

  private async saveApexDebugLog(apexLog: ApexLog): Promise<string | undefined> {
    try {
      const conn = this.selectedClientApp
        ? await createConnectionWithClientApp(this.selectedClientApp)
        : await CoreExtensionService.getDefaultConnection();
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

      return filePath.path;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      vscode.window.showErrorMessage(`Error saving Apex debug log: ${errorMessage}`);
      return undefined;
    }
  }
}
