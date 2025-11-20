import * as vscode from 'vscode';
import * as path from 'path';
import * as YAML from 'yaml';
import { Commands } from '../enums/commands';
import { Agent } from '@salesforce/agents';
import { CoreExtensionService } from '../services/coreExtensionService';
import { SfProject, generateApiName } from '@salesforce/core';

export const registerCreateAiAuthoringBundleCommand = () => {
  return vscode.commands.registerCommand(Commands.createAiAuthoringBundle, async (uri?: vscode.Uri) => {
    const telemetryService = CoreExtensionService.getTelemetryService();
    const channelService = CoreExtensionService.getChannelService();
    telemetryService.sendCommandEvent(Commands.createAiAuthoringBundle);

    try {
      // Get the project root
      const project = await SfProject.getInstance();
      const projectRoot = project.getPath();

      // Determine the target directory
      let targetDir: string;
      if (uri?.fsPath) {
        targetDir = uri.fsPath;
      } else {
        // Default to the proper metadata directory structure
        const defaultPackagePath = project.getDefaultPackage().fullPath;
        targetDir = path.join(defaultPackagePath, 'main', 'default', 'aiAuthoringBundles');
      }

      // Create the aiAuthoringBundles directory if it doesn't exist
      try {
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetDir));
      } catch (error) {
        // Directory might already exist, which is fine
      }

      // Prompt for bundle name (regular name)
      const name = await vscode.window.showInputBox({
        prompt: 'Enter the name for the AI Authoring Bundle',
        placeHolder: 'My Agent Bundle',
        validateInput: value => {
          if (!value) {
            return 'Bundle name is required';
          }
          if (value.trim().length === 0) {
            return 'Bundle name cannot be empty';
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
        channelService.appendLine(`No specs directory found at ${specsDir}`);
      }

      // Show dropdown with available spec files
      if (specFiles.length === 0) {
        vscode.window.showErrorMessage(`No YAML spec files found in ${specsDir}. Please add spec files to continue.`);
        return;
      }

      const selectedSpec = await vscode.window.showQuickPick(specFiles, {
        placeHolder: 'Select a spec file to generate the agent from',
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
          title: `Creating AI Authoring Bundle: ${apiName}`,
          cancellable: false
        },
        async progress => {
          try {
            progress.report({ message: 'Generating agent script...' });

            // Create the agent script using the spec
            const agentScript = await Agent.createAgentScript(await CoreExtensionService.getDefaultConnection(), {
              ...specData,
              ...{ name, developerName: apiName }
            });

            if (!agentScript) {
              throw new Error('Failed to generate agent script');
            }

            progress.report({ message: 'Creating bundle structure...', increment: 50 });

            // Create the bundle directory
            const bundleDir = path.join(targetDir, apiName);
            const bundleDirUri = vscode.Uri.file(bundleDir);
            await vscode.workspace.fs.createDirectory(bundleDirUri);

            // Create the .bundle-meta.xml file
            const metaXml = `<?xml version="1.0" encoding="UTF-8"?>
<aiAuthoringBundle>
  <Label>${name}</Label>
  <BundleType>customer</BundleType>
  <VersionTag>Spring2026</VersionTag>
  <VersionDescription>Initial release for ${name}</VersionDescription>
  <SourceBundleVersion></SourceBundleVersion>
  <Target>${apiName}</Target>
</aiAuthoringBundle>
`;

            const metaXmlPath = path.join(bundleDir, `${apiName}.bundle-meta.xml`);
            await vscode.workspace.fs.writeFile(vscode.Uri.file(metaXmlPath), Buffer.from(metaXml, 'utf-8'));

            // Create the .agent file
            const agentFilePath = path.join(bundleDir, `${apiName}.agent`);
            await vscode.workspace.fs.writeFile(vscode.Uri.file(agentFilePath), Buffer.from(agentScript, 'utf-8'));

            progress.report({ message: 'Complete!', increment: 100 });

            // Wait a moment to show success
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Open the agent file
            const doc = await vscode.workspace.openTextDocument(agentFilePath);
            await vscode.window.showTextDocument(doc);

            vscode.window.showInformationMessage(`AI Authoring Bundle "${name}" created successfully! 🎉`);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            channelService.showChannelOutput();
            channelService.appendLine('❌ Failed to create AI Authoring Bundle');
            channelService.appendLine('────────────────────────────────────────────────────────────────────────');
            channelService.appendLine(errorMessage || 'Something went wrong');
            throw error;
          }
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to create AI Authoring Bundle: ${errorMessage}`);
    }
  });
};
