import * as vscode from 'vscode';
import type { PanelFactory } from './panelFactory';
import type { SessionRegistry } from './sessionRegistry';
import { SESSION_LIST_VIEW_ID, SessionListTreeProvider } from './sessionListTreeProvider';

export function registerSessionListView(
  _context: vscode.ExtensionContext,
  registry: SessionRegistry,
  panelFactory: PanelFactory
): vscode.Disposable {
  const disposables: vscode.Disposable[] = [];

  const treeProvider = new SessionListTreeProvider(registry);
  disposables.push(
    vscode.window.registerTreeDataProvider(SESSION_LIST_VIEW_ID, treeProvider),
    treeProvider
  );

  disposables.push(
    vscode.commands.registerCommand('sf.agent.sessionList.reveal', (sessionId: string) => {
      const controller = panelFactory.get(sessionId);
      if (controller) {
        controller.reveal();
      }
    })
  );

  disposables.push(
    vscode.commands.registerCommand('sf.agent.sessionList.close', (itemOrId?: { id?: string } | string) => {
      const sessionId = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
      if (!sessionId) {
        return;
      }
      const controller = panelFactory.get(sessionId);
      if (controller) {
        controller.dispose();
      } else {
        registry.remove(sessionId);
      }
    })
  );

  return vscode.Disposable.from(...disposables);
}
