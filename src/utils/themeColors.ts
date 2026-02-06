import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface JsonTokenColors {
  key?: string;
  string?: string;
  number?: string;
  boolean?: string;
  null?: string;
}

// TextMate scopes for JSON tokens, ordered from most to least specific
const JSON_SCOPE_MAP: Record<keyof JsonTokenColors, string[]> = {
  key: ['support.type.property-name.json', 'support.type.property-name'],
  string: ['string.quoted.double.json', 'string.quoted.double', 'string.quoted', 'string'],
  number: ['constant.numeric.json', 'constant.numeric'],
  boolean: ['constant.language.boolean.json', 'constant.language.json', 'constant.language'],
  null: ['constant.language.null.json', 'constant.language.json', 'constant.language']
};

interface ThemeTokenColor {
  scope?: string | string[];
  settings?: { foreground?: string; fontStyle?: string };
}

interface ThemeData {
  include?: string;
  tokenColors?: ThemeTokenColor[];
}

function stripJsonComments(text: string): string {
  return text
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,(\s*[}\]])/g, '$1');
}

function loadThemeFile(filePath: string): ThemeData | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(stripJsonComments(content));
  } catch {
    return undefined;
  }
}

/**
 * Recursively collects tokenColors from a theme and its includes.
 * Child entries appear after parent entries so they take priority.
 */
function collectTokenColors(filePath: string, visited = new Set<string>()): ThemeTokenColor[] {
  if (visited.has(filePath)) {
    return [];
  }
  visited.add(filePath);

  const theme = loadThemeFile(filePath);
  if (!theme) {
    return [];
  }

  let colors: ThemeTokenColor[] = [];

  if (theme.include) {
    const includePath = path.resolve(path.dirname(filePath), theme.include);
    colors = collectTokenColors(includePath, visited);
  }

  if (theme.tokenColors) {
    colors = [...colors, ...theme.tokenColors];
  }

  return colors;
}

/**
 * Finds the best matching foreground color for a list of scope candidates.
 * Tries each candidate from most to least specific, scanning entries in
 * reverse so that later (higher-priority) entries win.
 */
function findColorForScopes(tokenColors: ThemeTokenColor[], scopeCandidates: string[]): string | undefined {
  for (const candidate of scopeCandidates) {
    for (let i = tokenColors.length - 1; i >= 0; i--) {
      const entry = tokenColors[i];
      if (!entry.scope || !entry.settings?.foreground) {
        continue;
      }

      const scopes = Array.isArray(entry.scope) ? entry.scope : [entry.scope];
      if (scopes.some(s => s.trim() === candidate)) {
        return entry.settings.foreground;
      }
    }
  }
  return undefined;
}

function findThemePath(themeId: string): string | undefined {
  for (const ext of vscode.extensions.all) {
    const themes = ext.packageJSON?.contributes?.themes as
      | Array<{ id?: string; label?: string; path?: string }>
      | undefined;
    if (!themes) {
      continue;
    }

    for (const theme of themes) {
      if ((theme.id === themeId || theme.label === themeId) && theme.path) {
        return path.join(ext.extensionPath, theme.path);
      }
    }
  }
  return undefined;
}

/**
 * Reads the active VS Code color theme and extracts token colors for JSON syntax elements.
 * Returns colors that match the editor's actual syntax highlighting.
 */
export function getJsonTokenColors(): JsonTokenColors {
  const themeId = vscode.workspace.getConfiguration('workbench').get<string>('colorTheme');
  if (!themeId) {
    return {};
  }

  const themePath = findThemePath(themeId);
  if (!themePath) {
    return {};
  }

  const tokenColors = collectTokenColors(themePath);
  if (tokenColors.length === 0) {
    return {};
  }

  const result: JsonTokenColors = {};
  for (const [token, scopes] of Object.entries(JSON_SCOPE_MAP)) {
    const color = findColorForScopes(tokenColors, scopes);
    if (color) {
      result[token as keyof JsonTokenColors] = color;
    }
  }
  return result;
}
