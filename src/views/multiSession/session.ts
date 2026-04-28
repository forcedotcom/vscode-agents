import { AgentSource } from '@salesforce/agents';
import type { AgentInstance } from '../agentCombined/types';

export type SessionStatus = 'draft' | 'starting' | 'active' | 'inactive' | 'error';

export interface Session {
  readonly id: string;
  agentId: string;
  agentSource: AgentSource;
  agentName?: string;
  status: SessionStatus;
  sessionId?: string;
  agentInstance?: AgentInstance;
  liveMode: boolean;
  apexDebug: boolean;
  currentPlanId?: string;
  currentUserMessage?: string;
  sessionStartOperationId: number;
  pendingStartAgentId?: string;
  pendingStartAgentSource?: AgentSource;
  createdAt: number;
}

export type SessionChangeKind =
  | 'created'
  | 'updated'
  | 'statusChanged'
  | 'removed'
  | 'focused';

export interface SessionChangeEvent {
  kind: SessionChangeKind;
  session: Session;
  previousStatus?: SessionStatus;
}
