import * as vscode from 'vscode';

const LIVE_MODE_KEY = 'agentforceDX.lastLiveMode';
const DEBUG_MODE_KEY = 'agentforceDX.lastDebugMode';
const EXPORT_DIR_KEY = 'agentforceDX.lastExportDirectory';

export class UserPrefs {
  constructor(private readonly context: vscode.ExtensionContext) {}

  get defaultLiveMode(): boolean {
    return this.context.globalState.get<boolean>(LIVE_MODE_KEY, false);
  }

  get defaultApexDebug(): boolean {
    return this.context.globalState.get<boolean>(DEBUG_MODE_KEY, false);
  }

  getExportDirectory(): string | undefined {
    return this.context.workspaceState.get<string>(EXPORT_DIR_KEY);
  }

  async setExportDirectory(directory: string): Promise<void> {
    await this.context.workspaceState.update(EXPORT_DIR_KEY, directory);
  }
}
