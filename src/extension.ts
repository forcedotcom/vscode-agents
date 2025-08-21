/**
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/
import * as vscode from 'vscode';
import * as commands from './commands';
import { Commands } from './enums/commands';
import { CoreExtensionService } from './services/coreExtensionService';
import type { AgentTestGroupNode, TestNode } from './types';
import type { TelemetryService } from './types/TelemetryService';
import { AgentCombinedViewProvider } from './views/agentCombinedViewProvider';
import { getTestOutlineProvider } from './views/testOutlineProvider';
import { AgentTestRunner } from './views/testRunner';
import { toggleGeneratedDataOn, toggleGeneratedDataOff } from './commands/toggleGeneratedData';

// This method is called when your extension is activated
export async function activate(context: vscode.ExtensionContext) {
  const extensionHRStart = process.hrtime();

  try {
    let telemetryService: TelemetryService | undefined;
    // Load dependencies in the background to avoid blocking activation
    CoreExtensionService.loadDependencies(context)
      .then(() => {
        telemetryService = CoreExtensionService.getTelemetryService();
      })
      .catch((err: Error) => console.error('Error loading core dependencies:', err));

    // Validate CLI installation in the background
    validateCLI().catch((err: Error) => {
      console.error('CLI validation failed:', err.message);
      vscode.window.showErrorMessage(`Failed to validate sf CLI and plugin-agent. ${err.message}`);
    });

    // Register commands before initializing `testRunner`
    const disposables: vscode.Disposable[] = [];
    disposables.push(commands.registerOpenAgentInOrgCommand());
    disposables.push(commands.registerActivateAgentCommand());
    disposables.push(commands.registerDeactivateAgentCommand());
    context.subscriptions.push(await registerTestView());
    context.subscriptions.push(registerAgentCombinedView(context));

    // Update the test view without blocking activation
    setTimeout(() => {
      void getTestOutlineProvider().refresh();
    }, 0);
    telemetryService?.sendExtensionActivationEvent(extensionHRStart);

    context.subscriptions.push(...disposables);
  } catch (err: unknown) {
    throw new Error(`Failed to initialize: ${(err as Error).message}`);
  }
}

const registerTestView = async (): Promise<vscode.Disposable> => {
  const testOutlineProvider = getTestOutlineProvider();
  const testViewItems: vscode.Disposable[] = [];

  const testProvider = vscode.window.registerTreeDataProvider('sf.agent.test.view', testOutlineProvider);
  testViewItems.push(testProvider);
  const testRunner = new AgentTestRunner(testOutlineProvider);

  testViewItems.push(
    vscode.commands.registerCommand(Commands.goToTestResults, (test: TestNode) => {
      testRunner.displayTestDetails(test);
    })
  );
  testViewItems.push(
    vscode.commands.registerCommand(Commands.runTest, (test: AgentTestGroupNode) => {
      void testRunner.runAgentTest(test);
    })
  );
  testViewItems.push(vscode.commands.registerCommand(Commands.refreshTestView, () => testOutlineProvider.refresh()));

  testViewItems.push(vscode.commands.registerCommand(Commands.collapseAll, () => testOutlineProvider.collapseAll()));

  // Initialize generated data context based on current setting
  const updateGeneratedDataContext = async () => {
    const generatedDataConfig = vscode.workspace.getConfiguration('salesforce.agentforceDX');
    const showGeneratedData = generatedDataConfig.get<boolean>('showGeneratedData', false);
    await vscode.commands.executeCommand('setContext', 'agentforceDX:showGeneratedData', showGeneratedData);
  };

  // Listen for configuration changes
  testViewItems.push(
    vscode.workspace.onDidChangeConfiguration(async e => {
      if (e.affectsConfiguration('salesforce.agentforceDX.showGeneratedData')) {
        await updateGeneratedDataContext();
      }
    })
  );

  // Set initial context
  await updateGeneratedDataContext();

  // Register commands to toggle generated data visibility
  testViewItems.push(
    vscode.commands.registerCommand('sf.agent.test.view.toggleGeneratedData.on', async () => {
      await toggleGeneratedDataOff(); // Switch to off when clicking the "on" icon
    }),
    vscode.commands.registerCommand('sf.agent.test.view.toggleGeneratedData.off', async () => {
      await toggleGeneratedDataOn(); // Switch to on when clicking the "off" icon
    })
  );

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
      // throw new Error('sf CLI + plugin-agent installed required');
    }
  } catch {
    // throw new Error('Failed to validate sf CLI and plugin-agent installation');
  }
};

const registerAgentCombinedView = (context: vscode.ExtensionContext): vscode.Disposable => {
  // Register webview to be disposed on extension deactivation
  const provider = new AgentCombinedViewProvider(context);
  
  // Update mock file when configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('salesforce.agentforceDX.mockFile')) {
        const mockConfig = vscode.workspace.getConfiguration('salesforce.agentforceDX');
        const newMockFile = mockConfig.get<string>('mockFile');
        provider.updateMockFile(newMockFile);
      }
    })
  );

  // Set initial mock file
  const mockConfig = vscode.workspace.getConfiguration('salesforce.agentforceDX');
  const mockFile = mockConfig.get<string>('mockFile');
  provider.updateMockFile(mockFile);

  return vscode.window.registerWebviewViewProvider(
    AgentCombinedViewProvider.viewType,
    provider,
    {
      webviewOptions: { retainContextWhenHidden: true }
    }
  );
};
