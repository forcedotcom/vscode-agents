import { AgentSource, readTranscriptEntries } from '@salesforce/agents';
import { readTraceHistoryEntries, type TraceHistoryEntry, writeTraceEntryToFile } from '../../../utils/traceHistory';
import * as vscode from 'vscode';
import type { AgentViewState } from '../state/agentViewState';
import type { WebviewMessageSender } from '../handlers/webviewMessageSender';
import { getAgentStorageKey } from '../agent/agentUtils';

/**
 * Manages conversation and trace history
 */
export class HistoryManager {
  constructor(
    private readonly state: AgentViewState,
    private readonly messageSender: WebviewMessageSender
  ) {}

  /**
   * Load conversation history for an agent and send it to the webview
   */
  async loadAndSendConversationHistory(agentId: string, agentSource: AgentSource): Promise<boolean> {
    try {
      const agentName = getAgentStorageKey(agentId, agentSource);
      const transcriptEntries = await readTranscriptEntries(agentName);

      if (transcriptEntries && transcriptEntries.length > 0) {
        const historyMessages = transcriptEntries
          .filter(entry => entry.text)
          .map(entry => ({
            id: `${entry.timestamp}-${entry.sessionId}`,
            type: entry.role === 'user' ? 'user' : 'agent',
            content: entry.text || '',
            timestamp: new Date(entry.timestamp).getTime()
          }));

        if (historyMessages.length > 0) {
          this.messageSender.sendConversationHistory(historyMessages);
          await this.state.setConversationDataAvailable(true);
          return true;
        }
      }
    } catch (err) {
      console.error('Could not load conversation history:', err);
      if (err instanceof Error) {
        console.error('Error stack:', err.stack);
      }
    }

    await this.state.setConversationDataAvailable(false);
    return false;
  }

  /**
   * Extracts user message from trace data
   */
  private extractUserMessageFromTrace(trace: unknown): string | undefined {
    try {
      // Trace structure: { plan: Array<{ type: string, message?: string, ... }> }
      const traceObj = trace as { plan?: Array<{ type?: string; message?: string; stepType?: string }> };
      if (traceObj?.plan && Array.isArray(traceObj.plan)) {
        // Find the first UserInputStep which contains the user message
        const userInputStep = traceObj.plan.find(
          step => step.type === 'UserInputStep' || step.stepType === 'UserInputStep'
        );
        if (userInputStep?.message) {
          return userInputStep.message;
        }
      }
    } catch (error) {
      console.error('Error extracting user message from trace:', error);
    }
    return undefined;
  }

  /**
   * Load trace history for an agent and send it to the webview
   * Only shows traces from the current session
   */
  async loadAndSendTraceHistory(agentId: string, agentSource: AgentSource): Promise<void> {
    try {
      const agentStorageKey = getAgentStorageKey(agentId, agentSource);
      const allEntries = await readTraceHistoryEntries(agentStorageKey);

      // Filter to only show traces from the current session
      const currentSessionId = this.state.sessionId;
      const entries = currentSessionId
        ? allEntries.filter(entry => entry.sessionId === currentSessionId)
        : [];

      // Extract user messages from trace data if not already set
      const entriesWithMessages = entries.map(entry => {
        if (!entry.userMessage && entry.trace) {
          const userMessage = this.extractUserMessageFromTrace(entry.trace);
          if (userMessage) {
            return { ...entry, userMessage };
          }
        }
        return entry;
      });

      // Send trace history to populate the history list
      this.messageSender.sendTraceHistory(agentId, entriesWithMessages);

      // If we have entries and a current planId, also send the current trace data
      if (entriesWithMessages.length > 0 && this.state.currentPlanId) {
        const currentEntry = entriesWithMessages.find(entry => entry.planId === this.state.currentPlanId);
        if (currentEntry) {
          this.messageSender.sendTraceData(currentEntry.trace);
        } else {
          // If no exact match, send the latest entry
          const latestEntry = entriesWithMessages[entriesWithMessages.length - 1];
          this.messageSender.sendTraceData(latestEntry.trace);
        }
      } else if (entriesWithMessages.length > 0) {
        // If no current planId but we have entries, send the latest
        const latestEntry = entriesWithMessages[entriesWithMessages.length - 1];
        this.messageSender.sendTraceData(latestEntry.trace);
      }
    } catch (error) {
      console.error('Could not load trace history:', error);
      this.messageSender.sendTraceHistory(agentId, []);
    }
  }

  /**
   * Opens a trace JSON entry in the editor
   */
  async openTraceJsonEntry(entryData: TraceHistoryEntry | undefined): Promise<void> {
    if (!entryData || typeof entryData !== 'object' || !entryData.storageKey) {
      vscode.window.showErrorMessage('Unable to open trace JSON: Missing trace details.');
      return;
    }

    try {
      const filePath = await writeTraceEntryToFile(entryData);
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      await vscode.window.showTextDocument(document, { preview: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Unable to open trace JSON: ${errorMessage}`);
      console.error('Unable to open trace JSON file:', error);
    }
  }

  /**
   * Shows history or placeholder for an agent
   */
  async showHistoryOrPlaceholder(agentId: string, agentSource: AgentSource): Promise<void> {
    this.messageSender.sendClearMessages();

    try {
      await this.loadAndSendTraceHistory(agentId, agentSource);
      const hasHistory = await this.loadAndSendConversationHistory(agentId, agentSource);

      if (!hasHistory) {
        this.messageSender.sendNoHistoryFound(agentId);
      }
    } catch (err) {
      console.error('Error loading history:', err);
      await this.state.setConversationDataAvailable(false);
      this.messageSender.sendNoHistoryFound(agentId);
    }
  }
}
