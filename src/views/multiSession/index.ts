import * as vscode from 'vscode';
import * as path from 'path';
import { AgentSource } from '@salesforce/agents';
import { CoreExtensionService } from '../../services/coreExtensionService';
import { SfProject } from '@salesforce/core';
import { Agent } from '@salesforce/agents';
import { SessionRegistry } from './sessionRegistry';
import { UserPrefs } from './userPrefs';
import { PanelFactory } from './panelFactory';
import { registerSessionListView } from './sessionListView';
import { registerSessionScopedCommands } from './sessionCommands';
import { getAgentSource } from '../agentCombined/agent';

export function registerMultiSessionSurface(context: vscode.ExtensionContext): vscode.Disposable {
  const disposables: vscode.Disposable[] = [];

  const prefs = new UserPrefs(context);
  const registry = new SessionRegistry(prefs);
  const panelFactory = new PanelFactory(context, registry);

  disposables.push({ dispose: () => registry.dispose() });
  disposables.push({ dispose: () => panelFactory.dispose() });

  disposables.push(registerSessionListView(context, registry, panelFactory));
  disposables.push(registerSessionScopedCommands(registry, panelFactory));

  // + New session command (view title + palette)
  disposables.push(
    vscode.commands.registerCommand('sf.agent.sessionList.newSession', async () => {
      const selection = await pickAgent('Select an agent to start');
      if (!selection) {
        return;
      }
      const session = registry.create({
        agentId: selection.id,
        agentSource: selection.source,
        agentName: selection.displayName
      });
      panelFactory.open(session);
    })
  );

  // Refresh agents button in view title. We can't enumerate org agents eagerly without cost,
  // so this command just clears any cached data and forces the next picker/open to fetch fresh.
  disposables.push(
    vscode.commands.registerCommand('sf.agent.sessionList.refreshAgents', async () => {
      SfProject.clearInstances();
      void vscode.window.showInformationMessage('Agentforce DX: Agent list refreshed.');
    })
  );

  // Bridge from the existing `previewAgent` command (right-click .agent file) into a new panel.
  disposables.push(
    vscode.commands.registerCommand('sf.agent.sessionList.openFromUri', async (uri: vscode.Uri) => {
      if (!uri) {
        return;
      }
      const filePath = uri.fsPath;
      const aabName = path.basename(path.dirname(filePath));
      const session = registry.create({
        agentId: aabName,
        agentSource: AgentSource.SCRIPT,
        agentName: aabName
      });
      panelFactory.open(session);
    })
  );

  return vscode.Disposable.from(...disposables);
}

interface AgentPick {
  id: string;
  source: AgentSource;
  displayName: string;
}

async function pickAgent(placeHolder: string): Promise<AgentPick | undefined> {
  try {
    const conn = await CoreExtensionService.getDefaultConnection();
    const project = SfProject.getInstance();
    const agents = await Agent.listPreviewable(conn, project);

    const scriptAgents = agents.filter(a => a.source === AgentSource.SCRIPT);
    const publishedAgents = agents.filter(a => a.source === AgentSource.PUBLISHED);

    const items: Array<{
      label: string;
      description?: string;
      id?: string;
      source?: AgentSource;
      kind?: vscode.QuickPickItemKind;
      displayName?: string;
    }> = [];

    if (scriptAgents.length > 0) {
      items.push({ label: 'Agent Script', kind: vscode.QuickPickItemKind.Separator });
      for (const agent of scriptAgents) {
        const id = agent.aabName ?? agent.id;
        if (!id) continue;
        const label = (agent.developerName ?? agent.aabName) as string;
        items.push({
          label,
          description: agent.id ? path.basename(agent.id) : undefined,
          id,
          source: agent.source,
          displayName: label
        });
      }
    }

    if (publishedAgents.length > 0) {
      items.push({ label: 'Published', kind: vscode.QuickPickItemKind.Separator });
      for (const agent of publishedAgents) {
        const id = agent.id;
        if (!id) continue;
        const label = (agent.developerName ?? agent.aabName) as string;
        items.push({
          label,
          id,
          source: agent.source,
          displayName: label
        });
      }
    }

    if (items.length === 0) {
      void vscode.window.showErrorMessage('No agents found.');
      return undefined;
    }

    const picked = await vscode.window.showQuickPick(items, { placeHolder });
    if (!picked?.id || !picked.source) {
      return undefined;
    }
    return { id: picked.id, source: picked.source, displayName: picked.displayName ?? picked.label };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`Failed to list agents: ${msg}`);
    return undefined;
  }
}

export { SessionRegistry, UserPrefs, PanelFactory };
export { getAgentSource };
