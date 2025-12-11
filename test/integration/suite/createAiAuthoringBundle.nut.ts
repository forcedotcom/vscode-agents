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

  suiteSetup(async function (this: Mocha.Context) {
    this.timeout(120000); // Increased timeout for extension activation and authentication

    testWorkspacePath = path.resolve(__dirname, '../../fixtures/test-workspace');
    
    // Wait for extension activation and authenticate once for the entire suite
    await waitForExtensionActivation(60000);
    await authenticateDevHub();

    const forceAppDir = path.join(testWorkspacePath, 'force-app');
    if (!fs.existsSync(forceAppDir)) {
      fs.mkdirSync(forceAppDir, { recursive: true });
    }

    specsDir = path.join(testWorkspacePath, 'specs');
    if (!fs.existsSync(specsDir)) {
      fs.mkdirSync(specsDir, { recursive: true });
    }

    const specContent = `name: WillieTestAgent
description: A test agent for integration testing
instructions: You are a helpful test assistant.
tools: []`;

    specFilePath = path.join(specsDir, 'test-agent-spec.yaml');
    fs.writeFileSync(specFilePath, specContent, 'utf8');
  });

  suiteTeardown(async function () {
    const aiAuthoringBundlesDir = path.join(testWorkspacePath, 'force-app', 'main', 'default', 'aiAuthoringBundles');
    if (fs.existsSync(aiAuthoringBundlesDir)) {
      const entries = fs.readdirSync(aiAuthoringBundlesDir);
      for (const entry of entries) {
        const entryPath = path.join(aiAuthoringBundlesDir, entry);
        try {
          const stat = fs.statSync(entryPath);
          if (stat.isDirectory() || stat.isFile()) {
            fs.rmSync(entryPath, { recursive: true, force: true });
          }
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  });


  async function executeAndVerifyBundle(
    bundleName: string,
    targetUri?: vscode.Uri
  ): Promise<void> {
    const aiAuthoringBundlesDir = path.join(testWorkspacePath, 'force-app', 'main', 'default', 'aiAuthoringBundles');
    const expectedBundleDir = path.join(aiAuthoringBundlesDir, bundleName);
    const expectedAgentFile = path.join(expectedBundleDir, `${bundleName}.agent`);

    if (fs.existsSync(expectedBundleDir)) {
      fs.rmSync(expectedBundleDir, { recursive: true, force: true });
    }

    const specFileName = 'test-agent-spec.yaml';
    const mockedUI = mockHeadlessUI({
      inputBoxResponses: [bundleName],
      quickPickResponses: [specFileName]
    });

    try {
      if (targetUri) {
        await vscode.commands.executeCommand('salesforcedx-vscode-agents.createAiAuthoringBundle', targetUri);
      } else {
        await vscode.commands.executeCommand('salesforcedx-vscode-agents.createAiAuthoringBundle');
      }

      await new Promise(resolve => setTimeout(resolve, 10000));

      assert.ok(fs.existsSync(expectedBundleDir), `Expected bundle directory not found: ${expectedBundleDir}`);
      assert.ok(fs.existsSync(expectedAgentFile), `Expected agent file not found: ${expectedAgentFile}`);

      const agentFileContent = fs.readFileSync(expectedAgentFile, 'utf8');
      assert.ok(agentFileContent.length > 0, 'Agent file should have content');
      
      assert.ok(
        agentFileContent.includes(`agent_label: "${bundleName}"`),
        `Agent file should contain agent_label: "${bundleName}"`
      );
    } finally {
      mockedUI.restore();
    }
  }

  test('Should create AI authoring bundle via context menu (right-click on aiAuthoringBundles folder)', async function (this: Mocha.Context) {
    this.timeout(120000);

    await waitForCommand('salesforcedx-vscode-agents.createAiAuthoringBundle', 15000);
    assert.ok(fs.existsSync(specFilePath), 'Spec file should exist');

    const aiAuthoringBundlesDir = path.join(testWorkspacePath, 'force-app', 'main', 'default', 'aiAuthoringBundles');
    const targetUri = vscode.Uri.file(aiAuthoringBundlesDir);
    await executeAndVerifyBundle('contextmenu', targetUri);
  });

  test('Should create AI authoring bundle via command palette (without URI, uses default path)', async function (this: Mocha.Context) {
    this.timeout(120000);

    await waitForCommand('salesforcedx-vscode-agents.createAiAuthoringBundle', 15000);
    assert.ok(fs.existsSync(specFilePath), 'Spec file should exist');

    await executeAndVerifyBundle('commandpalette');
  });

  test('Should create AI authoring bundle via command palette with explicit title', async function (this: Mocha.Context) {
    this.timeout(120000);

    await waitForCommand('salesforcedx-vscode-agents.createAiAuthoringBundle', 15000);
    assert.ok(fs.existsSync(specFilePath), 'Spec file should exist');

    await executeAndVerifyBundle('commandpalettetitle');
  });
});
