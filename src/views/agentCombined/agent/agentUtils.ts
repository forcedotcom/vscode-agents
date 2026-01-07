import * as path from 'path';
import * as vscode from 'vscode';
import { AgentSource, Agent, PreviewableAgent } from '@salesforce/agents';
import { SfProject } from '@salesforce/core';
import { CoreExtensionService } from '../../../services/coreExtensionService';

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
    // For script agents, agentId is the file path or aabDirectory
    // Extract the directory name from the path
    const basename = path.basename(agentId);
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

  // If not found, check if agentId is a file path that exists
  if (agentId.includes(path.sep) || agentId.endsWith('.agent')) {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(agentId));
      return AgentSource.SCRIPT;
    } catch {
      // File doesn't exist, but still looks like a path - treat as script
      return AgentSource.SCRIPT;
    }
  }

  // Check if agentId matches an agent name in the list
  const agentByName = agentList.find(a => a.name === agentId || path.basename(a.id || '') === agentId);
  if (agentByName) {
    return agentByName.source;
  }

  // Check if it's a valid Bot ID format
  if (agentId.startsWith('0X') && (agentId.length === 15 || agentId.length === 18)) {
    return AgentSource.PUBLISHED;
  }

  // Default to SCRIPT for unknown formats
  return AgentSource.SCRIPT;
}
