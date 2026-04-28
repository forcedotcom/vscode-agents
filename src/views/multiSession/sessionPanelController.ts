import * as vscode from 'vscode';
import { Agent, AgentSource } from '@salesforce/agents';
import { SfProject } from '@salesforce/core';
import type { Session } from './session';
import type { SessionRegistry } from './sessionRegistry';
import { WebviewMessageSender, WebviewMessageHandlers } from '../agentCombined/handlers';
import { SessionManager } from '../agentCombined/session';
import { HistoryManager } from '../agentCombined/history';
import { ApexDebugManager } from '../agentCombined/debugging';
import { AgentInitializer } from '../agentCombined/agent';
import { SessionScopedState } from './sessionScopedState';
import { renderSessionPanelHtml } from './panelHtml';
import { CoreExtensionService } from '../../services/coreExtensionService';
import { buildVersionPickerItems } from '../../commands/activateAgent';

export const SESSION_PANEL_VIEW_TYPE = 'afdx.sessionPanel';

export class SessionPanelController {
  readonly panel: vscode.WebviewPanel;
  readonly sessionLocalId: string;

  private readonly disposables: vscode.Disposable[] = [];
  private readonly state: SessionScopedState;
  private readonly messageSender: WebviewMessageSender;
  private readonly sessionManager: SessionManager;
  private readonly historyManager: HistoryManager;
  private readonly apexDebugManager: ApexDebugManager;
  private readonly agentInitializer: AgentInitializer;
  private readonly messageHandlers: WebviewMessageHandlers;
  private disposed = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly registry: SessionRegistry,
    session: Session,
    panel: vscode.WebviewPanel
  ) {
    this.panel = panel;
    this.sessionLocalId = session.id;

    // Each panel owns its own isolated set of managers, mirroring the single-sidebar setup.
    this.state = new SessionScopedState(context);
    // Seed state with the session's agent context so history loads and session starts can use it.
    this.state.currentAgentId = session.agentId;
    this.state.currentAgentSource = session.agentSource;
    void this.state.setLiveMode(session.liveMode);
    void this.state.setDebugMode(session.apexDebug);
    void this.state.setAgentSelected(true);

    this.messageSender = new WebviewMessageSender(this.state);
    this.messageSender.setWebview(this.wrapHostForOutboundTracking(panel));

    this.agentInitializer = new AgentInitializer(this.state);
    this.historyManager = new HistoryManager(this.state, this.messageSender);
    this.apexDebugManager = new ApexDebugManager(this.messageSender);
    this.sessionManager = new SessionManager(
      this.state,
      this.messageSender,
      this.agentInitializer,
      this.historyManager
    );

    this.messageHandlers = new WebviewMessageHandlers(
      this.state,
      this.messageSender,
      this.sessionManager,
      this.historyManager,
      this.apexDebugManager,
      context,
      panel
    );

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'webview', 'dist')]
    };
    panel.webview.html = renderSessionPanelHtml(context, session);

    this.disposables.push(
      panel.webview.onDidReceiveMessage(async message => {
        try {
          const shouldForward = await this.interceptMessage(message);
          if (!shouldForward) {
            return;
          }
          await this.messageHandlers.handleMessage(message);
        } catch (err) {
          try {
            await this.messageHandlers.handleError(err);
          } catch (handlerErr) {
            console.error('Critical error in session panel message handling:', handlerErr);
          }
        }
      }),
      panel.onDidChangeViewState(e => {
        if (e.webviewPanel.active) {
          this.registry.focus(this.sessionLocalId);
          void this.state.republishContext();
        }
      }),
      panel.onDidDispose(() => this.dispose())
    );

    this.disposables.push(
      this.registry.onDidChange(evt => {
        if (evt.session.id !== this.sessionLocalId) {
          return;
        }
        // Reflect apex debug flips pushed by the registry (e.g. conflict releases).
        if (evt.kind === 'updated') {
          this.syncDebugFromRegistry();
        }
      })
    );
  }

  private syncDebugFromRegistry(): void {
    const session = this.registry.get(this.sessionLocalId);
    if (!session) {
      return;
    }
    if (session.apexDebug !== this.state.isApexDebuggingEnabled) {
      void this.state.setDebugMode(session.apexDebug);
      if (this.state.agentInstance) {
        this.state.agentInstance.preview.setApexDebugging(session.apexDebug);
      }
    }
  }

  /**
   * Bridges a handful of messages to the `SessionRegistry` so the sidebar and cross-session
   * coordination (apex debug, status) stay in sync with per-panel state changes.
   * Returns false if the message has been fully handled here and should not be forwarded
   * to the inner handlers.
   */
  private async interceptMessage(
    message: { command?: string; type?: string; data?: unknown }
  ): Promise<boolean> {
    const command = message.command ?? message.type;
    if (!command) {
      return true;
    }

    switch (command) {
      case 'startSession': {
        const data = (message.data ?? {}) as {
          agentId?: string;
          agentSource?: AgentSource;
          isLiveMode?: boolean;
        };
        this.registry.update(this.sessionLocalId, {
          liveMode: data.isLiveMode ?? this.registry.get(this.sessionLocalId)?.liveMode ?? false
        });
        this.registry.setStatus(this.sessionLocalId, 'starting');
        return true;
      }
      case 'setApexDebugging': {
        const enabled = Boolean(message.data);
        if (enabled) {
          const result = this.registry.tryEnableApexDebug(this.sessionLocalId);
          if (!result.ok) {
            const name = result.conflictingSession.agentName ?? result.conflictingSession.agentId;
            void vscode.window.showErrorMessage(
              `Apex debugging is already enabled on "${name}". Disable it there first.`
            );
            const session = this.registry.get(this.sessionLocalId);
            if (session) {
              this.messageSender.sendConfiguration('apexDebug', session.apexDebug);
            }
            return false;
          }
        } else {
          this.registry.disableApexDebug(this.sessionLocalId);
        }
        return true;
      }
      case 'setLiveMode': {
        const data = (message.data ?? {}) as { isLiveMode?: boolean };
        if (typeof data.isLiveMode === 'boolean') {
          this.registry.update(this.sessionLocalId, { liveMode: data.isLiveMode });
        }
        return true;
      }
      case 'endSession': {
        this.registry.setStatus(this.sessionLocalId, 'inactive');
        return true;
      }
      default:
        return true;
    }
  }

  reveal(): void {
    this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.Active);
  }

  async stop(): Promise<void> {
    await this.sessionManager.endSession();
  }

  async restart(): Promise<void> {
    await this.sessionManager.restartSession();
  }

  async recompileAndRestart(): Promise<void> {
    await this.sessionManager.recompileAndRestartSession();
  }

  async activateVersion(): Promise<void> {
    const session = this.registry.get(this.sessionLocalId);
    if (!session) {
      return;
    }
    if (session.agentSource !== AgentSource.PUBLISHED) {
      void vscode.window.showErrorMessage('Version activation is only available for published agents.');
      return;
    }

    const agentId = session.agentId;

    let versions = this.state.agentVersionsCache.get(agentId);
    if (!versions || versions.length === 0) {
      try {
        const conn = await CoreExtensionService.getDefaultConnection();
        const project = SfProject.getInstance();
        const agent = await Agent.init({ connection: conn, project, apiNameOrId: agentId });
        const meta = await agent.getBotMetadata();
        versions = meta.BotVersions.records
          .filter((v: { IsDeleted?: boolean }) => !v.IsDeleted)
          .map((v: { VersionNumber: number; Status: string }) => ({
            VersionNumber: v.VersionNumber,
            Status: v.Status
          }));
        this.state.agentVersionsCache.set(agentId, versions);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Failed to load versions: ${msg}`);
        return;
      }
    }

    if (!versions || versions.length === 0) {
      void vscode.window.showErrorMessage('No versions found for this agent.');
      return;
    }

    const picked = await vscode.window.showQuickPick(
      buildVersionPickerItems(versions, { includeDeactivate: true }),
      { placeHolder: 'Select a version to activate' }
    );
    if (!picked) {
      return;
    }

    if (picked.action === 'deactivate') {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Deactivating agent...',
          cancellable: false
        },
        async () => {
          const conn = await CoreExtensionService.getDefaultConnection();
          const project = SfProject.getInstance();
          const agent = await Agent.init({ connection: conn, project, apiNameOrId: agentId });
          await agent.deactivate();
          for (const v of versions!) {
            v.Status = 'Inactive';
          }
          void vscode.window.showInformationMessage('Agent deactivated.');
        }
      );
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Activating version ${picked.versionNumber}...`,
        cancellable: false
      },
      async () => {
        const conn = await CoreExtensionService.getDefaultConnection();
        const project = SfProject.getInstance();
        const agent = await Agent.init({ connection: conn, project, apiNameOrId: agentId });
        const result = await agent.activate(picked.versionNumber!);
        const activatedVersion = result.VersionNumber as number;
        for (const v of versions!) {
          v.Status = v.VersionNumber === activatedVersion ? 'Active' : 'Inactive';
        }
        void vscode.window.showInformationMessage(`Version ${activatedVersion} activated.`);
      }
    );
  }

  async toggleDebug(): Promise<void> {
    const nextValue = !this.state.isApexDebuggingEnabled;
    if (nextValue) {
      const result = this.registry.tryEnableApexDebug(this.sessionLocalId);
      if (!result.ok) {
        const name = result.conflictingSession.agentName ?? result.conflictingSession.agentId;
        void vscode.window.showErrorMessage(
          `Apex debugging is already enabled on "${name}". Disable it there first.`
        );
        return;
      }
    } else {
      this.registry.disableApexDebug(this.sessionLocalId);
    }
    await this.state.setDebugMode(nextValue);
    if (this.state.agentInstance) {
      this.state.agentInstance.preview.setApexDebugging(nextValue);
    }
  }

  /**
   * Returns a host whose `postMessage` mirrors outbound status-affecting messages back into the registry.
   * The real `vscode.Webview` is still used for all actual messaging.
   */
  private wrapHostForOutboundTracking(panel: vscode.WebviewPanel): { webview: vscode.Webview } {
    const originalWebview = panel.webview;
    const trackStatusFromOutbound = (command: string): void => {
      switch (command) {
        case 'sessionStarted':
          this.registry.setStatus(this.sessionLocalId, 'active');
          break;
        case 'sessionEnded':
          this.registry.setStatus(this.sessionLocalId, 'inactive');
          break;
        case 'compilationError':
        case 'error':
          this.registry.setStatus(this.sessionLocalId, 'error');
          break;
        case 'sessionStarting':
        case 'compilationStarting':
        case 'simulationStarting':
          this.registry.setStatus(this.sessionLocalId, 'starting');
          break;
        default:
          break;
      }
    };

    const proxiedWebview: vscode.Webview = new Proxy(originalWebview, {
      get: (target, prop, receiver) => {
        if (prop === 'postMessage') {
          return (msg: { command?: string }) => {
            if (msg?.command) {
              trackStatusFromOutbound(msg.command);
            }
            return target.postMessage(msg);
          };
        }
        return Reflect.get(target, prop, receiver);
      }
    });

    return { webview: proxiedWebview };
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    // Best-effort end the SDK session so we don't leak remote preview state.
    if (this.state.agentInstance && this.state.sessionId) {
      void this.sessionManager.endSession().catch(err => {
        console.error('Failed to end session during panel disposal:', err);
      });
    }

    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        /* ignore */
      }
    }
    this.disposables.length = 0;

    this.registry.remove(this.sessionLocalId);
  }
}
