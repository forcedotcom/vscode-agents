import * as vscode from 'vscode';
import type { Session } from './session';
import type { SessionRegistry } from './sessionRegistry';

export const SESSION_LIST_VIEW_ID = 'sf.agent.sessionList.view';

export class SessionListTreeProvider implements vscode.TreeDataProvider<Session> {
  private readonly emitter = new vscode.EventEmitter<Session | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly registry: SessionRegistry) {
    this.disposables.push(
      this.registry.onDidChange(() => {
        this.emitter.fire();
      })
    );
  }

  getTreeItem(session: Session): vscode.TreeItem {
    const label = session.agentName ?? session.agentId;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.id = session.id;
    item.contextValue = `afdxSession:${session.status}`;
    item.description = describeStatus(session);
    item.iconPath = iconForStatus(session);
    item.tooltip = buildTooltip(session);
    item.command = {
      command: 'sf.agent.sessionList.reveal',
      title: 'Open Session',
      arguments: [session.id]
    };
    return item;
  }

  getChildren(element?: Session): vscode.ProviderResult<Session[]> {
    if (element) {
      return [];
    }
    // Only sessions that currently exist (draft, starting, active, inactive tabs still open, error).
    return this.registry.list();
  }

  dispose(): void {
    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        /* ignore */
      }
    }
    this.emitter.dispose();
  }
}

function describeStatus(session: Session): string | undefined {
  switch (session.status) {
    case 'draft':
      return 'not started';
    case 'starting':
      return session.liveMode ? 'starting (live)' : 'starting (preview)';
    case 'active':
      return session.liveMode ? 'live' : 'preview';
    case 'inactive':
      return 'inactive';
    case 'error':
      return 'error';
    default:
      return undefined;
  }
}

function iconForStatus(session: Session): vscode.ThemeIcon {
  switch (session.status) {
    case 'active':
      return session.liveMode
        ? new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'))
        : new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.blue'));
    case 'starting':
      return new vscode.ThemeIcon('loading~spin');
    case 'error':
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
    case 'draft':
    case 'inactive':
    default:
      return new vscode.ThemeIcon('circle-outline');
  }
}

function buildTooltip(session: Session): string {
  const parts = [
    `Agent: ${session.agentName ?? session.agentId}`,
    `Source: ${session.agentSource}`,
    `Status: ${session.status}`,
    `Mode: ${session.liveMode ? 'live' : 'preview'}`
  ];
  if (session.apexDebug) {
    parts.push('Apex debug: on');
  }
  if (session.sessionId) {
    parts.push(`Session ID: ${session.sessionId}`);
  }
  return parts.join('\n');
}
