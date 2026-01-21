import { AgentSource } from '@salesforce/agents';
import { getAllHistory } from '@salesforce/agents/lib/utils';
import type { TraceHistoryEntry } from '../../../utils/traceHistory';
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
   * Uses agent instance if available, otherwise uses getAllHistory from library
   */
  async loadAndSendConversationHistory(agentId: string, agentSource: AgentSource): Promise<boolean> {
    try {
      let transcriptEntries;

      // Try to use agent instance if available
      if (this.state.agentInstance && this.state.sessionId) {
        const history = await this.state.agentInstance.getHistoryFromDisc(this.state.sessionId);
        transcriptEntries = history.transcript || [];
      } else {
        // Use getAllHistory from library when no active session
        const agentStorageKey = getAgentStorageKey(agentId, agentSource);
        const history = await getAllHistory(agentStorageKey, undefined);
        transcriptEntries = history.transcript || [];
      }

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
   * Uses agent instance getHistoryFromDisc if available, otherwise uses getAllHistory from library
   */
  async loadAndSendTraceHistory(agentId: string, agentSource: AgentSource): Promise<void> {
    try {
      let history;
      let sessionId: string | undefined;

      // Use agent instance if available
      if (this.state.agentInstance && this.state.sessionId) {
        history = await this.state.agentInstance.getHistoryFromDisc(this.state.sessionId);
        sessionId = this.state.sessionId;
      } else {
        // Use getAllHistory from library when no active session
        const agentStorageKey = getAgentStorageKey(agentId, agentSource);
        history = await getAllHistory(agentStorageKey, undefined);
        // When using getAllHistory with undefined sessionId, we get all sessions
        // Extract sessionId from the most recent trace if available
        if (history.traces && history.traces.length > 0) {
          const mostRecentTrace = history.traces[history.traces.length - 1];
          sessionId = (mostRecentTrace as any).sessionId;
        }
      }

      const traces = history.traces || [];

      // Convert traces to TraceHistoryEntry format
      const agentStorageKey = getAgentStorageKey(agentId, agentSource);
      const entries: TraceHistoryEntry[] = traces.map((trace, index) => {
        const planId = (trace as any).planId || `plan-${index}`;
        const traceSessionId = (trace as any).sessionId || sessionId || 'unknown';
        const userMessage = this.extractUserMessageFromTrace(trace);
        
        return {
          storageKey: agentStorageKey,
          agentId: agentId,
          sessionId: traceSessionId,
          planId: planId,
          userMessage: userMessage,
          timestamp: history.metadata?.startTime || new Date().toISOString(),
          trace: trace
        };
      });

      // Send trace history to populate the history list
      this.messageSender.sendTraceHistory(agentId, entries);

      // If we have entries and a current planId, also send the current trace data
      if (entries.length > 0 && this.state.currentPlanId) {
        const currentEntry = entries.find(entry => entry.planId === this.state.currentPlanId);
        if (currentEntry) {
          this.messageSender.sendTraceData(currentEntry.trace);
        } else {
          // If no exact match, send the latest entry
          const latestEntry = entries[entries.length - 1];
          this.messageSender.sendTraceData(latestEntry.trace);
        }
      } else if (entries.length > 0) {
        // If no current planId but we have entries, send the latest
        const latestEntry = entries[entries.length - 1];
        this.messageSender.sendTraceData(latestEntry.trace);
      }
    } catch (error) {
      console.error('Could not load trace history:', error);
      this.messageSender.sendTraceHistory(agentId, []);
    }
  }

  /**
   * Opens a trace JSON entry in the editor
   * Creates a virtual document instead of saving to disk
   */
  async openTraceJsonEntry(entryData: TraceHistoryEntry | undefined): Promise<void> {
    if (!entryData || typeof entryData !== 'object' || !entryData.trace) {
      vscode.window.showErrorMessage('Unable to open trace JSON: Missing trace details.');
      return;
    }

    try {
      // Create a virtual document URI instead of saving to disk
      const traceJson = JSON.stringify(entryData.trace, null, 2);
      const uri = vscode.Uri.parse(`untitled:${entryData.planId || 'trace'}.json`);
      const document = await vscode.workspace.openTextDocument(uri);
      const edit = new vscode.WorkspaceEdit();
      edit.insert(uri, new vscode.Position(0, 0), traceJson);
      await vscode.workspace.applyEdit(edit);
      await vscode.window.showTextDocument(document, { preview: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Unable to open trace JSON: ${errorMessage}`);
      console.error('Unable to open trace JSON:', error);
    }
  }

  /**
   * Shows history or placeholder for an agent
   * Uses atomic setConversation message to avoid visual blink
   */
  async showHistoryOrPlaceholder(agentId: string, agentSource: AgentSource): Promise<void> {
    try {
      // Load history data first
      const traceHistoryPromise = this.loadTraceHistoryData(agentId, agentSource);
      const conversationHistoryPromise = this.loadConversationHistoryData(agentId, agentSource);

      // Wait for both to complete
      const [traceEntries, transcriptEntries] = await Promise.all([
        traceHistoryPromise,
        conversationHistoryPromise
      ]);

      // Send trace history
      this.messageSender.sendTraceHistory(agentId, traceEntries);

      // Build history messages if available
      let historyMessages: Array<{ id: string; type: string; content: string; timestamp: number }> = [];
      if (transcriptEntries && transcriptEntries.length > 0) {
        historyMessages = transcriptEntries
          .filter(entry => entry.text)
          .map(entry => ({
            id: `${entry.timestamp}-${entry.sessionId}`,
            type: entry.role === 'user' ? 'user' : 'agent',
            content: entry.text || '',
            timestamp: new Date(entry.timestamp).getTime()
          }));
      }

      const hasHistory = historyMessages.length > 0;
      await this.state.setConversationDataAvailable(hasHistory);

      // Send atomic setConversation message - this replaces clearMessages + conversationHistory
      // showPlaceholder is true when there's no history to display
      this.messageSender.sendSetConversation(historyMessages, !hasHistory);

      // Send trace data if we have entries
      if (traceEntries.length > 0) {
        if (this.state.currentPlanId) {
          const currentEntry = traceEntries.find(entry => entry.planId === this.state.currentPlanId);
          if (currentEntry) {
            this.messageSender.sendTraceData(currentEntry.trace);
          } else {
            const latestEntry = traceEntries[traceEntries.length - 1];
            this.messageSender.sendTraceData(latestEntry.trace);
          }
        } else {
          const latestEntry = traceEntries[traceEntries.length - 1];
          this.messageSender.sendTraceData(latestEntry.trace);
        }
      }
    } catch (err) {
      console.error('Error loading history:', err);
      await this.state.setConversationDataAvailable(false);
      // Send atomic message with empty history and show placeholder
      this.messageSender.sendSetConversation([], true);
    }
  }

  /**
   * Loads trace history data without sending to webview
   */
  private async loadTraceHistoryData(agentId: string, agentSource: AgentSource): Promise<TraceHistoryEntry[]> {
    try {
      let history;
      let sessionId: string | undefined;

      // Use agent instance if available
      if (this.state.agentInstance && this.state.sessionId) {
        history = await this.state.agentInstance.getHistoryFromDisc(this.state.sessionId);
        sessionId = this.state.sessionId;
      } else {
        // Use getAllHistory from library when no active session
        const agentStorageKey = getAgentStorageKey(agentId, agentSource);
        history = await getAllHistory(agentStorageKey, undefined);
        // When using getAllHistory with undefined sessionId, we get all sessions
        // Extract sessionId from the most recent trace if available
        if (history.traces && history.traces.length > 0) {
          const mostRecentTrace = history.traces[history.traces.length - 1];
          sessionId = (mostRecentTrace as any).sessionId;
        }
      }

      const traces = history.traces || [];
      const agentStorageKey = getAgentStorageKey(agentId, agentSource);
      
      return traces.map((trace, index) => {
        const planId = (trace as any).planId || `plan-${index}`;
        const traceSessionId = (trace as any).sessionId || sessionId || 'unknown';
        const userMessage = this.extractUserMessageFromTrace(trace);
        
        return {
          storageKey: agentStorageKey,
          agentId: agentId,
          sessionId: traceSessionId,
          planId: planId,
          userMessage: userMessage,
          timestamp: history.metadata?.startTime || new Date().toISOString(),
          trace: trace
        };
      });
    } catch (error) {
      console.error('Could not load trace history:', error);
      return [];
    }
  }

  /**
   * Loads conversation history data without sending to webview
   */
  private async loadConversationHistoryData(agentId: string, agentSource: AgentSource): Promise<any[]> {
    try {
      let transcriptEntries;

      // Try to use agent instance if available
      if (this.state.agentInstance && this.state.sessionId) {
        const history = await this.state.agentInstance.getHistoryFromDisc(this.state.sessionId);
        transcriptEntries = history.transcript || [];
      } else {
        // Use getAllHistory from library when no active session
        const agentStorageKey = getAgentStorageKey(agentId, agentSource);
        const history = await getAllHistory(agentStorageKey, undefined);
        transcriptEntries = history.transcript || [];
      }

      return transcriptEntries || [];
    } catch (err) {
      console.error('Could not load conversation history:', err);
      return [];
    }
  }
}
