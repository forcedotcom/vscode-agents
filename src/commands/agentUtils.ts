/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Gets the agent name from a directory path or file path.
 * Handles both file selections and directory selections.
 */
export async function getAgentNameFromPath(targetPath: string): Promise<string> {
  const stat = await vscode.workspace.fs.stat(vscode.Uri.file(targetPath));

  if (stat.type === vscode.FileType.Directory) {
    // If it's a directory, look for a .bot-meta.xml file in it
    return getAgentNameFromDirectory(targetPath);
  } else {
    // If it's a file, use the existing logic
    const fileName = path.basename(targetPath);
    return getAgentNameFromFile(fileName, targetPath);
  }
}

/**
 * Extracts the agent name from a directory by looking for a .bot-meta.xml file.
 */
async function getAgentNameFromDirectory(directoryPath: string): Promise<string> {
  try {
    const dirUri = vscode.Uri.file(directoryPath);
    const files = await vscode.workspace.fs.readDirectory(dirUri);

    // Find the .bot-meta.xml file
    const botMetaFile = files.find(([name, type]) => type === vscode.FileType.File && name.endsWith('.bot-meta.xml'));

    if (botMetaFile) {
      // Extract bot name from the .bot-meta.xml filename
      return botMetaFile[0].replace('.bot-meta.xml', '');
    }

    // Fallback: use the directory name (assuming it's the bot name)
    return path.basename(directoryPath);
  } catch (error) {
    console.warn('Failed to read directory for bot metadata, falling back to directory name:', error);
    return path.basename(directoryPath);
  }
}

/**
 * Extracts the agent name from the given file or directory.
 * For .bot-meta.xml files, returns the filename without extension.
 * For .botVersion-meta.xml files, looks for a .bot-meta.xml file in the same directory
 * and returns that filename without extension.
 * For directories, looks for a .bot-meta.xml file in the directory.
 */
export async function getAgentNameFromFile(fileName: string, filePath: string): Promise<string> {
  // For bot metadata files, extract agent name from filename
  if (fileName.endsWith('.bot-meta.xml')) {
    return fileName.replace('.bot-meta.xml', '');
  }

  // For genAiPlannerBundle files, extract agent name from filename
  if (fileName.endsWith('.genAiPlannerBundle')) {
    // Remove the .genAiPlannerBundle extension and Planner suffix
    return fileName.replace('.genAiPlannerBundle', '');
  }

  // For bot version metadata files, find the corresponding .bot-meta.xml file in the same directory
  if (fileName.endsWith('.botVersion-meta.xml')) {
    try {
      const directory = path.dirname(filePath);
      const dirUri = vscode.Uri.file(directory);

      // Read all files in the directory
      const files = await vscode.workspace.fs.readDirectory(dirUri);

      // Find the .bot-meta.xml file
      const botMetaFile = files.find(([name, type]) => type === vscode.FileType.File && name.endsWith('.bot-meta.xml'));

      if (botMetaFile) {
        // Extract bot name from the .bot-meta.xml filename
        return botMetaFile[0].replace('.bot-meta.xml', '');
      }

      // Fallback: try to infer from the file path structure
      // Bot version files are typically in: force-app/main/default/botVersions/{botName}/{versionName}.botVersion-meta.xml
      const pathParts = filePath.split(path.sep);
      const botVersionIndex = pathParts.findIndex(part => part === 'botVersions');
      if (botVersionIndex >= 0 && botVersionIndex < pathParts.length - 2) {
        return pathParts[botVersionIndex + 1]; // The bot name is the directory after 'botVersions'
      }

      // Last fallback: use the version name (original behavior)
      return fileName.replace('.botVersion-meta.xml', '');
    } catch (error) {
      console.warn('Failed to find bot metadata file in directory, falling back to filename:', error);
      return fileName.replace('.botVersion-meta.xml', '');
    }
  }

  return fileName;
}
