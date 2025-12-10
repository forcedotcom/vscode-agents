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
 * Integration test for creating an AI authoring bundle
 * This test verifies that the createAiAuthoringBundle command can generate a bundle locally
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { waitForExtensionActivation, waitForCommand, authenticateDevHub } from './helpers';
import { mockHeadlessUI } from './headlessUiHelpers';

suite('Create AI Authoring Bundle Integration Test', () => {
  let testWorkspacePath: string;
  let specsDir: string;
  let specFilePath: string;
  let expectedBundleDir: string;

  suiteSetup(async function () {
    this.timeout(60000); // 1 minute for setup

    // __dirname is test/integration/out/suite, so go up 2 levels to reach test/integration
    testWorkspacePath = path.resolve(__dirname, '../../fixtures/test-workspace');

    // Ensure force-app directory exists (required by sfdx-project.json)
    const forceAppDir = path.join(testWorkspacePath, 'force-app');
    if (!fs.existsSync(forceAppDir)) {
      fs.mkdirSync(forceAppDir, { recursive: true });
    }

    // Create specs directory and a sample spec file
    specsDir = path.join(testWorkspacePath, 'specs');
    if (!fs.existsSync(specsDir)) {
      fs.mkdirSync(specsDir, { recursive: true });
    }

    // Create a simple agent spec file
    const specContent = `name: WillieTestAgent
description: A test agent for integration testing
instructions: You are a helpful test assistant.
tools: []`;

    specFilePath = path.join(specsDir, 'test-agent-spec.yaml');
    fs.writeFileSync(specFilePath, specContent, 'utf8');
  });

  suiteTeardown(async function () {
    // Restore test workspace to initial state after all tests complete
    // This removes all test artifacts so the next test run starts clean
    // The fixtures directory represents the committed initial state
    console.log('Cleaning up test artifacts and restoring workspace to initial state...');
    
    // Remove any test-generated bundles (keep the aiAuthoringBundles directory structure)
    const aiAuthoringBundlesDir = path.join(testWorkspacePath, 'force-app', 'main', 'default', 'aiAuthoringBundles');
    if (fs.existsSync(aiAuthoringBundlesDir)) {
      const entries = fs.readdirSync(aiAuthoringBundlesDir);
      for (const entry of entries) {
        const entryPath = path.join(aiAuthoringBundlesDir, entry);
        try {
          const stat = fs.statSync(entryPath);
          if (stat.isDirectory() || stat.isFile()) {
            // Remove any bundle directories or files created during tests
            fs.rmSync(entryPath, { recursive: true, force: true });
            console.log(`Removed test artifact: ${entryPath}`);
          }
        } catch (error) {
          // Ignore errors if file/directory doesn't exist or can't be accessed
          console.warn(`Warning: Could not remove ${entryPath}: ${error}`);
        }
      }
    }
    
    // Remove any other test-generated files/directories as needed
    // (Add more cleanup here as new test artifacts are created in future tests)
    
    console.log('Workspace restored to initial state');
  });

  test('Should create AI authoring bundle using createAiAuthoringBundle command', async function () {
    this.timeout(120000); // 2 minutes for the test

    // Wait for extension to activate first
    console.log('Waiting for extension activation...');
    await waitForExtensionActivation(60000); // Wait up to 60 seconds

    // Authenticate with DevHub/Org (required for the command to work)
    // The command needs a connection to Salesforce
    console.log('Authenticating with org for command execution...');
    await authenticateDevHub();

    // Wait for createAiAuthoringBundle command to be available
    console.log('Waiting for createAiAuthoringBundle command...');
    await waitForCommand('salesforcedx-vscode-agents.createAiAuthoringBundle', 15000);
    console.log('CreateAiAuthoringBundle command is available');

    // Verify the spec file exists
    assert.ok(fs.existsSync(specFilePath), 'Spec file should exist');
    console.log(`Spec file exists: ${specFilePath}`);

    // Get the aiAuthoringBundles directory path
    const aiAuthoringBundlesDir = path.join(testWorkspacePath, 'force-app', 'main', 'default', 'aiAuthoringBundles');

    // Ensure the directory exists
    if (!fs.existsSync(aiAuthoringBundlesDir)) {
      fs.mkdirSync(aiAuthoringBundlesDir, { recursive: true });
    }

    console.log('Executing createAiAuthoringBundle command...');

    // For headless CI/CD, mock all UI interactions
    const bundleName = 'WillieTestBundle';
    const specFileName = 'test-agent-spec.yaml';

    const mockedUI = mockHeadlessUI({
      inputBoxResponses: [bundleName], // First call: bundle name
      quickPickResponses: [specFileName] // First call: spec file selection
    });

    const targetUri = vscode.Uri.file(aiAuthoringBundlesDir);
    expectedBundleDir = path.join(aiAuthoringBundlesDir, 'WillieTestBundle');
    const expectedAgentFile = path.join(expectedBundleDir, 'WillieTestBundle.agent');

    // Clean up any existing bundle
    if (fs.existsSync(expectedBundleDir)) {
      fs.rmSync(expectedBundleDir, { recursive: true, force: true });
    }

    try {
      console.log('Executing command with mocked UI functions (headless CI/CD compatible)...');

      // Execute the command - it should now work without user interaction
      await vscode.commands.executeCommand('salesforcedx-vscode-agents.createAiAuthoringBundle', targetUri);

      // Wait for the command to complete (it shows progress, so we wait a bit)
      console.log('Waiting for bundle creation to complete...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait up to 10 seconds

      // Verify the bundle was created
      console.log(`Checking for bundle at: ${expectedBundleDir}`);

      // Success! Bundle was created
      const agentFileContent = fs.readFileSync(expectedAgentFile, 'utf8');
      assert.ok(agentFileContent.length > 0, 'Agent file should have content');
      // The generated file contains the bundle name (WillieTestBundle), not the agent spec name
      assert.ok(agentFileContent.includes('WillieTestBundle'), 'generated AAB contains bundle name');
      // Verify it's a valid agent file structure
      assert.ok(agentFileContent.includes('developer_name') || agentFileContent.includes('agent_label'), 'generated AAB has agent structure');
    } catch (error: any) {
      console.error('Error executing command:', error);

      // Restore functions before throwing
      mockedUI.restore();
      throw error;
    } finally {
      // Always restore original functions
      mockedUI.restore();
      // Note: Bundle cleanup happens in suiteTeardown after all tests complete
    }
  });
});
