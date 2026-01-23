import * as vscode from 'vscode';
import * as path from 'path';
import * as YAML from 'yaml';
import { Commands } from '../enums/commands';
import { ScriptAgent } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { SfProject, generateApiName } from '@salesforce/core';

export const registerCreateAiAuthoringBundleCommand = () => {
  return vscode.commands.registerCommand(Commands.createAiAuthoringBundle, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const channelService = CoreExtensionService.getChannelService();
    telemetryService.sendCommandEvent(Commands.createAiAuthoringBundle);

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
        placeHolder: 'My Agent Bundle',
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
          .filter(([name, type]) => type === vscode.FileType.File && (name.endsWith('.yaml') || name.endsWith('.yml')))
          .map(([name]) => name);
      } catch (error) {
        channelService.appendLine(`No agent spec directory found at ${specsDir}`);
      }

      // Show dropdown with available spec files
      if (specFiles.length === 0) {
        vscode.window.showErrorMessage(
          `No agent spec YAML files found in ${specsDir}. You must add at least one agent spec YAML file to continue.`
        );
        return;
      }

      const selectedSpec = await vscode.window.showQuickPick(specFiles, {
        placeHolder: 'Select an agent spec YAML file to generate the authoring bundle from.',
        title: 'Choose Agent Spec'
      });

      if (!selectedSpec) {
        return; // User cancelled
      }

      const specPath = path.join(specsDir, selectedSpec);

      // Read and parse the YAML spec file
      const specContent = await vscode.workspace.fs.readFile(vscode.Uri.file(specPath));
      const specData = YAML.parse(Buffer.from(specContent).toString());

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Generating authoring bundle: ${apiName}...`,
          cancellable: false
        },
        async progress => {
          try {
            progress.report({ message: 'Creating authoring bundle structure...', increment: 50 });
            await new Promise(resolve => setTimeout(resolve, 300));

            progress.report({ message: 'Generating Agent Script file...' });

            // Create the agent script using the spec
            await ScriptAgent.createAuthoringBundle({
              agentSpec: { ...specData, ...{ name, developerName: apiName } },
              project: project as any,
              bundleApiName: apiName,
              outputDir: targetDir // Specify where to create the bundle
            });

            progress.report({ message: 'Complete!', increment: 100 });

            // Open the agent file
            // Agent.createAuthoringBundle creates the file at outputDir/aiAuthoringBundles/bundleApiName/bundleApiName.agent
            const agentFilePath = path.join(targetDir, 'aiAuthoringBundles', apiName, `${apiName}.agent`);
            const doc = await vscode.workspace.openTextDocument(agentFilePath);
            await vscode.window.showTextDocument(doc);
            // Wait a moment to show success
            await new Promise(resolve => setTimeout(resolve, 1000));
            vscode.window.showInformationMessage(`Authoring bundle "${name}" was generated successfully.`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            channelService.showChannelOutput();
            channelService.appendLine('❌ Failed to generate authoring bundle.');
            channelService.appendLine('────────────────────────────────────────────────────────────────────────');
            channelService.appendLine(errorMessage || 'Something went wrong');
            throw error;
          }
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to generate authoring bundle: ${errorMessage}`);
    }
  });
};
