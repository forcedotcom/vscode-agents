import * as vscode from 'vscode';
import { AgentSource } from '@salesforce/agents';
import type { Session, SessionChangeEvent, SessionStatus } from './session';
import type { UserPrefs } from './userPrefs';

export interface CreateSessionInput {
  agentId: string;
  agentSource: AgentSource;
  agentName?: string;
}

export class SessionRegistry {
  private readonly sessions = new Map<string, Session>();
  private readonly emitter = new vscode.EventEmitter<SessionChangeEvent>();
  private focusedSessionId: string | undefined;
  private nextLocalId = 1;

  readonly onDidChange = this.emitter.event;

  constructor(private readonly prefs: UserPrefs) {}

  create(input: CreateSessionInput): Session {
    const id = `afdx-session-${this.nextLocalId++}-${Date.now()}`;
    const session: Session = {
      id,
      agentId: input.agentId,
      agentSource: input.agentSource,
      agentName: input.agentName,
      status: 'draft',
      liveMode: input.agentSource === AgentSource.PUBLISHED ? true : this.prefs.defaultLiveMode,
      apexDebug: this.prefs.defaultApexDebug,
      sessionStartOperationId: 0,
      createdAt: Date.now()
    };

    // Enforce single-debug-attachment constraint on create.
    if (session.apexDebug && this.anyDebugAttached()) {
      session.apexDebug = false;
    }

    this.sessions.set(id, session);
    this.emitter.fire({ kind: 'created', session });
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  list(): Session[] {
    return Array.from(this.sessions.values());
  }

  listActive(): Session[] {
    return this.list().filter(s => s.status === 'starting' || s.status === 'active' || s.status === 'error');
  }

  remove(id: string): void {
    const session = this.sessions.get(id);
    if (!session) {
      return;
    }
    this.sessions.delete(id);
    if (this.focusedSessionId === id) {
      this.focusedSessionId = undefined;
    }
    this.emitter.fire({ kind: 'removed', session });
  }

  setStatus(id: string, status: SessionStatus): void {
    const session = this.sessions.get(id);
    if (!session) {
      return;
    }
    const previousStatus = session.status;
    if (previousStatus === status) {
      return;
    }
    session.status = status;
    this.emitter.fire({ kind: 'statusChanged', session, previousStatus });
  }

  update(id: string, patch: Partial<Session>): void {
    const session = this.sessions.get(id);
    if (!session) {
      return;
    }
    Object.assign(session, patch);
    this.emitter.fire({ kind: 'updated', session });
  }

  focus(id: string | undefined): void {
    if (this.focusedSessionId === id) {
      return;
    }
    this.focusedSessionId = id;
    if (id) {
      const session = this.sessions.get(id);
      if (session) {
        this.emitter.fire({ kind: 'focused', session });
      }
    }
  }

  getFocused(): Session | undefined {
    return this.focusedSessionId ? this.sessions.get(this.focusedSessionId) : undefined;
  }

  tryEnableApexDebug(id: string): { ok: true } | { ok: false; conflictingSession: Session } {
    const session = this.sessions.get(id);
    if (!session) {
      return { ok: true };
    }
    for (const other of this.sessions.values()) {
      if (other.id !== id && other.apexDebug) {
        return { ok: false, conflictingSession: other };
      }
    }
    session.apexDebug = true;
    this.emitter.fire({ kind: 'updated', session });
    return { ok: true };
  }

  disableApexDebug(id: string): void {
    const session = this.sessions.get(id);
    if (!session || !session.apexDebug) {
      return;
    }
    session.apexDebug = false;
    this.emitter.fire({ kind: 'updated', session });
  }

  beginSessionStart(id: string): number {
    const session = this.sessions.get(id);
    if (!session) {
      return 0;
    }
    session.sessionStartOperationId += 1;
    return session.sessionStartOperationId;
  }

  isSessionStartActive(id: string, operationId: number): boolean {
    const session = this.sessions.get(id);
    return !!session && session.sessionStartOperationId === operationId;
  }

  cancelPendingSessionStart(id: string): void {
    const session = this.sessions.get(id);
    if (!session) {
      return;
    }
    session.sessionStartOperationId += 1;
  }

  dispose(): void {
    this.emitter.dispose();
    this.sessions.clear();
  }

  private anyDebugAttached(): boolean {
    for (const session of this.sessions.values()) {
      if (session.apexDebug) {
        return true;
      }
    }
    return false;
  }
}
