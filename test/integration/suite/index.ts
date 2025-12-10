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

/**
 * Integration test suite entry point
 * This file is executed in the VS Code Extension Host process
 */

import * as path from 'path';
import { glob } from 'glob';
import * as vscode from 'vscode';

// For VS Code extension tests, we need to use require to load mocha
// since it needs to be resolved from the extension's node_modules at runtime
let Mocha: any;
try {
  // Try to require mocha - it should be available in node_modules
  Mocha = require('mocha');
} catch (e) {
  // If direct require fails, try resolving from extension path
  const extensionPath = path.resolve(__dirname, '../../../');
  const mochaPath = require.resolve('mocha', { paths: [extensionPath] });
  Mocha = require(mochaPath);
}

export async function run(): Promise<void> {
  // Disable telemetry for tests
  try {
    // Set VS Code telemetry level to off
    await vscode.workspace
      .getConfiguration('telemetry')
      .update('telemetryLevel', 'off', vscode.ConfigurationTarget.Global);
    
    // Disable Salesforce telemetry
    await vscode.workspace
      .getConfiguration('salesforcedx-vscode-core.telemetry')
      .update('enabled', false, vscode.ConfigurationTarget.Workspace);
  } catch (err) {
    // If configuration update fails, continue anyway - settings.json will handle it
    console.log('Note: Could not programmatically disable telemetry, using workspace settings instead');
  }

  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 120000 // 2 minutes timeout for integration tests (longer for scratch org creation)
  });

  const testsRoot = path.resolve(__dirname, '..');

  try {
    // Wait a bit for VS Code and extension to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify workspace is open
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      console.log(`Workspace opened: ${workspaceFolders[0].uri.fsPath}`);
    } else {
      console.warn('Warning: No workspace folders found. Extension may not activate.');
    }

    // Look for compiled .nut.js files (NUT = Non-Unit Tests, following CLI plugin convention)
    // Since we're running from the compiled out directory, we look for .js files
    const files = await glob('**/**.nut.js', { cwd: testsRoot });
    
    // Add files to the test suite
    files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

    if (files.length === 0) {
      console.log('No test files found');
    } else {
      console.log(`Running ${files.length} test file(s): ${files.join(', ')}`);
    }

    // Run the mocha test
    return new Promise((c, e) => {
      mocha.run((failures: number) => {
        if (failures > 0) {
          e(new Error(`${failures} tests failed.`));
        } else {
          c();
        }
      });
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

