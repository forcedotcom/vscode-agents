import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AgentSource, Agent, PreviewableAgent } from '@salesforce/agents';
import { SfProject } from '@salesforce/core';
import { CoreExtensionService } from '../../../services/coreExtensionService';

const AI_AUTHORING_BUNDLES_DIR = 'aiAuthoringBundles';

/**
 * Recursively finds all directories named "aiAuthoringBundles" under a root path.
 */
function findAiAuthoringBundlesDirs(rootDir: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === AI_AUTHORING_BUNDLES_DIR) {
        results.push(fullPath);
      }
      results.push(...findAiAuthoringBundlesDirs(fullPath));
    }
  }
  return results;
}

/**
 * Finds local script agents by scanning for aiAuthoringBundles directories under the project.
 * Does not rely on sfdx-project.json packageDirectories, so newly created .agent files are included.
 */
export function findLocalAgentsUnderProject(projectRoot: string): PreviewableAgent[] {
  const agents: PreviewableAgent[] = [];
  const bundlesDirs = findAiAuthoringBundlesDirs(projectRoot);
  for (const bundlesDir of bundlesDirs) {
    let subdirs: string[];
    try {
      subdirs = fs.readdirSync(bundlesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => path.join(bundlesDir, d.name));
    } catch {
      continue;
    }
    for (const subdir of subdirs) {
      const aabName = path.basename(subdir);
      const agentFile = path.join(subdir, `${aabName}.agent`);
      try {
        if (fs.statSync(agentFile).isFile()) {
          agents.push({
            source: AgentSource.SCRIPT,
            aabName,
            name: aabName,
            id: undefined
          });
        }
      } catch {
        // no .agent file in this subdir, skip
      }
    }
  }
  return agents;
}

/**
 * Merges library listPreviewable result with locally discovered script agents.
 * Adds any local .agent bundles not already in the library list (by aabName).
 */
export function mergeWithLocalAgents(
  projectPath: string,
  agentsFromLibrary: PreviewableAgent[]
): PreviewableAgent[] {
  const localAgents = findLocalAgentsUnderProject(projectPath);
  const existingAabNames = new Set(
    agentsFromLibrary
      .filter(a => a.aabName)
      .map(a => a.aabName!)
  );
  const added = localAgents.filter(a => !existingAabNames.has(a.aabName!));
  return [...agentsFromLibrary, ...added];
}

/**
 * Validates that an agent ID is a valid Salesforce Bot ID format
 */
export function validatePublishedAgentId(agentId: string): void {
  if (!agentId.startsWith('0X') || (agentId.length !== 15 && agentId.length !== 18)) {
    throw new Error(
      `The Bot ID provided must begin with "0X" and be either 15 or 18 characters. Found: ${agentId}`
    );
  }
}

/**
 * Gets the storage key for an agent based on its source
 */
export function getAgentStorageKey(agentId: string, agentSource: AgentSource): string {
  if (!agentId) {
    throw new Error('Agent ID is required to generate storage key');
  }

  if (agentSource === AgentSource.SCRIPT) {
    // For script agents, agentId is the file path or aabName
    // Extract the directory name from the path if it's a path, otherwise use as-is
    const basename = agentId.includes(path.sep) ? path.basename(agentId) : agentId;
    if (!basename) {
      throw new Error(`Invalid agent path: ${agentId}`);
    }
    return basename;
  }
  // For org agents, agentId is the Bot ID
  return agentId;
}

/**
 * Determines the agent source type based on the agent ID
 */
export async function getAgentSource(agentId: string, agents?: PreviewableAgent[]): Promise<AgentSource> {
  let agentList = agents;
  if (!agentList) {
    try {
      const conn = await CoreExtensionService.getDefaultConnection();
      const project = SfProject.getInstance();
      agentList = await Agent.listPreviewable(conn, project);
    } catch (err) {
      console.error('Error loading agents for source lookup:', err);
      // If agentId looks like a file path, default to SCRIPT; otherwise PUBLISHED
      if (agentId.includes(path.sep) || agentId.endsWith('.agent')) {
        return AgentSource.SCRIPT;
      }
      return AgentSource.PUBLISHED;
    }
  }

  // First, try exact match by ID
  const agent = agentList.find(a => a.id === agentId);
  if (agent) {
    return agent.source;
  }

  // Check if agentId matches an agent's aabName (for script agents)
  const agentByAabName = agentList.find(a => a.aabName === agentId);
  if (agentByAabName) {
    return agentByAabName.source;
  }

  // Check if agentId matches an agent name in the list
  const agentByName = agentList.find(a => a.name === agentId || path.basename(a.id || '') === agentId);
  if (agentByName) {
    return agentByName.source;
  }

  // If not found, check if agentId is a file path that exists
  // Strip "local:" prefix if present
  const normalizedAgentId = agentId.startsWith('local:') ? agentId.substring(6) : agentId;
  if (normalizedAgentId.includes(path.sep) || normalizedAgentId.endsWith('.agent')) {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(normalizedAgentId));
      return AgentSource.SCRIPT;
    } catch {
      // File doesn't exist, but still looks like a path - treat as script
      return AgentSource.SCRIPT;
    }
  }

  // Check if it's a valid Bot ID format
  if (agentId.startsWith('0X') && (agentId.length === 15 || agentId.length === 18)) {
    return AgentSource.PUBLISHED;
  }

  // Default to SCRIPT for unknown formats
  return AgentSource.SCRIPT;
}
