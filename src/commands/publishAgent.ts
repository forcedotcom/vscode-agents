import * as vscode from 'vscode';
import { Commands } from '../enums/commands';
import { SfProject, Lifecycle } from '@salesforce/core';
import { Agent } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { SfError } from '@salesforce/core';
import * as path from 'path';
import { EOL } from 'os';
import { Logger } from '../utils/logger';

// Type declarations for new library API
interface CompilationError {
  errorType: string;
  lineStart: number;
  colStart: number;
  lineEnd: number;
  colEnd: number;
  description: string;
}

/**
 * Set by @salesforce/agents as `data.publishedAgent` on an error thrown after the publish POST
 * already committed a new BotVersion (forcedotcom/agents#403). Declared structurally so this
 * works with @salesforce/agents versions that don't export the type yet.
 */
export interface PublishedAgentInfo {
  developerName: string;
  botId: string;
  botVersionId: string;
  versionNumber?: number;
  target?: string;
  failedStep?: string;
}

const FAILED_STEP_LABELS: Record<string, string> = {
  botVersionLookup: 'version lookup',
  retrieve: 'metadata retrieve',
  bundleDeploy: 'authoring bundle deploy'
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Returns the recovery actions on a publish error. Reads the original error too, in case
 * SfError.wrap built a new error (for example, when two copies of @salesforce/core are installed).
 */
export const getErrorActions = (original: unknown, sfError: SfError): string[] => {
  const candidates = [sfError.actions, isRecord(original) ? original.actions : undefined];
  const actions = candidates.find(c => Array.isArray(c) && c.length > 0) as unknown[] | undefined;
  return (actions ?? []).filter((a): a is string => typeof a === 'string' && a.trim().length > 0);
};

/**
 * Returns `data.publishedAgent` when the publish committed a BotVersion before failing, otherwise undefined.
 */
export const getPublishedAgent = (original: unknown, sfError: SfError): PublishedAgentInfo | undefined => {
  const dataCandidates = [sfError.data, isRecord(original) ? original.data : undefined];
  for (const data of dataCandidates) {
    const publishedAgent = isRecord(data) ? data.publishedAgent : undefined;
    if (isRecord(publishedAgent) && typeof publishedAgent.botVersionId === 'string') {
      return publishedAgent as unknown as PublishedAgentInfo;
    }
  }
  return undefined;
};

/** Trims the text and ends it with a period unless it already ends with sentence punctuation. */
export const toSentence = (text: string): string => {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

export const formatPublishedAgentFailure = (
  fileName: string,
  publishedAgent: PublishedAgentInfo,
  errorMessage: string
): string => {
  const publishedAs =
    publishedAgent.versionNumber !== undefined
      ? `version ${publishedAgent.versionNumber} (BotVersion ${publishedAgent.botVersionId})`
      : `BotVersion ${publishedAgent.botVersionId}`;
  const label = publishedAgent.failedStep ? FAILED_STEP_LABELS[publishedAgent.failedStep] : undefined;
  const step = label ? `the ${label} step` : 'a later step';
  const sentence = toSentence(errorMessage);
  return (
    `Agent "${fileName}" was published to the org as ${publishedAs}, but ${step} failed: ${sentence} ` +
    `Don't publish again, because that creates a duplicate version. See the Output panel for next steps.`
  );
};

export const registerPublishAgentCommand = () => {
  return vscode.commands.registerCommand(Commands.publishAgent, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const logger = new Logger(CoreExtensionService.getChannelService());
    const commandName = Commands.publishAgent;
    const hrstart = process.hrtime();
    telemetryService?.sendCommandEvent(commandName, hrstart, { commandName });

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

      // Clear previous output
      logger.clear();

      // Log SF_SKIP_RETRIEVE setting value
      logger.debug(`SF_SKIP_RETRIEVE = ${process.env.SF_SKIP_RETRIEVE ?? 'false'}`);
      logger.debug(`Publishing agent ${fileName}...`);

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Publish: ${fileName}`,
          cancellable: false
        },
        async progress => {
          try {
            // Get connection to the org
            const connection = await CoreExtensionService.getDefaultConnection();

            // Initialize agent instance using Agent.init()
            progress.report({ message: 'Initializing', increment: 0 });
            // Extract just the name (basename) from the directory containing the .agent file
            const aabDirectory = path.resolve(path.dirname(filePath));
            const aabName = path.basename(aabDirectory);
            const agent = await Agent.init({
              connection,
              project,
              aabName
            });

            // Step 1: Validate the agent first
            progress.report({ message: 'Validating', increment: 20 });
            const validateResponse = await agent.compile();

            // Check if validation failed
            if (validateResponse.status === 'failure' && validateResponse.errors) {
              const errorMessages = validateResponse.errors
                .map(
                  (error: CompilationError) =>
                    `[${error.errorType}] Line ${error.lineStart}:${error.colStart} - ${error.description}`
                )
                .join(EOL);

              logger.error(`Agent validation failed with ${validateResponse.errors.length} error(s)`);
              errorMessages.split(EOL).forEach((errorLine, index) => {
                if (errorLine.trim()) {
                  logger.errorDetail(`${index + 1}. ${errorLine}`);
                }
              });

              progress.report({ message: `Validation failed with ${validateResponse.errors.length} error(s)` });

              vscode.window.showErrorMessage(
                `Agent validation failed with ${validateResponse.errors.length} error(s). See the Problems panel for details.`
              );
              return;
            }

            // Step 2: Publish the agent
            progress.report({ message: 'Publishing', increment: 50 });

            const lifecycle = Lifecycle.getInstance();

            // Register event listeners
            lifecycle.on('scopedPreRetrieve', async () => {
              progress.report({ message: 'Retrieving metadata', increment: 70 });
              logger.debug('Retrieving metadata from org...');
            });

            lifecycle.on('scopedPostRetrieve', async () => {
              progress.report({ message: 'Metadata retrieved', increment: 90 });
              logger.debug('Metadata retrieved successfully.');
            });

            try {
              await agent.publish(
                  vscode.workspace
                  .getConfiguration('salesforce.agentforceDX')
                  .get<boolean>('skipRetrieve', false));
            } finally {
              // Clean up event listeners
              lifecycle.removeAllListeners('scopedPreRetrieve');
              lifecycle.removeAllListeners('scopedPostRetrieve');
            }

            progress.report({ message: 'Published successfully', increment: 100 });
            vscode.window.showInformationMessage(`Agent "${fileName}" was published successfully.`);
          } catch (publishError) {
            const sfError = SfError.wrap(publishError);
            logger.error('Agent publish failed', sfError);

            const actions = getErrorActions(publishError, sfError);
            if (actions.length > 0) {
              logger.error('Next steps:');
              actions.forEach((action, index) => logger.errorDetail(`${index + 1}. ${action}`));
            }

            const publishedAgent = getPublishedAgent(publishError, sfError);
            if (publishedAgent) {
              // The BotVersion was committed before a later step failed. Publishing again creates a
              // duplicate version, so don't suggest it; point at the recovery steps instead.
              progress.report({ message: 'Published, but a later step failed' });
              logger.show();
              vscode.window.showErrorMessage(formatPublishedAgentFailure(fileName, publishedAgent, sfError.message));
              telemetryService?.sendException('agent_publish_post_commit_failed', sfError.message);
              return;
            }

            progress.report({ message: 'Publish failed' });

            vscode.window.showErrorMessage(
              actions.length > 0
                ? `Failed to publish agent: ${toSentence(sfError.message)} See the Output panel for next steps.`
                : `Failed to publish agent: ${sfError.message}`
            );
            telemetryService?.sendException('agent_publish_failed', sfError.message);
          }
        }
      );
    } catch (error) {
      const sfError = SfError.wrap(error);
      const errorMessage = `Failed to publish agent: ${sfError.message}`;
      logger.error(errorMessage, sfError);
      vscode.window.showErrorMessage(errorMessage);
      telemetryService?.sendException('agent_publish_failed', errorMessage);
    }
  });
};
