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
import * as path from 'path';
import * as commands from './commands';
import { Commands } from './enums/commands';
import { CoreExtensionService } from './services/coreExtensionService';
import type { AgentTestGroupNode, TestNode } from './types';
import type { TelemetryService } from './types/TelemetryService';
import { AgentCombinedViewProvider } from './views/agentCombinedViewProvider';
import { AgentSource } from '@salesforce/agents';
import { getTestOutlineProvider } from './views/testOutlineProvider';
import { AgentTestRunner } from './views/testRunner';
import { toggleGeneratedDataOn, toggleGeneratedDataOff } from './commands/toggleGeneratedData';
import { initializeDiagnosticCollection } from './commands/validateAgent';

// Export the provider instance for testing purposes
let agentCombinedViewProviderInstance: AgentCombinedViewProvider | undefined;

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
      vscode.window.showErrorMessage(`Failed to validate Salesforce CLI and the plugin-agent. ${err.message}`);
    });

    // Initialize diagnostic collection for agent validation
    initializeDiagnosticCollection(context);

    // Initialize and watch SF_TEST_API setting
    const updateTestApiEnv = () => {
      const config = vscode.workspace.getConfiguration('salesforce.agentforceDX');
      process.env.SF_TEST_API = config.get<boolean>('useTestApi', false) ? 'true' : 'false';
    };

    // Set initial value
    updateTestApiEnv();

    // Watch for configuration changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('salesforce.agentforceDX.useTestApi')) {
          updateTestApiEnv();
        }
      })
    );

    // Register commands before initializing `testRunner`
    const disposables: vscode.Disposable[] = [];
    disposables.push(commands.registerOpenAgentInOrgCommand());
    disposables.push(commands.registerActivateAgentCommand());
    disposables.push(commands.registerDeactivateAgentCommand());
    disposables.push(commands.registerValidateAgentCommand());
    disposables.push(commands.registerPreviewAgentCommand());
    disposables.push(commands.registerPublishAgentCommand());
    disposables.push(commands.registerCreateAiAuthoringBundleCommand());
    context.subscriptions.push(await registerTestView());
    const agentCombinedViewDisposable = registerAgentCombinedView(context);
    context.subscriptions.push(agentCombinedViewDisposable);

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

