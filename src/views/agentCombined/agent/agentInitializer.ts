import * as path from 'path';
import { promises as fs } from 'fs';
import { Agent, ScriptAgent, ProductionAgent, findAuthoringBundle } from '@salesforce/agents';
import { Lifecycle, SfProject, Connection } from '@salesforce/core';
import type { AgentViewState } from '../state/agentViewState';

/**
 * Handles agent initialization logic
 */
export class AgentInitializer {
  constructor(private readonly state: AgentViewState) {}

  /**
   * Initializes a script agent
   */
  async initializeScriptAgent(
    filePath: string,
    conn: Connection,
    project: SfProject,
    _isLiveMode: boolean,
    isActive: () => boolean,
    onCompiling?: (data: { message?: string; error?: string }) => void,
    onSimulationStarting?: (data: { message?: string }) => void
  ): Promise<ScriptAgent> {
    // Set up lifecycle event listeners for compilation progress
    const lifecycle = Lifecycle.getInstance();
    lifecycle.removeAllListeners?.('agents:compiling');
    lifecycle.removeAllListeners?.('agents:simulation-starting');

    // Listen for compilation events
    if (onCompiling) {
      lifecycle.on('agents:compiling', async (data: { message?: string; error?: string }) => {
        if (!isActive()) {
          return;
        }
        onCompiling(data);
      });
    }

    // Listen for simulation starting event
    if (onSimulationStarting) {
      lifecycle.on('agents:simulation-starting', async (data: { message?: string }) => {
        if (!isActive()) {
          return;
        }
        onSimulationStarting(data);
      });
    }

    // Create agent instance
    // filePath might be either:
    // 1. A file path to a .agent file
    // 2. A directory path (aabDirectory) - in which case we need to find the .agent file
    let aabDirectory: string;
    
    try {
      // Check if filePath is a directory
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        // It's already a directory, verify it contains a .agent file
        const files = await fs.readdir(filePath);
        const agentFile = files.find(f => f.endsWith('.agent'));
        if (!agentFile) {
          throw new Error(`Directory ${filePath} does not contain a .agent file`);
        }
        aabDirectory = path.resolve(filePath);
      } else {
        // It's a file path, use findAuthoringBundle to get the directory
        const authoringBundle = findAuthoringBundle(project.getPath(), filePath);
        if (!authoringBundle) {
          throw new Error(`Could not find authoring bundle for file: ${filePath}`);
        }
        aabDirectory = path.resolve(authoringBundle);
      }
    } catch (error) {
      // If stat fails, try findAuthoringBundle as fallback
      const authoringBundle = findAuthoringBundle(project.getPath(), filePath);
      if (!authoringBundle) {
        throw new Error(`Could not find authoring bundle for file: ${filePath}. ${error instanceof Error ? error.message : String(error)}`);
      }
      aabDirectory = path.resolve(authoringBundle);
    }
    const agent = await Agent.init({
      connection: conn,
      aabDirectory,
      project: project
    } as any);

    this.state.agentInstance = agent;
    return agent as ScriptAgent;
  }

  /**
   * Initializes a published agent
   */
  async initializePublishedAgent(
    agentId: string,
    conn: Connection,
    project: SfProject
  ): Promise<ProductionAgent> {
    const agent = await Agent.init({
      connection: conn,
      project: project as any,
      apiNameOrId: agentId
    });

    this.state.agentInstance = agent;
    return agent as ProductionAgent;
  }
}
