/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getAgentNameFromFile, getAgentNameFromPath } from '../../src/commands/agentUtils';

describe('Bot Version File System Lookup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(vscode.workspace.fs, 'readDirectory');
  });

  it('should extract bot name from .bot-meta.xml filename', async () => {
    const mockFilePath = path.join(
      'path',
      'to',
      'force-app',
      'main',
      'default',
      'botVersions',
      'TestAgent',
      'v1.botVersion-meta.xml'
    );

    const mockFiles: [string, vscode.FileType][] = [
      ['v1.botVersion-meta.xml', vscode.FileType.File],
      ['TestAgent.bot-meta.xml', vscode.FileType.File],
      ['someOtherFile.txt', vscode.FileType.File]
    ];

    (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockFiles);

    const botName = await getAgentNameFromFile('v1.botVersion-meta.xml', mockFilePath);
    expect(botName).toBe('TestAgent');
  });

  it('should handle bot metadata files directly', async () => {
    const botName = await getAgentNameFromFile(
      'TestAgent.bot-meta.xml',
      path.join('path', 'to', 'TestAgent.bot-meta.xml')
    );
    expect(botName).toBe('TestAgent');
  });

  it('should handle case when no .bot-meta.xml file is found', async () => {
    const mockFilePath = path.join(
      'path',
      'to',
      'force-app',
      'main',
      'default',
      'botVersions',
      'TestAgent',
      'v1.botVersion-meta.xml'
    );

    const mockFiles: [string, vscode.FileType][] = [
      ['v1.botVersion-meta.xml', vscode.FileType.File],
      ['someOtherFile.txt', vscode.FileType.File]
    ];

    (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockFiles);

    const botName = await getAgentNameFromFile('v1.botVersion-meta.xml', mockFilePath);
    expect(botName).toBe('TestAgent'); // Should fall back to directory name
  });

  it('should ignore directories and only look at files', async () => {
    const mockFilePath = path.join(
      'path',
      'to',
      'force-app',
      'main',
      'default',
      'botVersions',
      'TestAgent',
      'v1.botVersion-meta.xml'
    );

    const mockFiles: [string, vscode.FileType][] = [
      ['v1.botVersion-meta.xml', vscode.FileType.File],
      ['BadBot.bot-meta.xml', vscode.FileType.Directory], // This is a directory, should be ignored
      ['TestAgent.bot-meta.xml', vscode.FileType.File]
    ];

    (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockFiles);

    const botName = await getAgentNameFromFile('v1.botVersion-meta.xml', mockFilePath);
    expect(botName).toBe('TestAgent');
  });

  it('should fall back to filename if file system lookup fails', async () => {
    const mockFilePath = path.join('path', 'to', 'v1.botVersion-meta.xml');
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    (vscode.workspace.fs.readDirectory as jest.Mock).mockRejectedValue(new Error('File read error'));

    const botName = await getAgentNameFromFile('v1.botVersion-meta.xml', mockFilePath);
    expect(botName).toBe('v1'); // Should fall back to version name

    consoleWarnSpy.mockRestore();
  });
});

describe('Directory Path Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(vscode.workspace.fs, 'stat');
    jest.spyOn(vscode.workspace.fs, 'readDirectory');
  });

  it('should handle directory paths and find bot name from .bot-meta.xml file', async () => {
    const mockDirectoryPath = path.join('path', 'to', 'force-app', 'main', 'default', 'bots', 'TestAgent');

    const mockFiles: [string, vscode.FileType][] = [
      ['v1.botVersion-meta.xml', vscode.FileType.File],
      ['TestAgent.bot-meta.xml', vscode.FileType.File],
      ['someOtherFile.txt', vscode.FileType.File]
    ];

    // Mock the directory stat
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
      type: vscode.FileType.Directory
    });

    (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockFiles);

    const botName = await getAgentNameFromPath(mockDirectoryPath);
    expect(botName).toBe('TestAgent');
    expect(vscode.workspace.fs.stat).toHaveBeenCalledWith(vscode.Uri.file(mockDirectoryPath));
    expect(vscode.workspace.fs.readDirectory).toHaveBeenCalledWith(vscode.Uri.file(mockDirectoryPath));
  });

  it('should handle file paths by delegating to getAgentNameFromFile', async () => {
    const mockFilePath = path.join(
      'path',
      'to',
      'force-app',
      'main',
      'default',
      'botVersions',
      'TestAgent',
      'v1.botVersion-meta.xml'
    );

    const mockFiles: [string, vscode.FileType][] = [
      ['v1.botVersion-meta.xml', vscode.FileType.File],
      ['TestAgent.bot-meta.xml', vscode.FileType.File]
    ];

    // Mock the file stat
    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
      type: vscode.FileType.File
    });

    (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockFiles);

    const botName = await getAgentNameFromPath(mockFilePath);
    expect(botName).toBe('TestAgent');
    expect(vscode.workspace.fs.stat).toHaveBeenCalledWith(vscode.Uri.file(mockFilePath));
  });

  it('should fall back to directory name if no .bot-meta.xml file found in directory', async () => {
    const mockDirectoryPath = path.join('path', 'to', 'force-app', 'main', 'default', 'botVersions', 'MyBot');

    const mockFiles: [string, vscode.FileType][] = [
      ['v1.botVersion-meta.xml', vscode.FileType.File],
      ['someOtherFile.txt', vscode.FileType.File]
      // No .bot-meta.xml file
    ];

    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
      type: vscode.FileType.Directory
    });

    (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockFiles);

    const botName = await getAgentNameFromPath(mockDirectoryPath);
    expect(botName).toBe('MyBot'); // Should fall back to directory name
  });

  it('should handle directories in bots path structure', async () => {
    const mockDirectoryPath = path.join('path', 'to', 'force-app', 'main', 'default', 'bots', 'MyAgent');

    const mockFiles: [string, vscode.FileType][] = [
      ['MyAgent.bot-meta.xml', vscode.FileType.File],
      ['someConfig.xml', vscode.FileType.File]
    ];

    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
      type: vscode.FileType.Directory
    });

    (vscode.workspace.fs.readDirectory as jest.Mock).mockResolvedValue(mockFiles);

    const botName = await getAgentNameFromPath(mockDirectoryPath);
    expect(botName).toBe('MyAgent');
  });

  it('should handle directory read errors gracefully', async () => {
    const mockDirectoryPath = path.join('path', 'to', 'force-app', 'main', 'default', 'botVersions', 'ErrorBot');
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue({
      type: vscode.FileType.Directory
    });

    (vscode.workspace.fs.readDirectory as jest.Mock).mockRejectedValue(new Error('Permission denied'));

    const botName = await getAgentNameFromPath(mockDirectoryPath);
    expect(botName).toBe('ErrorBot'); // Should fall back to directory name

    consoleWarnSpy.mockRestore();
  });
});
