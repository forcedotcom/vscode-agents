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

// Semantic token types used by VS Code's JSON language service.
// Checked with optional ":json" language qualifier, most specific first.
const JSON_SEMANTIC_TOKENS: Record<keyof JsonTokenColors, string[]> = {
  key: ['property:json', 'property'],
  string: ['string:json', 'string'],
  number: ['number:json', 'number'],
  boolean: ['keyword:json', 'keyword'],
  null: ['keyword:json', 'keyword']
};

interface ThemeTokenColor {
  scope?: string | string[];
  settings?: { foreground?: string; fontStyle?: string };
}

type SemanticColorValue = string | { foreground?: string; fontStyle?: string };

interface ThemeData {
  include?: string;
  tokenColors?: ThemeTokenColor[];
  semanticHighlighting?: boolean;
  semanticTokenColors?: Record<string, SemanticColorValue>;
}

/**
 * Strips JSONC comments while respecting string boundaries.
 * A simple regex can't distinguish comments from "//" inside strings (e.g. URLs),
 * so we walk the string tracking whether we're inside a quoted string.
 */
function stripJsonComments(text: string): string {
  let result = '';
  let i = 0;
  let inString = false;

  while (i < text.length) {
    const ch = text[i];

    if (inString) {
      result += ch;
      // Skip escaped characters (handles \\, \", etc.)
      if (ch === '\\') {
        i++;
        if (i < text.length) {
          result += text[i];
        }
      } else if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    // Outside a string
    if (ch === '"') {
      inString = true;
      result += ch;
      i++;
    } else if (ch === '/' && text[i + 1] === '/') {
      // Single-line comment — skip to end of line
      i += 2;
      while (i < text.length && text[i] !== '\n') {
        i++;
      }
    } else if (ch === '/' && text[i + 1] === '*') {
      // Multi-line comment — skip to closing */
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        i++;
      }
      i += 2;
    } else {
      result += ch;
      i++;
    }
  }

  // Remove trailing commas before } or ]
  return result.replace(/,(\s*[}\]])/g, '$1');
}

function loadThemeFile(filePath: string): ThemeData | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(stripJsonComments(content));
  } catch {
    return undefined;
  }
}

interface CollectedTheme {
  tokenColors: ThemeTokenColor[];
  semanticHighlighting?: boolean;
  semanticTokenColors?: Record<string, SemanticColorValue>;
}

/**
 * Recursively collects theme data from a theme and its includes.
 * Child entries appear after parent entries so they take priority.
 */
function collectThemeData(filePath: string, visited = new Set<string>()): CollectedTheme {
  const empty: CollectedTheme = { tokenColors: [] };
  if (visited.has(filePath)) {
    return empty;
  }
  visited.add(filePath);

  const theme = loadThemeFile(filePath);
  if (!theme) {
    return empty;
  }

  let result = empty;

  if (theme.include) {
    const includePath = path.resolve(path.dirname(filePath), theme.include);
    result = collectThemeData(includePath, visited);
  }

  if (theme.tokenColors) {
    result.tokenColors = [...result.tokenColors, ...theme.tokenColors];
  }

  // Semantic colors: child theme entries override parent
  if (theme.semanticTokenColors) {
    result.semanticTokenColors = { ...result.semanticTokenColors, ...theme.semanticTokenColors };
  }
  if (theme.semanticHighlighting !== undefined) {
    result.semanticHighlighting = theme.semanticHighlighting;
  }

  return result;
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

/**
 * Extracts the foreground color from a semantic token color value.
 */
function getSemanticForeground(value: SemanticColorValue): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return value.foreground;
}

/**
 * Finds a semantic token color for a JSON token type.
 * Tries language-specific (":json") selectors first, then generic ones.
 */
function findSemanticColor(
  semanticTokenColors: Record<string, SemanticColorValue>,
  candidates: string[]
): string | undefined {
  for (const candidate of candidates) {
    const value = semanticTokenColors[candidate];
    if (value) {
      return getSemanticForeground(value);
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
 * Checks semantic token colors first (when enabled), then falls back to TextMate tokenColors.
 */
export function getJsonTokenColors(): JsonTokenColors {
  try {
    const themeId = vscode.workspace.getConfiguration('workbench')?.get<string>('colorTheme');
    if (!themeId) {
      return {};
    }
    return resolveThemeColors(themeId);
  } catch {
    return {};
  }
}

function resolveThemeColors(themeId: string): JsonTokenColors {

  const themePath = findThemePath(themeId);
  if (!themePath) {
    return {};
  }

  const themeData = collectThemeData(themePath);
  const result: JsonTokenColors = {};

  for (const token of Object.keys(JSON_TOKEN_SCOPES) as Array<keyof JsonTokenColors>) {
    // Semantic colors take priority when the theme has semantic highlighting enabled
    if (themeData.semanticHighlighting && themeData.semanticTokenColors) {
      const semanticColor = findSemanticColor(themeData.semanticTokenColors, JSON_SEMANTIC_TOKENS[token]);
      if (semanticColor) {
        result[token] = semanticColor;
        continue;
      }
    }

    // Fall back to TextMate tokenColors
    const tmColor = findColorForScope(themeData.tokenColors, JSON_TOKEN_SCOPES[token]);
    if (tmColor) {
      result[token] = tmColor;
    }
  }

  return result;
}
