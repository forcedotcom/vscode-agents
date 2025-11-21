import * as path from 'path';
import { promises as fs } from 'fs';
import { SfProject } from '@salesforce/core';

const TRACE_FILE_NAME = 'traceHistory.json';
const TRACE_EXPORT_DIR = 'traces';

const resolveProjectLocalSfdx = async (): Promise<string> => {
  try {
    const project = await SfProject.resolve();
    return path.join(project.getPath(), '.sfdx');
  } catch {
    return path.join(process.cwd(), '.sfdx');
  }
};

const ensureAgentTraceDir = async (agentStorageKey: string): Promise<string> => {
  const base = await resolveProjectLocalSfdx();
  const dir = path.join(base, 'agents', agentStorageKey);
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

const ensureTraceExportDir = async (agentStorageKey: string): Promise<string> => {
  const baseDir = await ensureAgentTraceDir(agentStorageKey);
  const exportDir = path.join(baseDir, TRACE_EXPORT_DIR);
  await fs.mkdir(exportDir, { recursive: true });
  return exportDir;
};

const sanitizeForFilename = (value: string): string =>
  value
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'trace';

const getTraceFilePath = async (agentStorageKey: string): Promise<string> => {
  const dir = await ensureAgentTraceDir(agentStorageKey);
  return path.join(dir, TRACE_FILE_NAME);
};

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

export const clearTraceHistory = async (agentStorageKey: string): Promise<void> => {
  const filePath = await getTraceFilePath(agentStorageKey);
  try {
    await fs.rm(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
};

export const appendTraceHistoryEntry = async <T>(
  agentStorageKey: string,
  entry: TraceHistoryEntry<T>
): Promise<void> => {
  const filePath = await getTraceFilePath(agentStorageKey);
  const line = `${JSON.stringify(entry)}\n`;
  await fs.appendFile(filePath, line, 'utf8');
};

export const readTraceHistoryEntries = async <T>(agentStorageKey: string): Promise<TraceHistoryEntry<T>[]> => {
  const filePath = await getTraceFilePath(agentStorageKey);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line) as TraceHistoryEntry<T>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Could not read trace history file:', error);
    }
    return [];
  }
};

export const writeTraceEntryToFile = async <T>(entry: TraceHistoryEntry<T>): Promise<string> => {
  const { storageKey, planId, sessionId, trace } = entry;
  if (!storageKey) {
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
