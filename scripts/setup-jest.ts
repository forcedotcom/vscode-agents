/**
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/
import { MockPosition } from './MockPosition';

class EventEmitter {
  private listeners: any[] = [];
  constructor() {}
  public event = (listener: any) => this.listeners.push(listener);
  public dispose = jest.fn();
  public fire = (e: any) => this.listeners.forEach(listener => listener(e));
}

//TODO: parse this down to just what we need right now
const getMockVSCode = () => {
  return {
    InlineCompletionTriggerKind: {
      Invoke: 0,
      Automatic: 1
    },
    TreeItemCollapsibleState: {
      None: 0,
      Collapsed: 1,
      Expanded: 2
    },
    CancellationTokenSource: class {
      public listeners: any[] = [];
      public token = {
        isCancellationRequested: false,
        onCancellationRequested: (listener: any) => {
          this.listeners.push(listener);
          return {
            dispose: () => {
              this.listeners = [];
            }
          };
        }
      };
      public cancel = () => {
        this.listeners.forEach(listener => {
          listener.call();
        });
      };
      public dispose = () => {};
    },
    CodeLens: jest.fn(),
    TreeItem: jest.fn(),
    commands: {
      getCommands: jest.fn(),
      executeCommand: jest.fn(),
      registerCommand: jest.fn(),
      registerTextEditorCommand: jest.fn()
    },
    Disposable: jest.fn(),
    env: {
      machineId: '12345534',
      clipboard: {
        readText: jest.fn(),
        writeText: jest.fn()
      },
      openExternal: jest.fn()
    },
    EventEmitter,
    ExtensionMode: { Production: 1, Development: 2, Test: 3 },
    extensions: {
      getExtension: jest.fn(() => ({
        extensionUri: { fsPath: '/fake/path/to/extension' }
      })),
      all: [{ id: 'salesforce.salesforcedx-vscode-agents' }]
    },
    FileType: {
      File: 1,
      Directory: 2,
      SymbolicLink: 64
    },
    languages: {
      createDiagnosticCollection: jest.fn(),
      getDiagnostics: jest.fn(),
      registerCodeLensProvider: jest.fn(),
      registerInlineCompletionItemProvider: jest.fn(() => {
        return {};
      })
    },
    ThemeColor: jest.fn(),
    Uri: {
      parse: jest.fn(),
      file: jest.fn(),
      joinPath: jest.fn()
    },
    Position: jest.fn((line, character) => {
      return new MockPosition(line, character);
    }),
    ProgressLocation: {
      SourceControl: 1,
      Window: 10,
      Notification: 15
    },
    Range: jest.fn(),
    SnippetString: jest.fn(),
    StatusBarAlignment: {
      Left: 1,
      Right: 2
    },
    SymbolKind: {
      Class: 4,
      Method: 5,
      Property: 6,
      Constructor: 8,
      Enum: 9,
      Interface: 10
    },
    window: {
      activeTextEditor: {
        selection: {
          active: 'cursor-position'
        },
        document: {
          getText: jest.fn(),
          lineAt: jest.fn(),
          uri: { scheme: 'file' },
          fileName: '/some/path/to/file.ext'
        }
      },
      showInformationMessage: jest.fn(),
      showWarningMessage: jest.fn(),
      showErrorMessage: jest.fn(),
      showInputBox: jest.fn(),
      showQuickPick: jest.fn(),
      setStatusBarMessage: jest.fn(),
      withProgress: jest.fn(),
      createOutputChannel: jest.fn(),
      showSaveDialog: jest.fn(),
      OutputChannel: {
        show: jest.fn()
      },
      createStatusBarItem: jest.fn(),
      registerWebviewViewProvider: jest.fn(),
      onDidChangeTextEditorSelection: jest.fn(),
      onDidChangeActiveTextEditor: jest.fn(),
      createTextEditorDecorationType: jest.fn()
    },
    workspace: {
      applyEdit: jest.fn(),
      getConfiguration: () => {
        return {
          get: jest.fn(),
          update: jest.fn()
        };
      },
      onDidChangeConfiguration: jest.fn(),
      onDidChangeTextDocument: jest.fn(),
      createFileSystemWatcher: () => {
        return {
          onDidChange: jest.fn(),
          onDidCreate: jest.fn(),
          onDidDelete: jest.fn()
        };
      },
      workspaceFolders: [{ uri: { path: '/some/path' } }],
      fs: {
        createDirectory: jest.fn(),
        readDirectory: jest.fn(),
        writeFile: jest.fn(),
        readFile: jest.fn(),
        delete: jest.fn(),
        stat: jest.fn()
      },
      findFiles: jest.fn(),
      openTextDocument: jest.fn()
    },
    l10n: {
      t: jest.fn()
    },
    OverviewRulerLane: jest.fn(),
    QuickPickItemKind: { Separator: jest.fn() },
    WorkspaceEdit: jest.fn(),
    WorkspaceConfiguration: jest.fn(),
    RelativePattern: jest.fn()
  };
};

const getMockWebviewApi = () => {
  return {
    postMessage: jest.fn(),
    getState: jest.fn(),
    setState: jest.fn()
  };
};

jest.mock(
  'vscode',
  () => {
    const vscodeMock = getMockVSCode();
    vscodeMock.extensions.getExtension = jest.fn(() => ({
      extensionUri: { fsPath: '/fake/path/to/extension' }
    }));
    return vscodeMock;
  },
  { virtual: true }
);

const mockWebApi = getMockWebviewApi();

// Mock the global function supplied to web views
// @ts-ignore
global.acquireVsCodeApi = () => mockWebApi;

jest.mock(
  'vscode-webview',
  () => {
    return mockWebApi;
  },
  { virtual: true }
);
