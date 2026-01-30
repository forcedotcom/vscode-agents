import { AgentSource } from '@salesforce/agents';
import { getAllHistory } from '@salesforce/agents/lib/utils';
import { SfProject } from '@salesforce/core';
import type { TraceHistoryEntry } from '../../../utils/traceHistory';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
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
      const transcriptEntries = await this.loadConversationHistoryData(agentId, agentSource);

      if (transcriptEntries.length > 0) {
        const historyMessages = this.convertTranscriptToMessages(transcriptEntries);

        if (historyMessages.length > 0) {
          this.messageSender.sendConversationHistory(historyMessages);
          await this.state.setConversationDataAvailable(true);
          return true;
        }
      }
    } catch (err) {
      console.error('Could not load conversation history:', err);
    }

    await this.state.setConversationDataAvailable(false);
    return false;
  }

  /**
   * Converts transcript entries to message format, sorted chronologically
   */
  private convertTranscriptToMessages(
    transcriptEntries: Array<{ text?: string; timestamp: string; sessionId: string; role: string }>
  ): Array<{ id: string; type: string; content: string; timestamp: number }> {
    return transcriptEntries
      .filter(entry => entry.text)
      .map(entry => ({
        id: `${entry.timestamp}-${entry.sessionId}`,
        type: entry.role === 'user' ? 'user' : 'agent',
        content: entry.text || '',
        timestamp: new Date(entry.timestamp).getTime()
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Extracts the start time from a trace's UserInputStep for sorting
   */
  private getTraceStartTime(trace: unknown): number {
    try {
      const traceObj = trace as { plan?: Array<{ type?: string; startExecutionTime?: number }> };
      if (traceObj?.plan && Array.isArray(traceObj.plan)) {
        const userInputStep = traceObj.plan.find(step => step.type === 'UserInputStep');
        if (userInputStep?.startExecutionTime) {
          return userInputStep.startExecutionTime;
        }
      }
    } catch (error) {
      // Fall through to default
    }
    return Number.MAX_SAFE_INTEGER; // Put traces without timestamps at the end
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
   */
  async loadAndSendTraceHistory(agentId: string, agentSource: AgentSource): Promise<void> {
    try {
      const entries = await this.loadTraceHistoryData(agentId, agentSource);

      // Send trace history to populate the history list
      this.messageSender.sendTraceHistory(agentId, entries);

      // Send current or latest trace data
      if (entries.length > 0) {
        const currentEntry = this.state.currentPlanId
          ? entries.find(entry => entry.planId === this.state.currentPlanId)
          : undefined;
        const entryToSend = currentEntry || entries[entries.length - 1];
        this.messageSender.sendTraceData(entryToSend.trace);
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
      // Load both histories in parallel
      const [traceEntries, transcriptEntries] = await Promise.all([
        this.loadTraceHistoryData(agentId, agentSource),
        this.loadConversationHistoryData(agentId, agentSource)
      ]);

      // Send trace history
      this.messageSender.sendTraceHistory(agentId, traceEntries);

      // Convert and send conversation history
      const historyMessages = this.convertTranscriptToMessages(transcriptEntries);
      const hasHistory = historyMessages.length > 0;
      await this.state.setConversationDataAvailable(hasHistory);
      this.messageSender.sendSetConversation(historyMessages, !hasHistory);

      // Send current or latest trace data
      if (traceEntries.length > 0) {
        const currentEntry = this.state.currentPlanId
          ? traceEntries.find(entry => entry.planId === this.state.currentPlanId)
          : undefined;
        const entryToSend = currentEntry || traceEntries[traceEntries.length - 1];
        this.messageSender.sendTraceData(entryToSend.trace);
      }
    } catch (err) {
      console.error('Error loading history:', err);
      await this.state.setConversationDataAvailable(false);
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

      // Use agent instance if available AND the session belongs to the requested agent
      // This prevents loading wrong history when switching agents while a session is active
      if (this.state.agentInstance && this.state.sessionId && this.state.sessionAgentId === agentId) {
        history = await this.state.agentInstance.getHistoryFromDisc(this.state.sessionId);
        sessionId = this.state.sessionId;
      } else {
        // Use getAllHistory from library when no active session or session belongs to different agent
        const agentStorageKey = getAgentStorageKey(agentId, agentSource);
        history = await getAllHistory(agentStorageKey, undefined);
        // When using getAllHistory with undefined sessionId, we get all sessions
        // Extract sessionId from the most recent trace if available
        if (history.traces && history.traces.length > 0) {
          const mostRecentTrace = history.traces[history.traces.length - 1];
          sessionId = (mostRecentTrace as any).sessionId;
        }
      }

      // Sort traces by startExecutionTime from UserInputStep (oldest first)
      const sortedTraces = [...(history.traces || [])].sort((a, b) => {
        const timeA = this.getTraceStartTime(a);
        const timeB = this.getTraceStartTime(b);
        return timeA - timeB;
      });

      const agentStorageKey = getAgentStorageKey(agentId, agentSource);
      const entries = sortedTraces.map((trace, index) => {
        const planId = (trace as any).planId || `plan-${index}`;
        const traceSessionId = (trace as any).sessionId || sessionId || 'unknown';
        const userMessage = this.extractUserMessageFromTrace(trace);

        return {
          storageKey: agentStorageKey,
          agentId: agentId,
          sessionId: traceSessionId,
          planId: planId,
          userMessage: userMessage,
          timestamp: new Date().toISOString(),
          trace: trace
        };
      });

      return entries;
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

      // Try to use agent instance if available AND the session belongs to the requested agent
      // This prevents loading wrong history when switching agents while a session is active
      if (this.state.agentInstance && this.state.sessionId && this.state.sessionAgentId === agentId) {
        const history = await this.state.agentInstance.getHistoryFromDisc(this.state.sessionId);
        transcriptEntries = history.transcript || [];
      } else {
        // Use getAllHistory from library when no active session or session belongs to different agent
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

  /**
   * Clears all history for a specific agent by deleting its history directory
   */
  async clearHistory(agentId: string, agentSource: AgentSource): Promise<void> {
    const agentStorageKey = getAgentStorageKey(agentId, agentSource);

    // History is stored in <project>/.sfdx/agents/<agentStorageKey>/
    // This matches where the @salesforce/agents library stores history
    const project = SfProject.getInstance();
    const projectPath = project.getPath();
    const agentHistoryDir = path.join(projectPath, '.sfdx', 'agents', agentStorageKey);

    // Delete the directory if it exists (force: true handles non-existent dirs)
    await fs.promises.rm(agentHistoryDir, { recursive: true, force: true });

    // Update state to reflect no conversation data
    await this.state.setConversationDataAvailable(false);
    await this.state.setResetAgentViewAvailable(false);

    // Atomically clear messages and show placeholder (the default "nothing yet" state)
    this.messageSender.sendSetConversation([], true);

    // Send empty trace history
    this.messageSender.sendTraceHistory(agentId, []);
  }
}
