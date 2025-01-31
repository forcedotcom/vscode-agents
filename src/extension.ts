/**
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/
import * as vscode from 'vscode';
import * as commands from './commands';
import { sync } from 'cross-spawn';
import { getTestOutlineProvider } from './views/testOutlineProvider';
import { AgentTestRunner } from './views/testRunner';
import { Commands } from './enums/commands';
import type { TestNode } from './types';
import { CoreExtensionService } from './services/coreExtensionService';
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
// see "contributes" property in package.json for command list
export async function activate(context: vscode.ExtensionContext) {
  const extensionHRStart = process.hrtime();

  try {
    // We need to do this first in case any other services need access to those provided by the core extension
    CoreExtensionService.loadDependencies(context);

    const versions = sync('sf', ['version', '--verbose', '--json'], { shell: true, encoding: 'utf8' });
    if (!versions?.output?.toString().includes('agent')) {
      throw new Error('sf CLI + plugin-agent installed required');
    }
    const disposables: vscode.Disposable[] = [];

    // Command Registration
    disposables.push(commands.registerOpenAgentInOrgCommand());
    context.subscriptions.push(registerTestView());
    await getTestOutlineProvider().refresh();
    context.subscriptions.push(...disposables);

    const telemetryService = CoreExtensionService.getTelemetryService();
    telemetryService.sendExtensionActivationEvent(extensionHRStart);
  } catch (err: unknown) {
    throw new Error(`Failed to initialize: ${(err as Error).message}`);
  }
}

const registerTestView = (): vscode.Disposable => {
  const testOutlineProvider = getTestOutlineProvider();
  const testRunner = new AgentTestRunner(testOutlineProvider);

  const testViewItems = new Array<vscode.Disposable>();

  const testProvider = vscode.window.registerTreeDataProvider('sf.agent.test.view', testOutlineProvider);
  testViewItems.push(testProvider);

  testViewItems.push(
    vscode.commands.registerCommand(Commands.goToDefinition, (test: TestNode) => testRunner.goToTest(test))
  );

  testViewItems.push(
    vscode.commands.registerCommand(Commands.runTest, (test: TestNode) => testRunner.runAgentTest(test))
  );

  // testViewItems.push(
  //   // todo: expand to run all tests
  //   vscode.commands.registerCommand('sf.agent.test.view.runAll', (test: TestNode) => testRunner.runAgentTest(test.name))
  // );

  testViewItems.push(
    vscode.commands.registerCommand(Commands.refreshTestView, () => {
      return testOutlineProvider.refresh();
    })
  );

  testViewItems.push(vscode.commands.registerCommand(Commands.collapseAll, () => testOutlineProvider.collapseAll()));

  return vscode.Disposable.from(...testViewItems);
};
