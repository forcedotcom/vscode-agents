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

// The full TextMate scope for each JSON token type.
// Theme selectors are matched as prefixes against these (e.g. "string" matches "string.quoted.double.json").
const JSON_TOKEN_SCOPES: Record<keyof JsonTokenColors, string> = {
  key: 'support.type.property-name.json',
  string: 'string.quoted.double.json',
  number: 'constant.numeric.json',
  boolean: 'constant.language.json',
  null: 'constant.language.json'
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
 * Finds the best matching foreground color for a token scope using TextMate prefix matching.
 * A theme selector "string" matches token scope "string.quoted.double.json" because it's
 * a dot-separated prefix. The longest (most specific) matching selector wins. Among entries
 * with equal specificity, later entries take priority (child theme overrides parent).
 */
function findColorForScope(tokenColors: ThemeTokenColor[], tokenScope: string): string | undefined {
  let bestColor: string | undefined;
  let bestLength = 0;

  for (const entry of tokenColors) {
    if (!entry.scope || !entry.settings?.foreground) {
      continue;
    }

    const selectors = Array.isArray(entry.scope) ? entry.scope : [entry.scope];
    for (const selector of selectors) {
      const trimmed = selector.trim();
      if (trimmed.length < bestLength) {
        continue;
      }
      // Exact match or dot-separated prefix match
      if (tokenScope === trimmed || tokenScope.startsWith(trimmed + '.')) {
        bestColor = entry.settings.foreground;
        bestLength = trimmed.length;
      }
    }
  }

  return bestColor;
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
  for (const [token, scope] of Object.entries(JSON_TOKEN_SCOPES)) {
    const color = findColorForScope(tokenColors, scope);
    if (color) {
      result[token as keyof JsonTokenColors] = color;
    }
  }
  return result;
}
