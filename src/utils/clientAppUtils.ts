/**
 * Utilities for handling client app authentication and connection setup
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigAggregator, AuthInfo, Connection, Org } from '@salesforce/core-bundle';

export interface ClientApp {
  name: string; // The key name from auth file (e.g., "agent-app")
  clientId: string; // The actual client ID
}

export interface ClientAppResult {
  type: 'none' | 'single' | 'multiple';
  clientApps: ClientApp[];
  username?: string;
  error?: string;
}

/**
 * Reads the auth file and extracts available client apps
 */
export async function getAvailableClientApps(): Promise<ClientAppResult> {
  try {
    // Get the default target org username, creating a fresh instance each time
    const configAggregator = await ConfigAggregator.create();
    // Force a fresh read of the config value
    await configAggregator.reload();
    const targetOrgAliasOrUsername = configAggregator.getPropertyValue<string>('target-org');
    
    if (!targetOrgAliasOrUsername) {
      return {
        type: 'none',
        clientApps: [],
        error: 'No default target org configured. Please set your default target org using "sf config set target-org <username>"'
      };
    }

    // Resolve alias to actual username so we read the correct auth file
    const org = await Org.create({ aliasOrUsername: targetOrgAliasOrUsername });
    const resolvedUsername = org.getUsername();
    if (!resolvedUsername) {
      return {
        type: 'none',
        clientApps: [],
        error: `Could not resolve username for target org value: ${targetOrgAliasOrUsername}`
      };
    }

    // Read the authentication file
    const homeDir = os.homedir();
    const authFilePath = path.join(homeDir, '.sfdx', `${resolvedUsername}.json`);
    
    if (!fs.existsSync(authFilePath)) {
      return {
        type: 'none',
        clientApps: [],
        username: resolvedUsername,
        error: `Authentication file not found for username: ${resolvedUsername}. Please authenticate using "sf org login jwt"`
      };
    }

    const fileContent = fs.readFileSync(authFilePath, 'utf8');
    const authData = JSON.parse(fileContent);
    
    // Extract client apps from the object structure
    const clientApps: ClientApp[] = [];
    if (authData.clientApps && typeof authData.clientApps === 'object' && !Array.isArray(authData.clientApps)) {
      for (const [appName, appData] of Object.entries(authData.clientApps)) {
        const app = appData as any;
        if (app && app.clientId) {
          clientApps.push({
            name: appName,
            clientId: app.clientId
          });
        }
      }
    }

    if (clientApps.length === 0) {
      return {
        type: 'none',
        clientApps: [],
        username: authData.username || resolvedUsername
      };
    } else if (clientApps.length === 1) {
      return {
        type: 'single',
        clientApps,
        username: authData.username || resolvedUsername
      };
    } else {
      return {
        type: 'multiple',
        clientApps,
        username: authData.username || resolvedUsername
      };
    }

  } catch (error) {
    console.error('Error reading client apps:', error);
    return {
      type: 'none',
      clientApps: [],
      error: `Error reading authentication: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Creates a connection with the specified client app
 */
export async function createConnectionWithClientApp(clientAppName: string): Promise<Connection> {
  // Get the default target org username, creating a fresh instance each time
  const configAggregator = await ConfigAggregator.create();
  // Force a fresh read of the config value
  await configAggregator.reload();
  const targetOrgAliasOrUsername = configAggregator.getPropertyValue<string>('target-org');
  
  if (!targetOrgAliasOrUsername) {
    throw new Error('No default target org configured');
  }

  // Resolve alias to username to ensure consistent auth lookup
  const org = await Org.create({ aliasOrUsername: targetOrgAliasOrUsername });
  const resolvedUsername = org.getUsername();
  if (!resolvedUsername) {
    throw new Error(`Could not resolve username for target org value: ${targetOrgAliasOrUsername}`);
  }

  // Create AuthInfo and Connection with the client app
  const authInfo = await AuthInfo.create({
    username: resolvedUsername
  });

  const conn = await Connection.create({
    authInfo,
    clientApp: clientAppName
  });

  return conn;
}
