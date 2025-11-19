import * as path from 'path';
import { promises as fs } from 'fs';
import { SfProject } from '@salesforce/core';

const TRACE_FILE_NAME = 'traceHistory.json';

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

export const readTraceHistoryEntries = async <T>(
  agentStorageKey: string
): Promise<TraceHistoryEntry<T>[]> => {
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
