import * as vscode from 'vscode';
import type { AgentViewState } from '../state/agentViewState';

/**
 * Handles conversation export functionality
 */
export class ConversationExporter {
  constructor(private readonly state: AgentViewState, private readonly context: vscode.ExtensionContext) {}

  /**
   * Sanitizes a file name by removing invalid characters
   */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Saves conversation export to a file
   */
  async saveConversationExport(content: string, suggestedFileName?: string): Promise<void> {
    if (!content || content.trim() === '') {
      vscode.window.showWarningMessage('No conversation data available to export.');
      return;
    }

    const fallbackBase = this.sanitizeFileName(this.state.currentAgentName || 'agent') || 'agent';
    const timestamp = new Date().toISOString().replace(/[:]/g, '-');
    const suggestedBase =
      suggestedFileName && suggestedFileName.trim() !== ''
        ? this.sanitizeFileName(suggestedFileName.replace(/\.md$/i, ''))
        : undefined;
    const defaultNameBase =
      suggestedBase && suggestedBase.length > 0 ? suggestedBase : `${fallbackBase}-conversation-${timestamp}`;
    const defaultName = defaultNameBase.endsWith('.md') ? defaultNameBase : `${defaultNameBase}.md`;

    const defaultFolder = vscode.workspace.workspaceFolders?.[0]?.uri ?? this.context.globalStorageUri;
    const defaultUri = defaultFolder ? vscode.Uri.joinPath(defaultFolder, defaultName) : undefined;

    const targetUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: {
        Markdown: ['md'],
        Text: ['txt']
      },
      saveLabel: 'Save Conversation'
    });

    if (!targetUri) {
      return;
    }

    const encoder = new TextEncoder();
    try {
      await vscode.workspace.fs.writeFile(targetUri, encoder.encode(content));
      vscode.window.showInformationMessage(`Conversation was saved to ${targetUri.fsPath}.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to save conversation: ${errorMessage}`);
    }
  }
}
