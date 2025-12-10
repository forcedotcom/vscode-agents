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
 * Integration test for validating agent script files
 * This test verifies that the validateAgent command can validate .agent files
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { waitForExtensionActivation, waitForCommand, authenticateDevHub } from './helpers';
import { mockHeadlessUI } from './headlessUiHelpers';

suite('Validate Agent Integration Test', () => {
  let testWorkspacePath: string;
  let validAgentFile: string;
  let invalidAgentFile: string;

  suiteSetup(async function () {
    this.timeout(60000);

    testWorkspacePath = path.resolve(__dirname, '../../fixtures/test-workspace');

    // Create a valid .agent file for testing
    const validAgentContent = `system:
    instructions: "You are an AI Agent."
    messages:
        welcome: "Hi, I'm an AI assistant. How can I help you?"
        error: "Sorry, it looks like something has gone wrong."

config:
  developer_name: "Willie_Resort_Manager"
  default_agent_user: "pronto_sales_assistant.kasr8shhuuvg@orgfarm.salesforce.com"
  agent_label: "Willie Resort Manager"
  description: "This agent assists Coral Cloud employees by answering questions related to staff training, work schedules, and company policies. It also helps guests by politely handling complaints and other escalations. It DOES NOT provide information about local events, weather, or other information, nor does it provide help or information related to guest experiences at the resort."
variables:
    EndUserId: linked string
        source: @MessagingSession.MessagingEndUserId
        description: "This variable may also be referred to as MessagingEndUser Id"
    RoutableId: linked string
        source: @MessagingSession.Id
        description: "This variable may also be referred to as MessagingSession Id"
    ContactId: linked string
        source: @MessagingEndUser.ContactId
        description: "This variable may also be referred to as MessagingEndUser ContactId"
    EndUserLanguage: linked string
        source: @MessagingSession.EndUserLanguage
        description: "This variable may also be referred to as MessagingSession EndUserLanguage"
    VerifiedCustomerId: mutable string
          description: "This variable may also be referred to as VerifiedCustomerId"

language:
    default_locale: "en_US"
    additional_locales: ""
    all_additional_locales: False

connection messaging:
    escalation_message: "One moment while I connect you to the next available service representative."
    outbound_route_type: "OmniChannelFlow"
    outbound_route_name: "agent_support_flow"
    adaptive_response_allowed: True

start_agent topic_selector:
    label: "Topic Selector"
    description: "Welcome the user and determine the appropriate topic based on user input"

    reasoning:
        instructions: ->
            | Select the tool that best matches the user's message and conversation history. If it's unclear, make your best guess.
        actions:
            go_to_escalation: @utils.transition to @topic.escalation

topic escalation:
    label: "Escalation"
    description: "Handles requests from users who want to transfer or escalate their conversation to a live human agent."

    reasoning:
        instructions: ->
            | If a user explicitly asks to transfer to a live agent, escalate the conversation.
              If escalation to a live agent fails for any reason, acknowledge the issue and ask the user whether they would like to log a support case instead.
        actions:
            escalate_to_human: @utils.escalate
                description: "Call this tool to escalate to a human agent."
`;

    const validAgentDir = path.join(testWorkspacePath, 'force-app', 'main', 'default', 'aiAuthoringBundles', 'validateagent');
    if (!fs.existsSync(validAgentDir)) {
      fs.mkdirSync(validAgentDir, { recursive: true });
    }
    validAgentFile = path.join(validAgentDir, 'validateagent.agent');
    fs.writeFileSync(validAgentFile, validAgentContent, 'utf8');

    // Create an invalid .agent file for testing error cases
    const invalidAgentContent = `system:
    instructions: "You are an AI Agent."
    messages:
        welcome: "Hi, I'm an AI assistant. How can I help you?"
        error: "Sorry, it looks like something has gone wrong."

config:
  developer_name: "Willie_Resort_Manager"
  default_agent_user: "pronto_sales_assistant.kasr8shhuuvg@orgfarm.salesforce.com"
  agent_label: "Willie Resort Manager"
  description: "This agent assists Coral Cloud employees by answering questions related to staff training, work schedules, and company policies. It also helps guests by politely handling complaints and other escalations. It DOES NOT provide information about local events, weather, or other information, nor does it provide help or information related to guest experiences at the resort."
variables:
    EndUserId: linked string
        source: @MessagingSession.MessagingEndUserId
        description: "This variable may also be referred to as MessagingEndUser Id"
    RoutableId: linked string
        source: @MessagingSession.Id
        description: "This variable may also be referred to as MessagingSession Id"
    ContactId: linked string
        source: @MessagingEndUser.ContactId
        description: "This variable may also be referred to as MessagingEndUser ContactId"
    EndUserLanguage: linked string
        source: @MessagingSession.EndUserLanguage
        description: "This variable may also be referred to as MessagingSession EndUserLanguage"
    VerifiedCustomerId: mutable string
          description: "This variable may also be referred to as VerifiedCustomerId"

language:
    default_locale: "en_US"
    additional_locales: ""
    all_additional_locales: False

connection messaging:
    escalation_message: "One moment while I connect you to the next available service representative."
    outbound_route_type: "OmniChannelFlow"
    outbound_route_name: "agent_support_flow"
    adaptive_response_allowed: True

start_agent topic_selector:
    label: "Topic Selector"
    description: "Welcome the user and determine the appropriate topic based on user input"

    reasoning:
        instructions: ->
            | Select the tool that best matches the user's message and conversation history. If it's unclear, make your best guess.
        actions:
            go_to_escalation: @utils.transition to @topic.escalation`;

    const invalidAgentDir = path.join(testWorkspacePath, 'force-app', 'main', 'default', 'aiAuthoringBundles', 'invalidagent');
    if (!fs.existsSync(invalidAgentDir)) {
      fs.mkdirSync(invalidAgentDir, { recursive: true });
    }
    invalidAgentFile = path.join(invalidAgentDir, 'invalidagent.agent');
    fs.writeFileSync(invalidAgentFile, invalidAgentContent, 'utf8');
  });

  suiteTeardown(async function () {
    // Clean up test artifacts
    const aiAuthoringBundlesDir = path.join(testWorkspacePath, 'force-app', 'main', 'default', 'aiAuthoringBundles');
    if (fs.existsSync(aiAuthoringBundlesDir)) {
      const entries = fs.readdirSync(aiAuthoringBundlesDir);
      for (const entry of entries) {
        const entryPath = path.join(aiAuthoringBundlesDir, entry);
        try {
          const stat = fs.statSync(entryPath);
          if (stat.isDirectory() && (entry === 'validateagent' || entry === 'invalidagent')) {
            fs.rmSync(entryPath, { recursive: true, force: true });
          }
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  });

  async function executeAndVerifyValidation(
    agentFile: string,
    shouldSucceed: boolean,
    targetUri?: vscode.Uri
  ): Promise<void> {
    const mockedUI = mockHeadlessUI({});

    try {
      // Open the file in the editor if not using URI (for activeTextEditor path)
      if (!targetUri) {
        const doc = await vscode.workspace.openTextDocument(agentFile);
        await vscode.window.showTextDocument(doc);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (targetUri) {
        await vscode.commands.executeCommand('salesforcedx-vscode-agents.validateAgent', targetUri);
      } else {
        await vscode.commands.executeCommand('salesforcedx-vscode-agents.validateAgent');
      }

      // Wait for validation to complete
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check diagnostics from the agentValidation collection
      // The validateAgent command uses a specific diagnostic collection
      const allDiagnostics = vscode.languages.getDiagnostics();
      const fileUri = vscode.Uri.file(agentFile);
      const fileDiagnostics = allDiagnostics.find(([uri]) => uri.fsPath === fileUri.fsPath)?.[1] || [];
      
      if (shouldSucceed) {
        assert.strictEqual(fileDiagnostics.length, 0, 'Valid agent file should have no diagnostics');
      } else {
        assert.ok(fileDiagnostics.length > 0, 'Invalid agent file should have diagnostics');
      }
    } finally {
      mockedUI.restore();
    }
  }

  test('Should validate agent file via context menu (right-click on .agent file)', async function () {
    this.timeout(120000);

    await waitForExtensionActivation(60000);
    await authenticateDevHub();
    await waitForCommand('salesforcedx-vscode-agents.validateAgent', 15000);
    assert.ok(fs.existsSync(validAgentFile), 'Valid agent file should exist');

    const targetUri = vscode.Uri.file(validAgentFile);
    await executeAndVerifyValidation(validAgentFile, true, targetUri);
  });

  test('Should validate agent file via command palette (with active .agent file)', async function () {
    this.timeout(120000);

    await waitForExtensionActivation(60000);
    await authenticateDevHub();
    await waitForCommand('salesforcedx-vscode-agents.validateAgent', 15000);
    assert.ok(fs.existsSync(validAgentFile), 'Valid agent file should exist');

    await executeAndVerifyValidation(validAgentFile, true);
  });

  test('Should show validation errors for invalid agent file', async function () {
    this.timeout(120000);

    await waitForExtensionActivation(60000);
    await authenticateDevHub();
    await waitForCommand('salesforcedx-vscode-agents.validateAgent', 15000);
    assert.ok(fs.existsSync(invalidAgentFile), 'Invalid agent file should exist');

    const targetUri = vscode.Uri.file(invalidAgentFile);
    await executeAndVerifyValidation(invalidAgentFile, false, targetUri);
  });
});

