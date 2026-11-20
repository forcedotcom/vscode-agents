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
import { ConfigAggregator, Org, SfError, SfProject } from '@salesforce/core';
import { Agent } from '@salesforce/agents';

const UNSUPPORTED_AGENTS = ['Copilot_for_Salesforce'];
const LIST_TIMEOUT_MS = 10_000;

export interface PublishedAgentInfo {
  name: string;
  id: string;
  isActivated: boolean;
}

export interface Logger {
  error(message: string, error?: SfError): void;
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
 * Redirect path for the new Agentforce Builder (Agent Script agents).
 * The new builder follows the AiAuthoringBundle version, not the active BotVersion,
 * so we open by project name only and never pass a version.
 */
export function getAuthoringBuilderRedirectUri(agentName: string): string {
  return `AgentAuthoring/agentAuthoringBuilder.app#/project?projectName=${encodeURIComponent(agentName)}`;
}

/** Redirect path for the legacy Agentforce Builder (copilotStudio). */
export function getLegacyBuilderRedirectUri(botId: string): string {
  return `AiCopilot/copilotStudio.app#/copilot/builder?copilotId=${botId}`;
}

/**
 * Returns true if `bundleName` is an AiAuthoringBundle for `agentName`. The Metadata API names each
 * bundle version `<DeveloperName>_<VersionNumber>` (e.g. `My_Agent_3`), and that suffix is kept on
 * retrieve since API v68, so match both the bare name and its versioned form.
 */
export function isAuthoringBundleFor(bundleName: string, agentName: string): boolean {
  if (bundleName === agentName) {
    return true;
  }
  const suffix = bundleName.startsWith(`${agentName}_`) ? bundleName.slice(agentName.length + 1) : '';
  return /^\d+$/.test(suffix);
}

/**
 * True if any of `bundleNames` is a bundle for `agentName`. A name that itself ends in `_<digits>` (e.g. a legacy
 * bot `Sales_2`) is ambiguous with version 2 of `Sales`, so for those only a versioned match (`Sales_2_1`) counts.
 */
function hasBundleFor(bundleNames: string[], agentName: string): boolean {
  const matches = bundleNames.filter(name => isAuthoringBundleFor(name, agentName));
  return /_\d+$/.test(agentName) ? matches.some(name => name !== agentName) : matches.length > 0;
}

/**
 * Returns true if an aiAuthoringBundles/<agentName>[_<N>]/ folder with an .agent file exists in the workspace.
 */
export async function hasLocalAuthoringBundle(agentName: string): Promise<boolean> {
  // Agent developer names are word characters only; anything else would turn into glob metacharacters.
  if (!/^\w+$/.test(agentName)) {
    return false;
  }
  try {
    const files = await vscode.workspace.findFiles(`**/aiAuthoringBundles/${agentName}*/*.agent`, '**/node_modules/**');
    return hasBundleFor(
      (files ?? []).map(file => path.basename(path.dirname(file.fsPath))),
      agentName
    );
  } catch (error) {
    console.warn('Failed to search for local authoring bundles:', error);
    return false;
  }
}

/**
 * Returns whether the org has an AiAuthoringBundle (Agent Script agent) for this name, in any version, or
 * undefined if the org couldn't be asked (error or timeout).
 * Uses the Metadata API listing because the AiAuthoringBundleDef sObject isn't exposed to
 * customer orgs via SOQL.
 */
export async function hasOrgAuthoringBundle(
  conn: ReturnType<Org['getConnection']>,
  agentName: string
): Promise<boolean | undefined> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timed out listing AiAuthoringBundle metadata')), LIST_TIMEOUT_MS);
    });
    const props = await Promise.race([conn.metadata.list([{ type: 'AiAuthoringBundle' }]), timeout]);
    // jsforce can return a single object instead of an array when there's one result
    const list = Array.isArray(props) ? props : props ? [props] : [];
    return hasBundleFor(
      list.map(p => p.fullName),
      agentName
    );
  } catch (error) {
    console.warn('Failed to list AiAuthoringBundle metadata in the org:', error);
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Detects whether the agent is an Agent Script agent, and how. The org's AiAuthoringBundle listing is the
 * authority when it succeeds, so a local bundle that isn't deployed to the default org still takes the legacy
 * path (and its "not found in org" error). Only when the org can't be asked do we trust a local
 * aiAuthoringBundles/<name>[_<N>] folder.
 */
export async function detectAgentScript(
  conn: ReturnType<Org['getConnection']>,
  agentName: string
): Promise<'org' | 'local' | undefined> {
  const inOrg = await hasOrgAuthoringBundle(conn, agentName);
  if (inOrg !== undefined) {
    return inOrg ? 'org' : undefined;
  }
  return (await hasLocalAuthoringBundle(agentName)) ? 'local' : undefined;
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
  const sfError = SfError.wrap(error);
  const errorMessage = sfError.message;
  vscode.window.showErrorMessage(`${userMessage}: ${errorMessage}`);
  logger.error(`${userMessage}: ${errorMessage}`, sfError);
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

// Extracts agent name from bundle paths (genAiPlannerBundles or aiAuthoringBundles)
function getAgentNameFromBundlePath(
  targetPath: string,
  bundleDir: string,
  stripExtension?: string,
  stripVersionSuffix = false
): string | null {
  // Normalize to handle cross-platform path separators (/ on Unix, \ on Windows)
  const normalizedPath = path.normalize(targetPath);
  const pathParts = normalizedPath.split(path.sep);
  const bundleIndex = pathParts.findIndex(part => part === bundleDir);

  if (bundleIndex === -1 || bundleIndex >= pathParts.length - 1) {
    return null;
  }

  // The agent name is the first item after the bundle directory
  let agentIdentifier = pathParts[bundleIndex + 1];

  // Remove extension if specified
  if (stripExtension && agentIdentifier.endsWith(stripExtension)) {
    agentIdentifier = agentIdentifier.replace(stripExtension, '');
  }

  // Remove version suffix if requested
  if (stripVersionSuffix) {
    agentIdentifier = agentIdentifier.replace(/_v\d+$/, '');
  }

  return agentIdentifier;
}

// Returns agent name from genAiPlannerBundles path
function getAgentNameFromPlannerBundlePath(targetPath: string): string | null {
  return getAgentNameFromBundlePath(targetPath, 'genAiPlannerBundles', '.genAiPlannerBundle', true);
}

// Returns agent name from aiAuthoringBundles path
function getAgentNameFromAuthoringBundlePath(targetPath: string): string | null {
  return getAgentNameFromBundlePath(targetPath, 'aiAuthoringBundles');
}

/**
 * Helper to find .bot-meta.xml file in a directory and extract agent name.
 * Returns null if not found.
 */
async function findBotMetaXmlInDirectory(directoryPath: string): Promise<string | null> {
  try {
    const dirUri = vscode.Uri.file(directoryPath);
    const files = await vscode.workspace.fs.readDirectory(dirUri);
    const botMetaFile = files.find(([name, type]) => type === vscode.FileType.File && name.endsWith('.bot-meta.xml'));

    if (botMetaFile) {
      return botMetaFile[0].replace('.bot-meta.xml', '');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts the agent name from a directory by looking for a .bot-meta.xml file.
 */
async function getAgentNameFromDirectory(directoryPath: string): Promise<string> {
  const agentName = await findBotMetaXmlInDirectory(directoryPath);
  if (agentName) {
    return agentName;
  }

  // Fallback: use the directory name
  return path.basename(directoryPath);
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
      const agentName = await findBotMetaXmlInDirectory(directory);

      if (agentName) {
        return agentName;
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
