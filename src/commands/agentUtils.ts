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
import { ConfigAggregator, Org, SfProject } from '@salesforce/core';
import { Agent } from '@salesforce/agents';

const UNSUPPORTED_AGENTS = ['Copilot_for_Salesforce'];

export interface PublishedAgentInfo {
  name: string;
  id: string;
  isActivated: boolean;
}

export interface Logger {
  error(message: string): void;
  debug(message: string): void;
}

export interface TelemetryService {
  sendException(exceptionName: string, message: string): void;
}

export async function getConnectionAndProject() {
  const configAggregator = await ConfigAggregator.create();
  const targetOrg = configAggregator.getPropertyValue<string>('target-org');

  if (!targetOrg) {
    throw new Error('No default org configured. Set a target org with "sf config set target-org".');
  }

  const org = await Org.create({ aliasOrUsername: targetOrg });
  return { conn: org.getConnection(), project: SfProject.getInstance(), org };
}

/**
 * Prompts user to select an agent from the current DX project.
 * Returns undefined if no agent is selected or no agents are available.
 */
export async function selectAgentFromProject(
  logger: Logger,
  telemetryService?: TelemetryService
): Promise<string | undefined> {
  const project = SfProject.getInstance();
  const agents = await Agent.list(project);

  if (agents.length === 0) {
    vscode.window.showErrorMessage(`Couldn't find any agents in the current DX project.`);
    logger.error("Couldn't find any agents in the current DX project.");
    logger.debug(
      'Suggestion: Retrieve your agent metadata to your DX project with the "project retrieve start" CLI command.'
    );
    return undefined;
  }

  const agentName = await vscode.window.showQuickPick(agents, { placeHolder: 'Agent name (type to search)' });

  if (!agentName) {
    telemetryService?.sendException('no_agent_selected', 'No Agent selected');
    return undefined;
  }

  return agentName;
}

/**
 * Handles command errors with consistent messaging and telemetry.
 */
export function handleCommandError(
  error: unknown,
  userMessage: string,
  exceptionName: string,
  logger: Logger,
  telemetryService?: TelemetryService
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  vscode.window.showErrorMessage(`${userMessage}: ${errorMessage}`);
  logger.error(`${userMessage}: ${errorMessage}`);
  telemetryService?.sendException(exceptionName, errorMessage);
}

export async function getPublishedAgents(conn: ReturnType<Org['getConnection']>): Promise<PublishedAgentInfo[]> {
  const agents = await Agent.listRemote(conn);
  return agents
    .filter(a => !a.IsDeleted && !UNSUPPORTED_AGENTS.includes(a.DeveloperName))
    .map(a => ({
      name: a.DeveloperName,
      id: a.Id,
      isActivated: a.BotVersions.records.some(v => v.Status === 'Active' && !v.IsDeleted)
    }));
}

/**
 * Gets the agent name from a directory path or file path.
 * Handles both file selections and directory selections.
 */
export async function getAgentNameFromPath(targetPath: string): Promise<string> {
  // First check if this is in a genAiPlannerBundles directory
  const plannerBundleAgentName = getAgentNameFromPlannerBundlePath(targetPath);
  if (plannerBundleAgentName) {
    return plannerBundleAgentName;
  }

  // Then check if this is in an aiAuthoringBundles directory
  const authoringBundleAgentName = getAgentNameFromAuthoringBundlePath(targetPath);
  if (authoringBundleAgentName) {
    return authoringBundleAgentName;
  }

  const stat = await vscode.workspace.fs.stat(vscode.Uri.file(targetPath));

  if (stat.type === vscode.FileType.Directory) {
    // If it's a directory, look for a .bot-meta.xml file in it
    return getAgentNameFromDirectory(targetPath);
  } else {
    // If it's a file, use the existing logic
    const fileName = path.basename(targetPath);
    return getAgentNameFromFile(fileName, targetPath);
  }
}

// Returns agent name from genAiPlannerBundles path (removes .genAiPlannerBundle extension and version suffix)
function getAgentNameFromPlannerBundlePath(targetPath: string): string | null {
  // Normalize to handle cross-platform path separators (/ on Unix, \ on Windows)
  const normalizedPath = path.normalize(targetPath);
  const pathParts = normalizedPath.split(path.sep);
  const plannerBundlesIndex = pathParts.findIndex(part => part === 'genAiPlannerBundles');

  if (plannerBundlesIndex === -1 || plannerBundlesIndex >= pathParts.length - 1) {
    // Not in genAiPlannerBundles directory, or genAiPlannerBundles is the last part
    return null;
  }

  // The agent name is the first item after genAiPlannerBundles
  let agentIdentifier = pathParts[plannerBundlesIndex + 1];

  // If it's a .genAiPlannerBundle file, remove the extension
  if (agentIdentifier.endsWith('.genAiPlannerBundle')) {
    agentIdentifier = agentIdentifier.replace('.genAiPlannerBundle', '');
  }

  // Always remove version suffix (e.g., _v1, _v2, _v33, etc.) from directory or file names
  agentIdentifier = agentIdentifier.replace(/_v\d+$/, '');

  return agentIdentifier;
}

