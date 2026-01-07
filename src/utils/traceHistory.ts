import * as path from 'path';
import { promises as fs } from 'fs';
import { SfProject } from '@salesforce/core';

const TRACE_EXPORT_DIR = 'traces';

const resolveProjectLocalSfdx = async (): Promise<string> => {
  try {
    const project = await SfProject.resolve();
    return path.join(project.getPath(), '.sfdx');
  } catch {
    return path.join(process.cwd(), '.sfdx');
  }
};

const ensureTraceExportDir = async (agentStorageKey: string): Promise<string> => {
  const base = await resolveProjectLocalSfdx();
  const dir = path.join(base, 'agents', agentStorageKey, TRACE_EXPORT_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

const sanitizeForFilename = (value: string): string =>
  value
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'trace';

/**
 * Trace history entry type for the extension's UI
 * This aggregates traces from multiple sessions
 */
export type TraceHistoryEntry<T = unknown> = {
  storageKey: string;
  agentId: string;
  sessionId: string;
  planId: string;
  messageId?: string;
  userMessage?: string;
  timestamp: string;
  trace: T;
};

/**
 * Reads all trace files from all sessions for an agent
 * Uses the library's session format: ~/.sfdx/agents/{agentId}/sessions/{sessionId}/traces/{planId}.json
 */
export const readTraceHistoryEntries = async <T = unknown>(
  agentStorageKey: string
): Promise<TraceHistoryEntry<T>[]> => {
  if (!agentStorageKey) {
    console.warn('Agent storage key is empty, returning empty trace history');
    return [];
  }

  try {
    const base = await resolveProjectLocalSfdx();
    const agentDir = path.join(base, 'agents', agentStorageKey, 'sessions');
    
    // Check if sessions directory exists
    try {
      await fs.access(agentDir);
    } catch {
      return [];
    }

    const entries: TraceHistoryEntry<T>[] = [];
    const sessionDirs = await fs.readdir(agentDir, { withFileTypes: true });

    // Read all sessions
    for (const sessionDir of sessionDirs) {
      if (!sessionDir.isDirectory()) {
        continue;
      }

      const sessionId = sessionDir.name;
      const tracesDir = path.join(agentDir, sessionId, 'traces');

      // Check if traces directory exists
      try {
        await fs.access(tracesDir);
      } catch {
        continue;
      }

      // Read all trace files in this session
      const traceFiles = await fs.readdir(tracesDir);
      for (const traceFile of traceFiles) {
        if (!traceFile.endsWith('.json')) {
          continue;
        }

        try {
          const planId = path.basename(traceFile, '.json');
          const tracePath = path.join(tracesDir, traceFile);
          const traceContent = await fs.readFile(tracePath, 'utf8');
          const trace = JSON.parse(traceContent) as T;

          // Try to read metadata for timestamp
          let timestamp = new Date().toISOString();
          try {
            const metadataPath = path.join(agentDir, sessionId, 'metadata.json');
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            const metadata = JSON.parse(metadataContent);
            timestamp = metadata.startTime || timestamp;
          } catch {
            // Use file modification time as fallback
            const stats = await fs.stat(tracePath);
            timestamp = stats.mtime.toISOString();
          }

          entries.push({
            storageKey: agentStorageKey,
            agentId: agentStorageKey,
            sessionId,
            planId,
            timestamp,
            trace
          });
        } catch (error) {
          console.error(`Error reading trace file ${traceFile}:`, error);
        }
      }
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return entries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Could not read trace history:', error);
    }
    return [];
  }
};

/**
 * Writes a trace entry to a JSON file for viewing/export
 * This is a utility function for opening trace files in the editor
 */
export const writeTraceEntryToFile = async <T>(entry: TraceHistoryEntry<T>): Promise<string> => {
  const { storageKey, planId, sessionId, trace } = entry;
  if (!storageKey || storageKey.trim() === '') {
    throw new Error('Trace entry is missing storage information.');
  }

  const exportDir = await ensureTraceExportDir(storageKey);
  const safeSessionId = sanitizeForFilename(sessionId || 'session');
  const safePlanId = sanitizeForFilename(planId || 'trace');
  const fileName = `${safeSessionId}-${safePlanId}.json`;
  const filePath = path.join(exportDir, fileName);

  await fs.writeFile(filePath, JSON.stringify(trace ?? {}, null, 2), 'utf8');
  return filePath;
};
