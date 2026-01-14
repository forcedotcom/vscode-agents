import * as vscode from 'vscode';
import type { ApexLog } from '@salesforce/types/tooling';
import { CoreExtensionService } from '../../../services/coreExtensionService';
import type { WebviewMessageSender } from '../handlers/webviewMessageSender';

/**
 * Manages Apex debugging functionality
 */
export class ApexDebugManager {
  constructor(private readonly messageSender: WebviewMessageSender) {}

  /**
   * Automatically continues the Apex Replay Debugger after it's launched
   */
  setupAutoDebugListeners(): void {
    let debuggerLaunched = false;
    const disposables: vscode.Disposable[] = [];

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

          cleanup();
        }, 1000);
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

  /**
   * Saves an Apex debug log to disk and returns the file path
   */
  async saveApexDebugLog(apexLog: ApexLog, _context: vscode.ExtensionContext): Promise<string | undefined> {
    try {
      const conn = await CoreExtensionService.getDefaultConnection();
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace directory found to save the Apex debug logs.');
        return undefined;
      }

      const logId = apexLog.Id;
      if (!logId) {
        vscode.window.showErrorMessage('No Apex debug log ID found.');
        return undefined;
      }

      // Get the log content from Salesforce
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

  /**
   * Handles Apex debug log from agent response
   */
  async handleApexDebugLog(
    apexLog: ApexLog | undefined,
    context: vscode.ExtensionContext
  ): Promise<void> {
    if (!apexLog) {
      return;
    }

    try {
      const logPath = await this.saveApexDebugLog(apexLog, context);
      if (logPath) {
        try {
          this.setupAutoDebugListeners();
          await vscode.commands.executeCommand('sf.launch.replay.debugger.logfile.path', logPath);
        } catch (commandErr) {
          console.warn('Could not launch Apex Replay Debugger:', commandErr);
        }
      }
    } catch (err) {
      console.error('Error handling apex debug log:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      vscode.window.showErrorMessage(`Error processing debug log: ${errorMessage}`);
      this.messageSender.sendDebugLogError(`Error processing debug log: ${errorMessage}`);
    }
  }
}
