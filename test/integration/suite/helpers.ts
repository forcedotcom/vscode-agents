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
 * Helper functions for integration tests
 * 
 * Environment variables follow the cli-plugins-testkit convention:
 * - TESTKIT_HUB_USERNAME: Username of DevHub org for creating scratch orgs
 * - TESTKIT_ORG_USERNAME: Username of existing org to use (instead of creating scratch org)
 * 
 * See: https://github.com/salesforcecli/cli-plugins-testkit
 */

import * as vscode from 'vscode';
import { Org, Connection, AuthInfo, ConfigAggregator } from '@salesforce/core';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Wait for the extension to be activated by checking if a known command is available
 */
export async function waitForExtensionActivation(timeoutMs = 30000): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 500; // Check every 500ms

  console.log('Checking for extension activation...');
  
  // Check workspace first
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    console.error('No workspace folders found - extension will not activate');
    return false;
  }
  
  const workspacePath = workspaceFolders[0].uri.fsPath;
  console.log(`Workspace path: ${workspacePath}`);
  
  // Check if sfdx-project.json exists
  const fs = require('fs');
  const path = require('path');
  const sfdxProjectPath = path.join(workspacePath, 'sfdx-project.json');
  if (!fs.existsSync(sfdxProjectPath)) {
    console.error(`sfdx-project.json not found at: ${sfdxProjectPath}`);
    return false;
  }
  console.log(`sfdx-project.json found at: ${sfdxProjectPath}`);
  
  // Try to manually trigger activation by executing a command
  // This can help if the activation event didn't fire
  try {
    // List all extensions to see what's available
    const allExtensions = vscode.extensions.all;
    console.log(`Total extensions loaded: ${allExtensions.length}`);
    const salesforceExtensions = allExtensions.filter(ext => 
      ext.id.includes('salesforce') || ext.id.includes('agent')
    );
    console.log(`Salesforce/Agent extensions found: ${salesforceExtensions.map(e => e.id).join(', ')}`);
    
    // Try to get extension info - try both possible ID formats
    let extension = vscode.extensions.getExtension('Salesforce.salesforcedx-vscode-agents');
    if (!extension) {
      extension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-agents');
    }
    if (extension) {
      console.log(`Extension found: ${extension.id}, active: ${extension.isActive}`);
      if (!extension.isActive) {
        console.log('Extension is not active, attempting to activate...');
        try {
          await extension.activate();
          console.log(`Extension activation attempted, now active: ${extension.isActive}`);
        } catch (activateError: any) {
          console.error(`Error activating extension: ${activateError.message}`);
          console.error(`Activation error stack: ${activateError.stack}`);
        }
      }
    } else {
      console.warn('Extension salesforce.salesforcedx-vscode-agents not found in extensions list');
      console.warn('This usually means the extension is not being loaded by VS Code');
      console.warn('Check that extensionDevelopmentPath in runTest.ts points to the correct directory');
    }
  } catch (error: any) {
    console.warn(`Error checking/activating extension: ${error.message}`);
    console.warn(`Error stack: ${error.stack}`);
  }
  
  while (Date.now() - startTime < timeoutMs) {
    const commands = await vscode.commands.getCommands();
    
    // Check for multiple commands that should be registered when extension activates
    const expectedCommands = [
      'salesforcedx-vscode-agents.previewAgent',
      'salesforcedx-vscode-agents.createAiAuthoringBundle',
      'salesforcedx-vscode-agents.validateAgent'
    ];
    
    const foundCommand = expectedCommands.find(cmd => commands.includes(cmd));
    if (foundCommand) {
      console.log(`Extension activated (found command: ${foundCommand})`);
      return true;
    }
    
    // Log available commands for debugging (first check only)
    if (Date.now() - startTime < checkInterval) {
      console.log(`Available commands (${commands.length} total): ${commands.slice(0, 10).join(', ')}...`);
      // Also check for any commands containing 'agent' or 'salesforce'
      const agentCommands = commands.filter(cmd => 
        cmd.toLowerCase().includes('agent') || cmd.toLowerCase().includes('salesforce')
      );
      if (agentCommands.length > 0) {
        console.log(`Commands containing 'agent' or 'salesforce': ${agentCommands.slice(0, 20).join(', ')}`);
      }
    }
    
    // Try to manually trigger activation by attempting to execute a command
    // This sometimes helps trigger lazy activation
    if (Date.now() - startTime > 5000 && (Date.now() - startTime) % 5000 < checkInterval) {
      try {
        // Try executing a command - this might trigger activation
        const commandResult = vscode.commands.executeCommand('salesforcedx-vscode-agents.createAiAuthoringBundle');
        // Convert Thenable to Promise and catch errors
        Promise.resolve(commandResult).catch(() => {
          // Expected to fail if not activated, but might trigger activation
        });
      } catch {
        // Ignore errors - we're just trying to trigger activation
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  console.log('Extension activation timeout - checking final command list...');
  const finalCommands = await vscode.commands.getCommands();
  console.log(`Total commands available: ${finalCommands.length}`);
  const agentCommands = finalCommands.filter(cmd => cmd.includes('salesforcedx-vscode-agents'));
  console.log(`Agent extension commands found: ${agentCommands.length} - ${agentCommands.join(', ')}`);
  
  // Check extension status one more time
  try {
    const extension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-agents');
    if (extension) {
      console.log(`Final extension status - active: ${extension.isActive}, exports: ${!!extension.exports}`);
    }
  } catch (error: any) {
    console.warn(`Error checking extension status: ${error.message}`);
  }
  
  return false;
}

/**
 * Wait for a specific command to be available
 */
export async function waitForCommand(command: string, timeoutMs = 5000): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 100;

  while (Date.now() - startTime < timeoutMs) {
    const commands = await vscode.commands.getCommands();
    if (commands.includes(command)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  return false;
}

/**
 * Authenticate with DevHub and set it as the default org
 * Priority:
 * 1. TESTKIT_HUB_USERNAME or TESTKIT_ORG_USERNAME environment variable (for local development)
 * 2. Default org from CLI (for CI where org is authenticated via workflow)
 */
export async function authenticateDevHub(): Promise<Org> {
  let devhubUsername: string | undefined;
  
  // First, check environment variables (takes priority for local development)
  devhubUsername = process.env.TESTKIT_HUB_USERNAME || process.env.TESTKIT_ORG_USERNAME;
  
  if (devhubUsername) {
    console.log(`Using org from environment variable: ${devhubUsername}`);
    
    // Set as default org using CLI
    try {
      await execAsync(`sf config set target-org=${devhubUsername}`);
      console.log(`Set ${devhubUsername} as default org via CLI`);
    } catch (error) {
      console.warn(`Warning: Could not set default org via CLI: ${error}`);
    }
  } else {
    // Fallback: try to get the default org from CLI (for CI where org is authenticated via workflow)
    try {
      const { stdout } = await execAsync('sf org display --json');
      const orgInfo = JSON.parse(stdout);
      if (orgInfo.result?.username) {
        devhubUsername = orgInfo.result.username;
        console.log(`Found default org from CLI: ${devhubUsername}`);
      }
    } catch (error) {
      console.log('Could not get default org from CLI');
    }
    
    if (!devhubUsername) {
      throw new Error('No default org found. Either authenticate via CLI (sf org login) or set TESTKIT_HUB_USERNAME/TESTKIT_ORG_USERNAME environment variable');
    }
  }

  console.log(`Authenticating with DevHub: ${devhubUsername}`);

  // Create org instance to verify authentication
  const org = await Org.create({ aliasOrUsername: devhubUsername });
  const resolvedUsername = org.getUsername();
  
  if (!resolvedUsername) {
    throw new Error(`Could not resolve username for DevHub: ${devhubUsername}`);
  }

  console.log(`Successfully authenticated with DevHub: ${resolvedUsername}`);

  // Update the .sf/config.json file in the test workspace to use the authenticated org
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const workspacePath = workspaceFolders[0].uri.fsPath;
      const sfConfigPath = path.join(workspacePath, '.sf', 'config.json');
      
      // Read existing config or create new one
      let configData: any = {};
      if (fs.existsSync(sfConfigPath)) {
        const configContent = fs.readFileSync(sfConfigPath, 'utf8');
        configData = JSON.parse(configContent);
      }
      
      // Update target-org to use the authenticated org
      configData['target-org'] = resolvedUsername;
      
      // Ensure .sf directory exists
      const sfDir = path.dirname(sfConfigPath);
      if (!fs.existsSync(sfDir)) {
        fs.mkdirSync(sfDir, { recursive: true });
      }
      
      // Write updated config
      fs.writeFileSync(sfConfigPath, JSON.stringify(configData, null, 2), 'utf8');
      console.log(`Updated .sf/config.json with target-org: ${resolvedUsername}`);
    }
  } catch (error: any) {
    console.warn(`Warning: Could not update .sf/config.json: ${error.message}`);
  }

  // Ensure VS Code config is also set
  try {
    const config = vscode.workspace.getConfiguration('salesforcedx-vscode-core');
    await config.update('defaultusername', resolvedUsername, vscode.ConfigurationTarget.Workspace);
    console.log(`Set VS Code default org to: ${resolvedUsername}`);
  } catch (error) {
    console.warn(`Warning: Could not set VS Code default org: ${error}`);
  }

  return org;
}

/**
 * Create a scratch org from the DevHub
 * Returns the username of the created scratch org
 */
export async function createScratchOrg(devhubUsername: string, configPath?: string): Promise<string> {
  console.log(`Creating scratch org from DevHub: ${devhubUsername}`);

  // Try to use config file if provided, otherwise use default config
  if (configPath) {
    const orgCreateCommand = `sf org create scratch --definition-file ${configPath} --target-dev-hub ${devhubUsername} --set-default --json`;

    try {
      const { stdout } = await execAsync(orgCreateCommand, {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      const result = JSON.parse(stdout);
      
      if (result.status === 0 && result.result?.username) {
        const username = result.result.username;
        console.log(`Successfully created scratch org: ${username}`);
        return username;
      } else {
        throw new Error(`Failed to create scratch org: ${result.message || JSON.stringify(result)}`);
      }
    } catch (error: any) {
      console.log('Failed to create scratch org with config file, trying default config...');
      return await createScratchOrgWithDefaultConfig(devhubUsername);
    }
  } else {
    // Use default config
    return await createScratchOrgWithDefaultConfig(devhubUsername);
  }
}

/**
 * Create a scratch org with default configuration
 */
async function createScratchOrgWithDefaultConfig(devhubUsername: string): Promise<string> {
  const defaultConfig = {
    orgName: 'Test Scratch Org',
    edition: 'Developer',
    features: ['EnableSetPasswordInApi'],
    settings: {
      orgPreferenceSettings: {
        enabled: ['S1DesktopEnabled']
      }
    }
  };

  // Write config to a temp file to avoid shell escaping issues
  const tempConfigPath = path.join(require('os').tmpdir(), `scratch-def-${Date.now()}.json`);
  fs.writeFileSync(tempConfigPath, JSON.stringify(defaultConfig, null, 2));

  try {
    const orgCreateCommand = `sf org create scratch --definition-file ${tempConfigPath} --target-dev-hub ${devhubUsername} --set-default --json`;

    const { stdout } = await execAsync(orgCreateCommand, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024
    });

    const result = JSON.parse(stdout);
    
    // Clean up temp file
    try {
      fs.unlinkSync(tempConfigPath);
    } catch {
      // Ignore cleanup errors
    }
    
    if (result.status === 0 && result.result?.username) {
      const username = result.result.username;
      console.log(`Successfully created scratch org with default config: ${username}`);
      return username;
    } else {
      throw new Error(`Failed to create scratch org: ${result.message || JSON.stringify(result)}`);
    }
  } catch (error: any) {
    // Clean up temp file on error
    try {
      fs.unlinkSync(tempConfigPath);
    } catch {
      // Ignore cleanup errors
    }
    throw new Error(`Failed to create scratch org: ${error.message}`);
  }
}

/**
 * Delete a scratch org
 */
export async function deleteScratchOrg(username: string): Promise<void> {
  console.log(`Deleting scratch org: ${username}`);
  
  try {
    await execAsync(`sf org delete scratch --target-org ${username} --no-prompt --json`);
    console.log(`Successfully deleted scratch org: ${username}`);
  } catch (error: any) {
    console.warn(`Warning: Could not delete scratch org ${username}: ${error.message}`);
    // Don't throw - cleanup failures shouldn't fail tests
  }
}

/**
 * Wait for diagnostics to be updated (used to check compilation results)
 */
export async function waitForDiagnostics(
  uri: vscode.Uri,
  timeoutMs = 30000,
  checkInterval = 500
): Promise<vscode.Diagnostic[]> {
  const startTime = Date.now();
  let lastDiagnostics: vscode.Diagnostic[] = [];

  while (Date.now() - startTime < timeoutMs) {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    
    // If diagnostics changed, wait a bit more to ensure they're stable
    if (diagnostics.length !== lastDiagnostics.length) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      const stableDiagnostics = vscode.languages.getDiagnostics(uri);
      if (stableDiagnostics.length === diagnostics.length) {
        return stableDiagnostics;
      }
    }
    
    lastDiagnostics = diagnostics;
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  return vscode.languages.getDiagnostics(uri);
}