// Returns agent name from aiAuthoringBundles path (directory name after aiAuthoringBundles)
function getAgentNameFromAuthoringBundlePath(targetPath: string): string | null {
  // Normalize to handle cross-platform path separators (/ on Unix, \ on Windows)
  const normalizedPath = path.normalize(targetPath);
  const pathParts = normalizedPath.split(path.sep);
  const authoringBundlesIndex = pathParts.findIndex(part => part === 'aiAuthoringBundles');

  if (authoringBundlesIndex === -1 || authoringBundlesIndex >= pathParts.length - 1) {
    // Not in aiAuthoringBundles directory, or aiAuthoringBundles is the last part
    return null;
  }

  // The agent name is the first item after aiAuthoringBundles (the directory name)
  return pathParts[authoringBundlesIndex + 1];
}

/**
 * Extracts the agent name from a directory by looking for a .bot-meta.xml file.
 */
async function getAgentNameFromDirectory(directoryPath: string): Promise<string> {
  try {
    const dirUri = vscode.Uri.file(directoryPath);
    const files = await vscode.workspace.fs.readDirectory(dirUri);

    // Find the .bot-meta.xml file
    const botMetaFile = files.find(([name, type]) => type === vscode.FileType.File && name.endsWith('.bot-meta.xml'));

    if (botMetaFile) {
      // Extract bot name from the .bot-meta.xml filename
      return botMetaFile[0].replace('.bot-meta.xml', '');
    }

    // Fallback: use the directory name (assuming it's the bot name)
    return path.basename(directoryPath);
  } catch (error) {
    console.warn('Failed to read directory for bot metadata, falling back to directory name:', error);
    return path.basename(directoryPath);
  }
}

/**
 * Extracts the agent name from the given file or directory.
 * For .bot-meta.xml files, returns the filename without extension.
 * For .botVersion-meta.xml files, looks for a .bot-meta.xml file in the same directory
 * and returns that filename without extension.
 * For directories, looks for a .bot-meta.xml file in the directory.
 */
export async function getAgentNameFromFile(fileName: string, filePath: string): Promise<string> {
  // For bot metadata files, extract agent name from filename
  if (fileName.endsWith('.bot-meta.xml')) {
    return fileName.replace('.bot-meta.xml', '');
  }

  // For genAiPlannerBundle files, extract agent name from filename
  if (fileName.endsWith('.genAiPlannerBundle')) {
    // Remove the .genAiPlannerBundle extension
    let agentName = fileName.replace('.genAiPlannerBundle', '');
    // Remove version suffix (e.g., _v1, _v2, etc.)
    agentName = agentName.replace(/_v\d+$/, '');
    return agentName;
  }

  // For bot version metadata files, find the corresponding .bot-meta.xml file in the same directory
  if (fileName.endsWith('.botVersion-meta.xml')) {
    try {
      const directory = path.dirname(filePath);
      const dirUri = vscode.Uri.file(directory);

      // Read all files in the directory
      const files = await vscode.workspace.fs.readDirectory(dirUri);

      // Find the .bot-meta.xml file
      const botMetaFile = files.find(([name, type]) => type === vscode.FileType.File && name.endsWith('.bot-meta.xml'));

      if (botMetaFile) {
        // Extract bot name from the .bot-meta.xml filename
        return botMetaFile[0].replace('.bot-meta.xml', '');
      }

      // Fallback: try to infer from the file path structure
      // Bot version files are typically in: force-app/main/default/botVersions/{botName}/{versionName}.botVersion-meta.xml
      const pathParts = filePath.split(path.sep);
      const botVersionIndex = pathParts.findIndex(part => part === 'botVersions');
      if (botVersionIndex >= 0 && botVersionIndex < pathParts.length - 2) {
        return pathParts[botVersionIndex + 1]; // The bot name is the directory after 'botVersions'
      }

      // Last fallback: use the version name (original behavior)
      return fileName.replace('.botVersion-meta.xml', '');
    } catch (error) {
      console.warn('Failed to find bot metadata file in directory, falling back to filename:', error);
      return fileName.replace('.botVersion-meta.xml', '');
    }
  }

  return fileName;
}
