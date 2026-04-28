import * as vscode from 'vscode';
import type { Session } from './session';
import type { SessionRegistry } from './sessionRegistry';
import { SessionPanelController, SESSION_PANEL_VIEW_TYPE } from './sessionPanelController';

export class PanelFactory {
  private readonly controllers = new Map<string, SessionPanelController>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly registry: SessionRegistry
  ) {
    this.context.subscriptions.push(
      this.registry.onDidChange(evt => {
        if (evt.kind === 'removed') {
          this.controllers.delete(evt.session.id);
        }
      })
    );
  }

  /**
   * Creates a new editor-area panel bound to the given session.
   * Uses retainContextWhenHidden so the webview keeps its React state when tabs switch.
   */
  open(session: Session): SessionPanelController {
    const existing = this.controllers.get(session.id);
    if (existing) {
      existing.reveal();
      return existing;
    }

    const title = session.agentName ?? session.agentId;
    const panel = vscode.window.createWebviewPanel(
      SESSION_PANEL_VIEW_TYPE,
      title,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist')]
      }
    );

    const controller = new SessionPanelController(this.context, this.registry, session, panel);
    this.controllers.set(session.id, controller);
    this.context.subscriptions.push(panel);
    return controller;
  }

  get(sessionId: string): SessionPanelController | undefined {
    return this.controllers.get(sessionId);
  }

  dispose(): void {
    for (const controller of this.controllers.values()) {
      controller.dispose();
    }
    this.controllers.clear();
  }
}
