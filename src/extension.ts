/**
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/
import * as vscode from 'vscode';
import * as commands from './commands';
import { getTestOutlineProvider } from './views/testOutlineProvider';
import { AgentTestRunner } from './views/testRunner';
import { Commands } from './enums/commands';
import type { AgentTestGroupNode, TestNode } from './types';
import { CoreExtensionService } from './services/coreExtensionService';

// This method is called when your extension is activated
export async function activate(context: vscode.ExtensionContext) {
  const extensionHRStart = process.hrtime();

  try {
    // Load dependencies in the background to avoid blocking activation
    CoreExtensionService.loadDependencies(context).catch((err: Error) =>
      console.error('Error loading core dependencies:', err)
    );

    // Validate CLI installation in the background
    validateCLI().catch((err: Error) => {
      console.error('CLI validation failed:', err.message);
      vscode.window.showErrorMessage('CLI validation failed. Some features might not work correctly.');
    });

    // Register commands before initializing `testRunner`
    const disposables: vscode.Disposable[] = [];
    disposables.push(commands.registerOpenAgentInOrgCommand());
    context.subscriptions.push(registerTestView());

    // Update the test view without blocking activation
    setTimeout(() => getTestOutlineProvider().refresh(), 0);

    context.subscriptions.push(...disposables);

    const telemetryService = CoreExtensionService.getTelemetryService();
    telemetryService.sendExtensionActivationEvent(extensionHRStart);
  } catch (err: unknown) {
    throw new Error(`Failed to initialize: ${(err as Error).message}`);
  }
}

const registerTestView = (): vscode.Disposable => {
  const testOutlineProvider = getTestOutlineProvider();
  const testViewItems: vscode.Disposable[] = [];

  const testProvider = vscode.window.registerTreeDataProvider('sf.agent.test.view', testOutlineProvider);
  testViewItems.push(testProvider);

  // Delay the creation of `testRunner` until needed
  testViewItems.push(
    vscode.commands.registerCommand(Commands.goToDefinition, (test: TestNode) => {
      const testRunner = new AgentTestRunner(testOutlineProvider);
      testRunner.goToTest(test);
    })
  );

  testViewItems.push(
    vscode.commands.registerCommand(Commands.runTest, (test: AgentTestGroupNode) => {
      const testRunner = new AgentTestRunner(testOutlineProvider);
      testRunner.runAgentTest(test);
    })
  );
  testViewItems.push(vscode.commands.registerCommand(Commands.refreshTestView, () => testOutlineProvider.refresh()));

  testViewItems.push(vscode.commands.registerCommand(Commands.collapseAll, () => testOutlineProvider.collapseAll()));

  return vscode.Disposable.from(...testViewItems);
};

const validateCLI = async () => {
  try {
    const { exec } = await import('child_process');
    const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      exec('sf version --verbose --json', (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
    if (!stdout.includes('agent')) {
      throw new Error('sf CLI + plugin-agent installed required');
    }
  } catch {
    throw new Error('Failed to validate sf CLI and plugin-agent installation');
  }
};
