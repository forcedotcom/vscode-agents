/**
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/
import * as vscode from 'vscode';

/**
 * Toggles the visibility of generated data in test results
 */
/**
 * Updates the generated data visibility setting and triggers a configuration change event
 */
async function updateGeneratedDataSetting(value: boolean): Promise<void> {
  const config = vscode.workspace.getConfiguration('agentforceDX');
  await config.update('showGeneratedData', value, vscode.ConfigurationTarget.Global);
}

export async function toggleGeneratedDataOn(): Promise<void> {
  await updateGeneratedDataSetting(true);
}

export async function toggleGeneratedDataOff(): Promise<void> {
  await updateGeneratedDataSetting(false);
}
