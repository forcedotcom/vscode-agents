import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { SfProject, ConfigAggregator, Org, Lifecycle } from '@salesforce/core';
import { Agent } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { SfError } from '@salesforce/core';
import * as path from 'path';
import { EOL } from 'os';

// Type declarations for new library API
interface CompilationError {
  errorType: string;
  lineStart: number;
  colStart: number;
  lineEnd: number;
  colEnd: number;
  description: string;
}

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
      vscode.window.showErrorMessage('You can use this command on only .agent files.');
      return;
    }

    try {
      const project = SfProject.getInstance();
      const fileName = path.basename(filePath, '.agent');

      channelService.appendLine(`Publishing agent ${fileName}...`);
      channelService.showChannelOutput();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Publishing agent: ${fileName}...`,
          cancellable: false
        },
        async progress => {
          try {
            // Get connection to the org
            const connection = await CoreExtensionService.getDefaultConnection();

            // Initialize agent instance using Agent.init()
            progress.report({ message: 'Initializing agent...', increment: 0 });
            // aabDirectory should point to the directory containing the .agent file, not the file itself
            // Ensure it's an absolute path to avoid path resolution issues
            const aabDirectory = path.resolve(path.dirname(filePath));
            const agent = await Agent.init({
              connection,
              project,
              aabDirectory
            });

            // Step 1: Validate the agent first
            progress.report({ message: 'Validating agent...', increment: 20 });
            const validateResponse = await agent.compile();

            // Check if validation failed
            if (validateResponse.status === 'failure' && validateResponse.errors) {
              const errorMessages = validateResponse.errors
                .map(
                  (error: CompilationError) =>
                    `[${error.errorType}] Line ${error.lineStart}:${error.colStart} - ${error.description}`
                )
                .join(EOL);

              channelService.appendLine('❌ Agent validation failed!');
              channelService.appendLine('────────────────────────────────────────────────────────────────────────');
              channelService.appendLine(`Found ${validateResponse.errors.length} error(s):`);
              channelService.appendLine(errorMessages);

              progress.report({ message: `Validation failed with ${validateResponse.errors.length} error(s).` });

              vscode.window.showErrorMessage(
                `Agent validation failed with ${validateResponse.errors.length} error(s). Check the Output tab for details.`
              );
              return;
            }

            // Step 2: Publish the agent
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
              await agent.publish();
            } finally {
              // Clean up event listeners
              lifecycle.removeAllListeners('scopedPreRetrieve');
              lifecycle.removeAllListeners('scopedPostRetrieve');
            }

            progress.report({ message: 'Agent published successfully.', increment: 100 });
            channelService.appendLine(`Successfully published agent ${fileName}.`);

            vscode.window.showInformationMessage(`Agent "${fileName}" was published successfully.`);
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
