import * as vscode from 'vscode';
import { AgentViewState } from '../agentCombined/state';

/**
 * Session-scoped view state: same shape as `AgentViewState`, but toggles for live mode and
 * Apex debug do NOT mutate globalState. Initial values are seeded from globalState (the
 * "sticky default for new tabs"), while subsequent changes stay local to this session.
 *
 * VS Code's `setContext` commands are still fired for UI affordances gated by `when` clauses;
 * the focus-tracking layer is responsible for coalescing those across panels.
 */
export class SessionScopedState extends AgentViewState {
  async setDebugMode(enabled: boolean): Promise<void> {
    // Duplicate just enough of the base behavior to avoid writing globalState.
    (this as unknown as { _isApexDebuggingEnabled: boolean })._isApexDebuggingEnabled = enabled;
    await vscode.commands.executeCommand('setContext', 'agentforceDX:debugMode', enabled);
  }

  async setLiveMode(isLive: boolean): Promise<void> {
    (this as unknown as { _isLiveMode: boolean })._isLiveMode = isLive;
    await vscode.commands.executeCommand('setContext', 'agentforceDX:isLiveMode', isLive);
  }

  /**
   * Re-publishes the subset of context keys that gate view title and menu visibility.
   * Called when this panel becomes the focused session, so UI affordances match the
   * just-focused tab rather than whichever tab last mutated state.
   */
  async republishContext(): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'agentforceDX:debugMode', this.isApexDebuggingEnabled);
    await vscode.commands.executeCommand('setContext', 'agentforceDX:isLiveMode', this.isLiveMode);
    await vscode.commands.executeCommand('setContext', 'agentforceDX:sessionActive', this.isSessionActive);
    await vscode.commands.executeCommand('setContext', 'agentforceDX:sessionStarting', this.isSessionStarting);
    await vscode.commands.executeCommand(
      'setContext',
      'agentforceDX:isScriptAgent',
      this.currentAgentSource === 'script'
    );
    await vscode.commands.executeCommand('setContext', 'agentforceDX:agentSelected', Boolean(this.currentAgentId));
  }
}
