/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

jest.mock('@salesforce/agents', () => ({
  AgentSource: { SCRIPT: 'script', PUBLISHED: 'published' }
}));

const mockGetAllHistory = jest.fn();
jest.mock('@salesforce/agents/lib/utils', () => ({
  getAllHistory: (...args: unknown[]) => mockGetAllHistory(...args)
}));

jest.mock('@salesforce/core', () => ({
  SfProject: {
    getInstance: () => ({ getPath: () => '/mock/project' }),
    resolve: jest.fn().mockResolvedValue({ getPath: () => '/mock/project' })
  }
}));

const mockReaddir = jest.fn();
const mockReadFile = jest.fn();
const mockStat = jest.fn();
jest.mock('fs', () => ({
  promises: {
    readdir: (...args: unknown[]) => mockReaddir(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    stat: (...args: unknown[]) => mockStat(...args)
  }
}));

import { AgentSource } from '@salesforce/agents';
import { listSessionsForAgent } from '../../../../src/views/agentCombined/session/sessionHistoryService';

const dirent = (name: string, isDir = true) => ({ name, isDirectory: () => isDir });

describe('sessionHistoryService.listSessionsForAgent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFile.mockReset();
    mockReaddir.mockReset();
    mockStat.mockReset();
    mockGetAllHistory.mockResolvedValue({ transcript: [] });
  });

  it('returns [] when sessions directory is missing', async () => {
    mockReaddir.mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

    const result = await listSessionsForAgent('MyAgent', AgentSource.SCRIPT);

    expect(result).toEqual([]);
  });

  it('uses session-meta.json when present', async () => {
    mockReaddir.mockResolvedValueOnce([dirent('sess-1')]);
    mockReadFile.mockImplementation((p: string) => {
      if (p.endsWith('session-meta.json')) {
        return Promise.resolve(JSON.stringify({ timestamp: '2026-05-10T10:00:00Z', sessionType: 'live' }));
      }
      return Promise.reject(new Error('not found'));
    });
    mockGetAllHistory.mockResolvedValueOnce({
      transcript: [{ role: 'user', text: 'Hello there' }]
    });

    const [entry] = await listSessionsForAgent('MyAgent', AgentSource.SCRIPT);

    expect(entry).toEqual({
      sessionId: 'sess-1',
      timestamp: '2026-05-10T10:00:00Z',
      sessionType: 'live',
      firstUserMessage: 'Hello there'
    });
  });

  it('falls back to metadata.json mockMode when session-meta is missing', async () => {
    mockReaddir.mockResolvedValueOnce([dirent('sess-2')]);
    mockReadFile.mockImplementation((p: string) => {
      if (p.endsWith('metadata.json')) {
        return Promise.resolve(JSON.stringify({ startTime: '2026-05-09T08:00:00Z', mockMode: 'Mock' }));
      }
      return Promise.reject(new Error('not found'));
    });

    const [entry] = await listSessionsForAgent('MyAgent', AgentSource.SCRIPT);

    expect(entry.timestamp).toBe('2026-05-09T08:00:00Z');
    expect(entry.sessionType).toBe('simulated');
  });

  it('infers published sessionType from a Bot ID storage key', async () => {
    mockReaddir.mockResolvedValueOnce([dirent('sess-3')]);
    mockReadFile.mockRejectedValue(new Error('no metadata files'));
    mockStat.mockResolvedValueOnce({ mtime: new Date('2026-05-08T08:00:00Z') });

    const [entry] = await listSessionsForAgent('0XxFakeBot12345', AgentSource.PUBLISHED);

    expect(entry.sessionType).toBe('published');
    expect(entry.timestamp).toBe('2026-05-08T08:00:00.000Z');
  });

  it('sorts results newest first', async () => {
    mockReaddir.mockResolvedValueOnce([dirent('older'), dirent('newer')]);
    mockReadFile.mockImplementation((p: string) => {
      if (p.includes('older') && p.endsWith('session-meta.json')) {
        return Promise.resolve(JSON.stringify({ timestamp: '2026-01-01T00:00:00Z' }));
      }
      if (p.includes('newer') && p.endsWith('session-meta.json')) {
        return Promise.resolve(JSON.stringify({ timestamp: '2026-05-01T00:00:00Z' }));
      }
      return Promise.reject(new Error('not found'));
    });

    const result = await listSessionsForAgent('MyAgent', AgentSource.SCRIPT);

    expect(result.map(r => r.sessionId)).toEqual(['newer', 'older']);
  });
});