// Export function to get the provider instance for testing
export function getAgentCombinedViewProviderInstance(): AgentCombinedViewProvider | undefined {
  return agentCombinedViewProviderInstance || AgentCombinedViewProvider.getInstance();
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

  // Register focus test view alias command
  testViewItems.push(
    vscode.commands.registerCommand('sf.agent.focusTestView', async () => {
      await vscode.commands.executeCommand('sf.agent.test.view.focus');
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
  // Store the provider instance for testing purposes
  agentCombinedViewProviderInstance = provider;
  const disposables: vscode.Disposable[] = [];

  // Register the webview provider
  disposables.push(
    vscode.window.registerWebviewViewProvider(AgentCombinedViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // Listen for org changes and reset the agent view when org changes
  // This is done asynchronously since CoreExtensionService loads in the background
  CoreExtensionService.loadDependencies(context)
    .then(() => {
      const onOrgChange = CoreExtensionService.getOnOrgChangeEvent();
      disposables.push(
        onOrgChange(async event => {
          const channelService = CoreExtensionService.getChannelService();
          channelService.appendLine(`Org changed to: ${event.alias || event.username || 'unknown'}`);
          channelService.appendLine('Resetting agent preview...');

          // Reset the agent view and reload the agent list for the new org
          await provider.refreshAvailableAgents();
        })
      );
    })
    .catch((err: Error) => {
      console.error('Could not set up org change listener:', err.message);
    });

  // Shared function for selecting and running an agent
  const selectAndRunAgent = async () => {
    const channelService = CoreExtensionService.getChannelService();

    try {
      const availableAgents = await provider.getAgentsForCommandPalette();
      const scriptAgents = availableAgents.filter(agent => agent.source === AgentSource.SCRIPT);
      const publishedAgents = availableAgents.filter(agent => agent.source === AgentSource.PUBLISHED);

      const allAgents: Array<{
        label: string;
        description?: string;
        id?: string;
        source?: AgentSource;
        kind?: vscode.QuickPickItemKind;
      }> = [];

      if (scriptAgents.length > 0) {
        allAgents.push({ label: 'Agent Script', kind: vscode.QuickPickItemKind.Separator });
        allAgents.push(
        ...scriptAgents.map(agent => ({
          label: agent.name,
          description: agent.id ? path.basename(agent.id) : undefined,
          // For script agents, use aabName to match what the webview expects
          id: agent.aabName || agent.id,
          source: agent.source
        }))
        );
      }

      if (publishedAgents.length > 0) {
        allAgents.push({ label: 'Published', kind: vscode.QuickPickItemKind.Separator });
        allAgents.push(
          ...publishedAgents.map(agent => ({
            label: agent.name,
            id: agent.id,
            source: agent.source
          }))
        );
      }

      if (allAgents.length === 0) {
        vscode.window.showErrorMessage('No agents found.');
        channelService.appendLine('No agents found.');
        return;
      }

      const selectedAgent = await vscode.window.showQuickPick(allAgents, {
        placeHolder: 'Select an agent to run'
      });

      if (selectedAgent && selectedAgent.id) {
        // Store the preference so the dropdown adopts the selection if the webview refreshes
        provider.setAgentId(selectedAgent.id);

        // Reveal the Agentforce DX panel
        await vscode.commands.executeCommand('sf.agent.combined.view.focus');

        const postSelectionMessage = () => {
          if (provider.webviewView?.webview) {
            // Send the selectAgent message with agentSource to avoid expensive re-fetch
            provider.webviewView.webview.postMessage({
              command: 'selectAgent',
              data: { agentId: selectedAgent.id, agentSource: selectedAgent.source }
            });
          }
        };

        // If the webview already exists, update it immediately; otherwise try shortly after focus
        if (provider.webviewView?.webview) {
          await postSelectionMessage();
        } else {
          setTimeout(() => postSelectionMessage(), 300);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to list agents: ${errorMessage}`);
      channelService.appendLine(`Failed to list agents: ${errorMessage}`);
    }
  };

  // Register toolbar commands
  disposables.push(vscode.commands.registerCommand('sf.agent.selectAndRun', selectAndRunAgent));

  // Register start agent alias command
  disposables.push(
    vscode.commands.registerCommand('sf.agent.startAgent', async () => {
      const currentAgentId = provider.getCurrentAgentId();

      if (currentAgentId) {
        // If agent is already selected, start it
        provider.selectAndStartAgent(currentAgentId);
      } else {
        // If no agent selected, show picker and then start the selected agent
        const channelService = CoreExtensionService.getChannelService();

        try {
          const availableAgents = await provider.getAgentsForCommandPalette();
          const scriptAgents = availableAgents.filter(agent => agent.source === AgentSource.SCRIPT);
          const publishedAgents = availableAgents.filter(agent => agent.source === AgentSource.PUBLISHED);

          const allAgents: Array<{
            label: string;
            description?: string;
            id?: string;
            source?: AgentSource;
            kind?: vscode.QuickPickItemKind;
          }> = [];

          if (scriptAgents.length > 0) {
            allAgents.push({ label: 'Agent Script', kind: vscode.QuickPickItemKind.Separator });
            allAgents.push(
              ...scriptAgents.map(agent => ({
                label: agent.name,
                description: agent.id ? path.basename(agent.id) : undefined,
                // For script agents, use aabName to match what the webview expects
                id: agent.aabName || agent.id,
                source: agent.source
              }))
            );
          }

          if (publishedAgents.length > 0) {
            allAgents.push({ label: 'Published', kind: vscode.QuickPickItemKind.Separator });
            allAgents.push(
              ...publishedAgents.map(agent => ({
                label: agent.name,
                id: agent.id,
                source: agent.source
              }))
            );
          }

          if (allAgents.length === 0) {
            vscode.window.showErrorMessage('No agents found.');
            channelService.appendLine('No agents found.');
            return;
          }

          const selectedAgent = await vscode.window.showQuickPick(allAgents, {
            placeHolder: 'Select an agent to start'
          });

          if (selectedAgent && selectedAgent.id) {
            // Store the preference so the dropdown adopts the selection if the webview refreshes
            provider.setAgentId(selectedAgent.id);

            // Reveal the Agentforce DX panel
            await vscode.commands.executeCommand('sf.agent.combined.view.focus');

            // Start the selected agent
            provider.selectAndStartAgent(selectedAgent.id);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Failed to list agents: ${errorMessage}`);
          channelService.appendLine(`Failed to list agents: ${errorMessage}`);
        }
      }
    })
  );

  // Register focus view alias command
  disposables.push(
    vscode.commands.registerCommand('sf.agent.focusView', async () => {
      await vscode.commands.executeCommand('sf.agent.combined.view.focus');
    })
  );

  disposables.push(
    vscode.commands.registerCommand('sf.agent.combined.view.stop', async () => {
      await provider.endSession();
    })
  );

  disposables.push(
    vscode.commands.registerCommand('sf.agent.combined.view.exportConversation', async () => {
      try {
        await provider.exportConversation();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Unable to export conversation: ${errorMessage}`);
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand('sf.agent.combined.view.clearHistory', async () => {
      const currentAgentId = provider.getCurrentAgentId();

      if (!currentAgentId) {
        vscode.window.showErrorMessage('Agentforce DX: Select an agent to clear history.');
        return;
      }

      const confirmation = await vscode.window.showWarningMessage(
        'Are you sure you want to clear the chat history for this agent? This action cannot be undone.',
        { modal: true },
        'Clear History'
      );

      if (confirmation === 'Clear History') {
        try {
          await provider.clearHistory();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Unable to clear history: ${errorMessage}`);
        }
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand('sf.agent.combined.view.restart', async () => {
      // Lightweight restart - restart session without recompiling
      const currentAgentId = provider.getCurrentAgentId();

      if (!currentAgentId) {
        vscode.window.showErrorMessage('No agent selected to restart.');
        return;
      }

      // Restart the session without recompilation (reuses existing agentPreview instance)
      await provider.restartWithoutCompilation();
    })
  );

  disposables.push(
    vscode.commands.registerCommand('sf.agent.combined.view.recompileAndRestart', async () => {
      // Full restart with recompilation - end session and start fresh
      const currentAgentId = provider.getCurrentAgentId();

      if (!currentAgentId) {
        vscode.window.showErrorMessage('No agent selected to restart.');
        return;
      }

      // Recompile and restart in a single motion (handles UI feedback internally)
      await provider.recompileAndRestart();
    })
  );

  disposables.push(
    vscode.commands.registerCommand('sf.agent.combined.view.refreshAgents', async (selectAgentId?: string) => {
      await provider.refreshAvailableAgents(selectAgentId);
    })
  );

  disposables.push(
    vscode.commands.registerCommand('sf.agent.combined.view.resetAgentView', async () => {
      const currentAgentId = provider.getCurrentAgentId();

      if (!currentAgentId) {
        vscode.window.showErrorMessage('Agentforce DX: Select an agent to reset.');
        return;
      }

      try {
        await provider.resetCurrentAgentView();
        vscode.window.showInformationMessage('Agent preview reset.');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Unable to reset agent view: ${errorMessage}`);
      }
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
