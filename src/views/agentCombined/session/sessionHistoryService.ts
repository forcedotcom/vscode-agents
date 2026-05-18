import * as path from 'path';
import { promises as fs } from 'fs';
import { AgentSource } from '@salesforce/agents';
import { getAllHistory } from '@salesforce/agents/lib/utils';
import { SfProject } from '@salesforce/core';
import { getAgentStorageKey } from '../agent/agentUtils';

export type SessionListEntry = {
  sessionId: string;
  timestamp?: string;
  sessionType?: 'simulated' | 'live' | 'published';
  firstUserMessage?: string;
};

const resolveProjectLocalSfdx = async (): Promise<string> => {
  try {
    const project = await SfProject.resolve();
    return path.join(project.getPath(), '.sfdx');
  } catch {
    return path.join(process.cwd(), '.sfdx');
  }
};

/**
 * Reads per-session metadata from `.sfdx/agents/<key>/sessions/<sessionId>/`,
 * which is the shared on-disk format used by the sf CLI plugin.
 */
const readSessionMeta = async (
  sessionDir: string,
  storageKey: string
): Promise<{ timestamp?: string; sessionType?: SessionListEntry['sessionType'] }> => {
  const result: { timestamp?: string; sessionType?: SessionListEntry['sessionType'] } = {};

  try {
    const raw = await fs.readFile(path.join(sessionDir, 'session-meta.json'), 'utf8');
    const meta = JSON.parse(raw);
    if (typeof meta.timestamp === 'string') {
      result.timestamp = meta.timestamp;
    }
    if (meta.sessionType === 'simulated' || meta.sessionType === 'live' || meta.sessionType === 'published') {
      result.sessionType = meta.sessionType;
    }
  } catch {
    // No cache marker; fall through to metadata.json
  }

  let metadataMockMode: string | undefined;
  if (!result.timestamp || !result.sessionType) {
    try {
      const raw = await fs.readFile(path.join(sessionDir, 'metadata.json'), 'utf8');
      const meta = JSON.parse(raw);
      if (!result.timestamp && typeof meta.startTime === 'string') {
        result.timestamp = meta.startTime;
      }
      if (typeof meta.mockMode === 'string') {
        metadataMockMode = meta.mockMode;
      }
    } catch {
      // No metadata.json; fall through to mtime
    }
  }

  if (!result.sessionType) {
    if (metadataMockMode === 'Live Test') {
      result.sessionType = 'live';
    } else if (metadataMockMode === 'Mock') {
      result.sessionType = 'simulated';
    } else if (storageKey.startsWith('0X') && (storageKey.length === 15 || storageKey.length === 18)) {
      result.sessionType = 'published';
    }
  }

  if (!result.timestamp) {
    try {
      const stats = await fs.stat(sessionDir);
      result.timestamp = stats.mtime.toISOString();
    } catch {
      // ignore
    }
  }

  return result;
};

/**
 * Lists prior sessions for a single agent, newest first.
 * Reads directly from `.sfdx/agents/<storageKey>/sessions/` so the list
 * matches what the sf CLI plugin sees on disk.
 */
export async function listSessionsForAgent(
  agentId: string,
  agentSource: AgentSource
): Promise<SessionListEntry[]> {
  const storageKey = getAgentStorageKey(agentId, agentSource);
  const base = await resolveProjectLocalSfdx();
  const sessionsDir = path.join(base, 'agents', storageKey, 'sessions');

  let dirents;
  try {
    dirents = await fs.readdir(sessionsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const enriched = await Promise.all(
    dirents
      .filter(d => d.isDirectory())
      .map(async dirent => {
        const sessionId = dirent.name;
        const sessionDir = path.join(sessionsDir, sessionId);
        const { timestamp, sessionType } = await readSessionMeta(sessionDir, storageKey);

        let firstUserMessage: string | undefined;
        try {
          const history = await getAllHistory(storageKey, sessionId);
          const firstUser = history.transcript.find(t => t.role === 'user' && t.text);
          firstUserMessage = firstUser?.text;
        } catch {
          // Best-effort; leave undefined
        }

        return { sessionId, timestamp, sessionType, firstUserMessage };
      })
  );

  enriched.sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });

  return enriched;
}
