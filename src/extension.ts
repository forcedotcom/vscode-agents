/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
import { initializeDiagnosticCollection } from './commands/validateAgent';

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

    // Initialize diagnostic collection for agent validation
    initializeDiagnosticCollection(context);

    // Register commands before initializing `testRunner`
    const disposables: vscode.Disposable[] = [];
    disposables.push(commands.registerOpenAgentInOrgCommand());
    disposables.push(commands.registerActivateAgentCommand());
    disposables.push(commands.registerDeactivateAgentCommand());
    disposables.push(commands.registerValidateAgentCommand());
    disposables.push(commands.registerPreviewAgentCommand());
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
      throw new Error('sf CLI + plugin-agent installed required');
    }
  } catch {
    throw new Error('Failed to validate sf CLI and plugin-agent installation');
  }
};

const registerAgentCombinedView = (context: vscode.ExtensionContext): vscode.Disposable => {
  // Register webview to be disposed on extension deactivation
  const provider = new AgentCombinedViewProvider(context);
  const disposables: vscode.Disposable[] = [];

  // Register the webview provider
  disposables.push(
    vscode.window.registerWebviewViewProvider(AgentCombinedViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // Shared function for selecting and running an agent
  const selectAndRunAgent = async () => {
    const { Agent } = await import('@salesforce/agents');
    const channelService = CoreExtensionService.getChannelService();

    try {
      // Check if there's already an agent selected in the dropdown
      const currentAgentId = provider.getCurrentAgentId();
      if (currentAgentId) {
        // Restart the currently selected agent without showing the palette
        await vscode.commands.executeCommand('sf.agent.combined.view.focus');
        provider.selectAndStartAgent(currentAgentId);
        return;
      }

      const conn = await CoreExtensionService.getDefaultConnection();
      const remoteAgents = await Agent.listRemote(conn);

      if (!remoteAgents || remoteAgents.length === 0) {
        vscode.window.showErrorMessage('Could not find agents in the org.');
        channelService.appendLine('Could not find agents in the org.');
        return;
      }

      // Filter to only agents with active BotVersions
      const activeAgents = remoteAgents
        .filter(bot => {
          return bot.BotVersions?.records?.some(version => version.Status === 'Active');
        })
        .map(bot => ({
          label: bot.MasterLabel || bot.DeveloperName || 'Unknown Agent',
          description: bot.DeveloperName,
          id: bot.Id
        }))
        .filter(agent => agent.id);

      if (activeAgents.length === 0) {
        vscode.window.showErrorMessage('No active agents found in the org.');
        channelService.appendLine('No active agents found in the org.');
        return;
      }

      const selectedAgent = await vscode.window.showQuickPick(activeAgents, {
        placeHolder: 'Select an agent to run'
      });

      if (selectedAgent) {
        // Reveal the Agentforce DX panel
        await vscode.commands.executeCommand('sf.agent.combined.view.focus');

        // Select and start the agent in the webview
        provider.selectAndStartAgent(selectedAgent.id);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to list agents: ${errorMessage}`);
      channelService.appendLine(`Failed to list agents: ${errorMessage}`);
    }
  };

  // Register toolbar commands
  disposables.push(vscode.commands.registerCommand('sf.agent.combined.view.run', selectAndRunAgent));

  disposables.push(vscode.commands.registerCommand('sf.agent.selectAndRun', selectAndRunAgent));

  disposables.push(
    vscode.commands.registerCommand('sf.agent.combined.view.stop', async () => {
      await provider.endSession();
    })
  );

  disposables.push(
    vscode.commands.registerCommand('sf.agent.combined.view.debug', async () => {
      await provider.toggleDebugMode();
    })
  );

  disposables.push(
    vscode.commands.registerCommand('sf.agent.combined.view.debugStop', async () => {
      await provider.toggleDebugMode();
    })
  );

  return vscode.Disposable.from(...disposables);
};
