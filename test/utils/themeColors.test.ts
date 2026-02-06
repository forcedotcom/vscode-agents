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
import * as fs from 'fs';
import { getJsonTokenColors } from '../../src/utils/themeColors';

const vscode = require('vscode') as typeof import('vscode');

jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

function setupThemeExtension(themeId: string, themePath: string, matchField: 'id' | 'label' = 'label') {
  (vscode.extensions as any).all = [
    {
      extensionPath: '/extensions/test-theme',
      packageJSON: {
        contributes: {
          themes: [
            {
              [matchField]: themeId,
              path: themePath
            }
          ]
        }
      }
    }
  ];
  (vscode.workspace as any).getConfiguration = jest.fn().mockReturnValue({
    get: jest.fn().mockReturnValue(themeId)
  });
}

function themeJson(data: Record<string, unknown>): string {
  return JSON.stringify(data);
}

describe('themeColors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupThemeExtension('Test Dark', './themes/dark.json');
  });

  describe('getJsonTokenColors', () => {
    it('returns empty object when no theme ID is configured', () => {
      (vscode.workspace as any).getConfiguration = jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue(undefined)
      });

      expect(getJsonTokenColors()).toEqual({});
    });

    it('returns empty object when theme path is not found', () => {
      (vscode.extensions as any).all = [];

      expect(getJsonTokenColors()).toEqual({});
    });

    it('extracts token colors from a simple theme file', () => {
      mockFs.readFileSync.mockReturnValue(
        themeJson({
          tokenColors: [
            { scope: 'support.type.property-name.json', settings: { foreground: '#aabbcc' } },
            { scope: 'string.quoted.double.json', settings: { foreground: '#112233' } },
            { scope: 'constant.numeric.json', settings: { foreground: '#445566' } },
            { scope: 'constant.language.json', settings: { foreground: '#778899' } }
          ]
        }) as any
      );

      expect(getJsonTokenColors()).toEqual({
        key: '#aabbcc',
        string: '#112233',
        number: '#445566',
        boolean: '#778899',
        null: '#778899'
      });
    });

    it('uses TextMate prefix matching for scope selectors', () => {
      mockFs.readFileSync.mockReturnValue(
        themeJson({
          tokenColors: [
            { scope: 'string', settings: { foreground: '#generic' } },
            { scope: 'constant.numeric', settings: { foreground: '#number' } }
          ]
        }) as any
      );

      const result = getJsonTokenColors();
      expect(result.string).toBe('#generic');
      expect(result.number).toBe('#number');
    });

    it('prefers more specific scope selectors', () => {
      mockFs.readFileSync.mockReturnValue(
        themeJson({
          tokenColors: [
            { scope: 'string', settings: { foreground: '#generic' } },
            { scope: 'string.quoted.double.json', settings: { foreground: '#specific' } }
          ]
        }) as any
      );

      expect(getJsonTokenColors().string).toBe('#specific');
    });

    it('handles scope arrays in theme entries', () => {
      mockFs.readFileSync.mockReturnValue(
        themeJson({
          tokenColors: [
            {
              scope: ['support.type.property-name.json', 'entity.name.tag'],
              settings: { foreground: '#key-color' }
            }
          ]
        }) as any
      );

      expect(getJsonTokenColors().key).toBe('#key-color');
    });

    it('skips entries without foreground color', () => {
      mockFs.readFileSync.mockReturnValue(
        themeJson({
          tokenColors: [{ scope: 'string', settings: { fontStyle: 'italic' } }]
        }) as any
      );

      expect(getJsonTokenColors().string).toBeUndefined();
    });

    it('follows theme include chains', () => {
      const parentTheme = themeJson({
        tokenColors: [
          { scope: 'string', settings: { foreground: '#parent-string' } },
          { scope: 'constant.numeric', settings: { foreground: '#parent-number' } }
        ]
      });

      const childTheme = themeJson({
        include: './base.json',
        tokenColors: [{ scope: 'string', settings: { foreground: '#child-string' } }]
      });

      mockFs.readFileSync.mockImplementation((filePath: any) => {
        if (String(filePath).includes('base.json')) {
          return parentTheme as any;
        }
        return childTheme as any;
      });

      const result = getJsonTokenColors();
      expect(result.string).toBe('#child-string');
      expect(result.number).toBe('#parent-number');
    });

    it('matches theme by label', () => {
      setupThemeExtension('My Theme Label', './theme.json', 'label');

      mockFs.readFileSync.mockReturnValue(
        themeJson({
          tokenColors: [{ scope: 'string', settings: { foreground: '#abc' } }]
        }) as any
      );

      expect(getJsonTokenColors().string).toBe('#abc');
    });

    it('matches theme by id', () => {
      setupThemeExtension('my-theme-id', './theme.json', 'id');

      mockFs.readFileSync.mockReturnValue(
        themeJson({
          tokenColors: [{ scope: 'string', settings: { foreground: '#def' } }]
        }) as any
      );

      expect(getJsonTokenColors().string).toBe('#def');
    });
  });

  describe('JSONC comment stripping', () => {
    it('handles single-line comments', () => {
      mockFs.readFileSync.mockReturnValue(
        ('{\n' +
          '  // This is a comment\n' +
          '  "tokenColors": [\n' +
          '    {\n' +
          '      "scope": "string", // inline comment\n' +
          '      "settings": { "foreground": "#aaa" }\n' +
          '    }\n' +
          '  ]\n' +
          '}') as any
      );

      expect(getJsonTokenColors().string).toBe('#aaa');
    });

    it('handles multi-line comments', () => {
      mockFs.readFileSync.mockReturnValue(
        ('{\n' +
          '  /* multi\n' +
          '     line\n' +
          '     comment */\n' +
          '  "tokenColors": [\n' +
          '    {\n' +
          '      "scope": "string",\n' +
          '      "settings": { "foreground": "#bbb" }\n' +
          '    }\n' +
          '  ]\n' +
          '}') as any
      );

      expect(getJsonTokenColors().string).toBe('#bbb');
    });

    it('preserves // inside string values (e.g. URLs)', () => {
      mockFs.readFileSync.mockReturnValue(
        ('{\n' +
          '  "name": "Theme with https://example.com url",\n' +
          '  "tokenColors": [\n' +
          '    {\n' +
          '      "scope": "string",\n' +
          '      "settings": { "foreground": "#ccc" }\n' +
          '    }\n' +
          '  ]\n' +
          '}') as any
      );

      expect(getJsonTokenColors().string).toBe('#ccc');
    });

    it('handles trailing commas', () => {
      mockFs.readFileSync.mockReturnValue(
        ('{\n' +
          '  "tokenColors": [\n' +
          '    {\n' +
          '      "scope": "string",\n' +
          '      "settings": { "foreground": "#ddd" },\n' +
          '    },\n' +
          '  ]\n' +
          '}') as any
      );

      expect(getJsonTokenColors().string).toBe('#ddd');
    });
  });

  describe('semantic token colors', () => {
    it('prefers semantic colors when semanticHighlighting is enabled', () => {
      mockFs.readFileSync.mockReturnValue(
        themeJson({
          semanticHighlighting: true,
          semanticTokenColors: {
            property: '#semantic-key',
            string: '#semantic-string',
            number: '#semantic-number',
            keyword: '#semantic-keyword'
          },
          tokenColors: [
            { scope: 'support.type.property-name.json', settings: { foreground: '#tm-key' } },
            { scope: 'string', settings: { foreground: '#tm-string' } }
          ]
        }) as any
      );

      const result = getJsonTokenColors();
      expect(result.key).toBe('#semantic-key');
      expect(result.string).toBe('#semantic-string');
      expect(result.number).toBe('#semantic-number');
      expect(result.boolean).toBe('#semantic-keyword');
      expect(result.null).toBe('#semantic-keyword');
    });

    it('falls back to TextMate colors when semanticHighlighting is disabled', () => {
      mockFs.readFileSync.mockReturnValue(
        themeJson({
          semanticHighlighting: false,
          semanticTokenColors: { property: '#semantic-key' },
          tokenColors: [
            { scope: 'support.type.property-name.json', settings: { foreground: '#tm-key' } }
          ]
        }) as any
      );

      expect(getJsonTokenColors().key).toBe('#tm-key');
    });

    it('falls back to TextMate when semantic color is missing for a token', () => {
      mockFs.readFileSync.mockReturnValue(
        themeJson({
          semanticHighlighting: true,
          semanticTokenColors: { property: '#semantic-key' },
          tokenColors: [{ scope: 'string', settings: { foreground: '#tm-string' } }]
        }) as any
      );

      const result = getJsonTokenColors();
      expect(result.key).toBe('#semantic-key');
      expect(result.string).toBe('#tm-string');
    });

    it('handles semantic color as object with foreground', () => {
      mockFs.readFileSync.mockReturnValue(
        themeJson({
          semanticHighlighting: true,
          semanticTokenColors: {
            property: { foreground: '#obj-key', fontStyle: 'bold' }
          },
          tokenColors: []
        }) as any
      );

      expect(getJsonTokenColors().key).toBe('#obj-key');
    });

    it('prefers language-specific semantic selectors', () => {
      mockFs.readFileSync.mockReturnValue(
        themeJson({
          semanticHighlighting: true,
          semanticTokenColors: {
            property: '#generic',
            'property:json': '#json-specific'
          },
          tokenColors: []
        }) as any
      );

      expect(getJsonTokenColors().key).toBe('#json-specific');
    });
  });

  describe('error handling', () => {
    it('returns empty object when theme file cannot be read', () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      expect(getJsonTokenColors()).toEqual({});
    });

    it('returns empty object when theme file contains invalid JSON', () => {
      mockFs.readFileSync.mockReturnValue('not valid json {{{' as any);

      expect(getJsonTokenColors()).toEqual({});
    });

    it('handles circular include references without infinite loop', () => {
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        const p = String(filePath);
        if (p.includes('dark.json')) {
          return themeJson({
            include: './other.json',
            tokenColors: [{ scope: 'string', settings: { foreground: '#aaa' } }]
          }) as any;
        }
        return themeJson({
          include: './themes/dark.json',
          tokenColors: []
        }) as any;
      });

      const result = getJsonTokenColors();
      expect(result.string).toBe('#aaa');
    });
  });
});
