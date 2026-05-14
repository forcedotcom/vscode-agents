import * as vscode from 'vscode';

const SETTING_SECTION = 'salesforce.agentforceDX';
const MULTI_SESSION_KEY = 'multiSession.enabled';
export const MULTI_SESSION_CONTEXT_KEY = 'agentforceDX:multiSession';

export function isMultiSessionEnabled(): boolean {
  const config = vscode.workspace.getConfiguration(SETTING_SECTION);
  return config.get<boolean>(MULTI_SESSION_KEY, false);
}

export async function publishMultiSessionContext(): Promise<void> {
  await vscode.commands.executeCommand('setContext', MULTI_SESSION_CONTEXT_KEY, isMultiSessionEnabled());
}

export function onDidChangeMultiSessionEnabled(
  handler: (enabled: boolean) => void
): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration(`${SETTING_SECTION}.${MULTI_SESSION_KEY}`)) {
      handler(isMultiSessionEnabled());
    }
  });
}
