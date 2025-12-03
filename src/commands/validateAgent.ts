import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { Agent, type CompilationError } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { SfError } from '@salesforce/core';

// Diagnostic collection for agent validation errors
let diagnosticCollection: vscode.DiagnosticCollection;

export function initializeDiagnosticCollection(context: vscode.ExtensionContext) {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('agentValidation');
  context.subscriptions.push(diagnosticCollection);
}

export const registerValidateAgentCommand = () => {
  return vscode.commands.registerCommand(Commands.validateAgent, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const channelService = CoreExtensionService.getChannelService();
    telemetryService.sendCommandEvent(Commands.validateAgent);

    // Get the file path from the context menu
    const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName;

    if (!filePath) {
      vscode.window.showErrorMessage('No .agent file selected.');
      return;
    }

    const fileUri = vscode.Uri.file(filePath);
    const fileContents = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString();

    // Show progress notification with spinner
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Validating agent...',
        cancellable: false
      },
      async progress => {
        try {
          const response = await Agent.compileAgentScript(
            await CoreExtensionService.getDefaultConnection(),
            fileContents
          );

          // Type guard to check if response has errors (compilation failure)
          if (response.status === 'failure') {
            // Parse and display compilation errors in Problems panel
            const diagnostics: vscode.Diagnostic[] = response.errors.map((error: CompilationError) => {
              const range = new vscode.Range(
                new vscode.Position(Math.max(0, error.lineStart - 1), Math.max(0, error.colStart - 1)),
                new vscode.Position(Math.max(0, error.lineEnd - 1), Math.max(0, error.colEnd - 1))
              );

              const diagnostic = new vscode.Diagnostic(range, error.description, vscode.DiagnosticSeverity.Error);
              diagnostic.source = 'Agent Validation';
              diagnostic.code = error.errorType;

              return diagnostic;
            });

            diagnosticCollection.set(fileUri, diagnostics);

            // Also show in output channel
            channelService.showChannelOutput();
            channelService.clear();
            channelService.appendLine('❌ Agent validation failed.');
            channelService.appendLine('────────────────────────────────────────────────────────────────────────');
            channelService.appendLine(`Found ${response.errors.length} error(s):\n`);
            response.errors.forEach((error: CompilationError, index: number) => {
              channelService.appendLine(`${index + 1}. [${error.errorType}] Line ${error.lineStart}:${error.colStart}`);
              channelService.appendLine(`   ${error.description}\n`);
            });

            // Update progress message to show failure
            progress.report({ message: `Failed with ${response.errors.length} error(s).` });

            // Wait a moment so user can see the failure message
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Automatically focus on the Problems panel to show errors
            await vscode.commands.executeCommand('workbench.action.problems.focus');
          } else {
            // Compilation successful
            diagnosticCollection.clear();

            // Update progress message to show success
            progress.report({ message: 'Successful!', increment: 100 });

            // Keep the success message visible for a moment
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (compileError) {
          const error = SfError.wrap(compileError);
          // Clear diagnostics for unexpected errors
          diagnosticCollection.clear();
          // Show the output channel
          channelService.showChannelOutput();
          channelService.clear();
          // Show error details in output
          channelService.appendLine('❌ Agent validation failed.');
          channelService.appendLine('────────────────────────────────────────────────────────────────────────');
          channelService.appendLine(error.message || 'Something went wrong.');

          // Update progress to show error
          progress.report({ message: 'Failed' });
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Show error message for unexpected errors
          vscode.window.showErrorMessage(`Agent validation failed: ${error.message}`);
        }
      }
    );
  });
};
