import * as vscode from 'vscode';
import type { PanelFactory } from './panelFactory';
import type { SessionRegistry } from './sessionRegistry';
import type { SessionPanelController } from './sessionPanelController';

/**
 * Commands that operate on the currently-focused session panel. Each command posts a
 * directive to that panel's webview, which already owns the per-session state and routes
 * through `WebviewMessageHandlers` — same code path the UI uses.
 */
export function registerSessionScopedCommands(
  registry: SessionRegistry,
  panelFactory: PanelFactory
): vscode.Disposable {
  const disposables: vscode.Disposable[] = [];

  const focused = (): SessionPanelController | undefined => {
    const session = registry.getFocused();
    if (!session) {
      return undefined;
    }
    return panelFactory.get(session.id);
  };

  const withFocused = async (
    missingMsg: string,
    action: (controller: SessionPanelController) => unknown | Promise<unknown>
  ): Promise<void> => {
    const controller = focused();
    if (!controller) {
      void vscode.window.showWarningMessage(missingMsg);
      return;
    }
    try {
      await action(controller);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(msg);
    }
  };

  disposables.push(
    vscode.commands.registerCommand('afdx.session.stop', () =>
      withFocused('Focus an agent session tab to stop it.', c => c.stop())
    ),
    vscode.commands.registerCommand('afdx.session.restart', () =>
      withFocused('Focus an agent session tab to restart it.', c => c.restart())
    ),
    vscode.commands.registerCommand('afdx.session.recompileAndRestart', () =>
      withFocused('Focus an agent session tab to recompile.', c => c.recompileAndRestart())
    ),
    vscode.commands.registerCommand('afdx.session.toggleDebug', () =>
      withFocused('Focus an agent session tab to toggle debug.', c => c.toggleDebug())
    )
  );

  return vscode.Disposable.from(...disposables);
}
