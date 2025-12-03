import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { SfProject, ConfigAggregator, Org, Lifecycle } from '@salesforce/core';
import { Agent, type CompilationError } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { SfError } from '@salesforce/core';
import * as path from 'path';
import { EOL } from 'os';

export const registerPublishAgentCommand = () => {
  return vscode.commands.registerCommand(Commands.publishAgent, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const channelService = CoreExtensionService.getChannelService();
    telemetryService.sendCommandEvent(Commands.publishAgent);

    // Get the file path from the context menu
    const filePath = uri?.fsPath || vscode.window.activeTextEditor?.document.fileName;

    if (!filePath) {
      vscode.window.showErrorMessage('No .agent file selected.');
      return;
    }

    // Validate that this is a .agent file
    if (!filePath.endsWith('.agent')) {
      vscode.window.showErrorMessage('This command can only be used on .agent files.');
      return;
    }

    try {
      const project = SfProject.getInstance();
      const fileName = path.basename(filePath, '.agent');

      channelService.appendLine(`Publishing agent: ${fileName}`);
      channelService.showChannelOutput();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Publishing agent: ${fileName}`,
          cancellable: false
        },
        async progress => {
          try {
            // Get connection to the org
            const connection = await CoreExtensionService.getDefaultConnection();

            // Read the agent file contents
            const fileUri = vscode.Uri.file(filePath);
            const fileContents = Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString();

            // Step 1: Compile the agent script
            progress.report({ message: 'Compiling agent...', increment: 0 });
            const compileResponse = await Agent.compileAgentScript(connection, fileContents);

            // Check if compilation failed
            if (compileResponse.status === 'failure') {
              const errorMessages = compileResponse.errors
                .map(error => `[${error.errorType}] Line ${error.lineStart}:${error.colStart} - ${error.description}`)
                .join(EOL);

              channelService.appendLine('❌ Agent compilation failed!');
              channelService.appendLine('────────────────────────────────────────────────────────────────────────');
              channelService.appendLine(`Found ${compileResponse.errors.length} error(s):`);
              channelService.appendLine(errorMessages);

              progress.report({ message: `Compilation failed with ${compileResponse.errors.length} error(s)` });

              vscode.window.showErrorMessage(
                `Agent compilation failed with ${compileResponse.errors.length} error(s). Check the output channel for details.`
              );
              return;
            }

            // Step 2: Publish the compiled agent
            progress.report({ message: 'Publishing agent...', increment: 50 });

            const lifecycle = Lifecycle.getInstance();

            // Register event listeners
            lifecycle.on('scopedPreRetrieve', async () => {
              progress.report({ message: 'Retrieving metadata...', increment: 70 });
              channelService.appendLine('Retrieving metadata from org...');
            });

            lifecycle.on('scopedPostRetrieve', async () => {
              progress.report({ message: 'Metadata retrieved successfully', increment: 90 });
              channelService.appendLine('Metadata retrieved successfully.');
            });

            try {
              await Agent.publishAgentJson(connection, project, compileResponse.compiledArtifact);
            } finally {
              // Clean up event listeners
              lifecycle.removeAllListeners('scopedPreRetrieve');
              lifecycle.removeAllListeners('scopedPostRetrieve');
            }

            progress.report({ message: 'Successfully published! 🎉', increment: 100 });
            channelService.appendLine(`Successfully published agent: ${fileName}`);

            vscode.window.showInformationMessage(`Agent "${fileName}" has been published successfully.`);
          } catch (publishError) {
            const error = SfError.wrap(publishError);
            channelService.appendLine('❌ Agent publish failed!');
            channelService.appendLine('────────────────────────────────────────────────────────────────────────');
            channelService.appendLine(`Error: ${error.message}`);

            if (error.stack) {
              channelService.appendLine('');
              channelService.appendLine('Stack Trace:');
              channelService.appendLine('────────────────────────────────────────────────────────────────────────');
              channelService.appendLine(error.stack);
            }

            progress.report({ message: 'Failed' });

            vscode.window.showErrorMessage(`Failed to publish agent: ${error.message}`);
            telemetryService.sendException('agent_publish_failed', error.message);
          }
        }
      );
    } catch (error) {
      const errorMessage = `Failed to publish agent: ${(error as Error).message}`;
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
      vscode.window.showErrorMessage(errorMessage);
      telemetryService.sendException('agent_publish_failed', errorMessage);
    }
  });
};
