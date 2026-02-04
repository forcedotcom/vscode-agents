import * as vscode from 'vscode';
import * as path from 'path';
import * as YAML from 'yaml';
import { Commands } from '../enums/commands';
import { AgentJobSpec, ScriptAgent } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { SfProject, generateApiName, SfError } from '@salesforce/core';
import { Logger } from '../utils/logger';
import { readFileSync } from 'node:fs';

export const registerCreateAiAuthoringBundleCommand = () => {
  return vscode.commands.registerCommand(Commands.createAiAuthoringBundle, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const logger = new Logger(CoreExtensionService.getChannelService());
    telemetryService.sendCommandEvent(Commands.createAiAuthoringBundle);

    // Clear previous output
    logger.clear();

    try {
      // Get the project root
      const project = SfProject.getInstance();
      const projectRoot = project.getPath();

      // Determine the target directory
      // Agent.createAuthoringBundle appends 'aiAuthoringBundles' to outputDir,
      // so we need to pass the parent directory (main/default) not the full path
      let targetDir: string;
      if (uri?.fsPath) {
        // If uri points to aiAuthoringBundles, go up one level
        if (uri.fsPath.endsWith('aiAuthoringBundles')) {
          targetDir = path.dirname(uri.fsPath);
        } else {
          targetDir = uri.fsPath;
        }
      } else {
        // Default to the proper metadata directory structure (main/default, not including aiAuthoringBundles)
        const defaultPackagePath = project.getDefaultPackage().fullPath;
        targetDir = path.join(defaultPackagePath, 'main', 'default');
      }

      // Create the aiAuthoringBundles directory if it doesn't exist
      const aiAuthoringBundlesDir = path.join(targetDir, 'aiAuthoringBundles');
      try {
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(aiAuthoringBundlesDir));
      } catch (error) {
        // Directory might already exist, which is fine
      }

      // Prompt for bundle name (regular name)
      const name = await vscode.window.showInputBox({
        prompt: 'Enter the name of the new authoring bundle.',
        placeHolder: 'My Agent Name',
        validateInput: value => {
          if (!value) {
            return 'Bundle name is required';
          }
          if (value.trim().length === 0) {
            return "Bundle name can't be empty.";
          }
          return null;
        }
      });

      if (!name) {
        return; // User cancelled
      }

      // Generate API name from the regular name
      const apiName = generateApiName(name);

      // Look for spec files in the specs directory (at project root)
      const specsDir = path.join(projectRoot, 'specs');
      let specFiles: string[] = [];

      try {
        const specDirUri = vscode.Uri.file(specsDir);
        const files = await vscode.workspace.fs.readDirectory(specDirUri);
        specFiles = files
          .filter(
            ([fileName, type]) =>
              type === vscode.FileType.File && (fileName.endsWith('.yaml') || fileName.endsWith('.yml'))
          )
          .map(([fileName]) => fileName);
      } catch (error) {
        logger.warn(`No agent spec directory found at ${specsDir}`);
      }

      type SpecTypePickItem = vscode.QuickPickItem & { isCustom: boolean };
      const specTypeItems: SpecTypePickItem[] = [
        {
          label: 'Default Agent Spec',
          description: 'Create bundle without a custom spec',
          isCustom: false
        },
        ...(specFiles.length > 0
          ? [
              {
                label: 'Custom Agent Spec',
                description: 'Choose from available spec files',
                isCustom: true
              }
            ]
          : [])
      ];

      const selectedType = await vscode.window.showQuickPick(specTypeItems, {
        placeHolder: 'Select the type of agent spec to use.',
        title: 'Choose Agent Spec Type'
      });

      if (!selectedType) {
        return; // User cancelled
      }

      let spec: string | undefined;

      if (selectedType.isCustom) {
        const selectedSpecFile = await vscode.window.showQuickPick(specFiles, {
          placeHolder: 'Select an agent spec YAML file.',
          title: 'Choose Agent Spec File'
        });

        if (!selectedSpecFile) {
          return; // User cancelled
        }

        spec = path.join(specsDir, selectedSpecFile);
      }

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Generating authoring bundle: ${apiName}...`,
          cancellable: false
        },
        async progress => {
          progress.report({ message: 'Creating authoring bundle structure...', increment: 50 });
          await new Promise(resolve => setTimeout(resolve, 300));

          progress.report({ message: 'Generating Agent Script file...' });

          await ScriptAgent.createAuthoringBundle({
            project,
            agentSpec: spec
              ? {
                  ...(YAML.parse(readFileSync(spec, 'utf8')) as AgentJobSpec),
                  ...{ name, developerName: apiName }
                }
              : undefined,
            bundleApiName: apiName,
            outputDir: targetDir
          });

          progress.report({ message: 'Complete!', increment: 100 });

          // Open the agent file
          // Agent.createAuthoringBundle creates the file at outputDir/aiAuthoringBundles/bundleApiName/bundleApiName.agent
          const agentFilePath = path.join(targetDir, 'aiAuthoringBundles', apiName, `${apiName}.agent`);
          const doc = await vscode.workspace.openTextDocument(agentFilePath);
          await vscode.window.showTextDocument(doc);

          // Refresh agent list and auto-select the newly created agent
          await vscode.commands.executeCommand('sf.agent.combined.view.refreshAgents', apiName);

          vscode.window.showInformationMessage(`Authoring bundle "${name}" was generated successfully.`);
        }
      );
    } catch (error) {
      const sfError = SfError.wrap(error);
      const errorMessage = `Failed to generate authoring bundle: ${sfError.message}`;
      logger.error(errorMessage, sfError);
      vscode.window.showErrorMessage(errorMessage);
      telemetryService.sendException('createAiAuthoringBundle_failed', errorMessage);
    }
  });
};
