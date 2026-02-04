import * as vscode from 'vscode';
import { AgentSource, PreviewableAgent, ProductionAgent, ScriptAgent } from '@salesforce/agents';
import type { AgentInstance } from '../types';

/**
 * Manages all state for the Agent Combined View Provider
 */
export class AgentViewState {
  // Agent instance state
  private _agentInstance?: AgentInstance;
  private _sessionId: string = '';
  private _sessionAgentId?: string; // Tracks which agent the current session belongs to
  private _currentAgentName?: string;
  private _currentAgentId?: string;
  private _currentAgentSource?: AgentSource;
  private _currentPlanId?: string;
  private _currentUserMessage?: string;

  // Session state
  private _isSessionActive = false;
  private _isSessionStarting = false;
  private _sessionStartOperationId = 0;
  private _pendingStartAgentId?: string;
  private _pendingStartAgentSource?: AgentSource;
  private _pendingSelectAgentId?: string;

  // Mode state
  private _isApexDebuggingEnabled = false;
  private _isLiveMode = false;

  // Storage keys
  private static readonly LIVE_MODE_KEY = 'agentforceDX.lastLiveMode';
  private static readonly DEBUG_MODE_KEY = 'agentforceDX.lastDebugMode';
  private static readonly EXPORT_DIR_KEY = 'agentforceDX.lastExportDirectory';

  constructor(private readonly context: vscode.ExtensionContext) {
    // Load persisted state
    this._isLiveMode = this.context.globalState.get<boolean>(AgentViewState.LIVE_MODE_KEY, false);
    this._isApexDebuggingEnabled = this.context.globalState.get<boolean>(
      AgentViewState.DEBUG_MODE_KEY,
      false
    );

    // Set initial context
    void vscode.commands.executeCommand('setContext', 'agentforceDX:debugMode', this._isApexDebuggingEnabled);
    void vscode.commands.executeCommand('setContext', 'agentforceDX:isScriptAgent', false);
  }

  // Getters
  get agentInstance(): AgentInstance | undefined {
    return this._agentInstance;
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get sessionAgentId(): string | undefined {
    return this._sessionAgentId;
  }

  get currentAgentName(): string | undefined {
    return this._currentAgentName;
  }

  get currentAgentId(): string | undefined {
    return this._currentAgentId;
  }

  get currentAgentSource(): AgentSource | undefined {
    return this._currentAgentSource;
  }

  get currentPlanId(): string | undefined {
    return this._currentPlanId;
  }

  get currentUserMessage(): string | undefined {
    return this._currentUserMessage;
  }

  get isSessionActive(): boolean {
    return this._isSessionActive;
  }

  get isSessionStarting(): boolean {
    return this._isSessionStarting;
  }

  get sessionStartOperationId(): number {
    return this._sessionStartOperationId;
  }

  get pendingStartAgentId(): string | undefined {
    return this._pendingStartAgentId;
  }

  get pendingStartAgentSource(): AgentSource | undefined {
    return this._pendingStartAgentSource;
  }

  get pendingSelectAgentId(): string | undefined {
    return this._pendingSelectAgentId;
  }

  get isApexDebuggingEnabled(): boolean {
    return this._isApexDebuggingEnabled;
  }

  get isLiveMode(): boolean {
    return this._isLiveMode;
  }

  // Setters
  set agentInstance(value: AgentInstance | undefined) {
    this._agentInstance = value;
  }

  set sessionId(value: string) {
    this._sessionId = value;
  }

  set sessionAgentId(value: string | undefined) {
    this._sessionAgentId = value;
  }

  set currentAgentName(value: string | undefined) {
    this._currentAgentName = value;
  }

  set currentAgentId(value: string | undefined) {
    this._currentAgentId = value;
  }

  set currentAgentSource(value: AgentSource | undefined) {
    this._currentAgentSource = value;
    // Update context for script agent detection (used for restart menu visibility)
    void this.setIsScriptAgent(value === AgentSource.SCRIPT);
  }

  set currentPlanId(value: string | undefined) {
    this._currentPlanId = value;
  }

  set currentUserMessage(value: string | undefined) {
    this._currentUserMessage = value;
  }

  set pendingStartAgentId(value: string | undefined) {
    this._pendingStartAgentId = value;
  }

  set pendingStartAgentSource(value: AgentSource | undefined) {
    this._pendingStartAgentSource = value;
  }

  set pendingSelectAgentId(value: string | undefined) {
    this._pendingSelectAgentId = value;
  }

  // State update methods
  async setSessionActive(active: boolean): Promise<void> {
    this._isSessionActive = active;
    await vscode.commands.executeCommand('setContext', 'agentforceDX:sessionActive', active);
  }

  async setSessionStarting(starting: boolean): Promise<void> {
    this._isSessionStarting = starting;
    await vscode.commands.executeCommand('setContext', 'agentforceDX:sessionStarting', starting);
  }

  beginSessionStart(): number {
    return ++this._sessionStartOperationId;
  }

  isSessionStartActive(startId: number): boolean {
    return this._sessionStartOperationId === startId;
  }

  cancelPendingSessionStart(): void {
    this._sessionStartOperationId += 1;
  }

  async setAgentSelected(selected: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'agentforceDX:agentSelected', selected);
    if (!selected) {
      await this.setResetAgentViewAvailable(false);
      await this.setSessionErrorState(false);
      await this.setConversationDataAvailable(false);
      await this.setIsScriptAgent(false);
    }
  }

  async setDebugMode(enabled: boolean): Promise<void> {
    this._isApexDebuggingEnabled = enabled;
    await vscode.commands.executeCommand('setContext', 'agentforceDX:debugMode', enabled);
    await this.context.globalState.update(AgentViewState.DEBUG_MODE_KEY, enabled);
  }

  async setLiveMode(isLive: boolean): Promise<void> {
    this._isLiveMode = isLive;
    await vscode.commands.executeCommand('setContext', 'agentforceDX:isLiveMode', isLive);
    await this.context.globalState.update(AgentViewState.LIVE_MODE_KEY, isLive);
  }

  async setResetAgentViewAvailable(available: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'agentforceDX:canResetAgentView', available);
  }

  async setSessionErrorState(hasError: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'agentforceDX:sessionError', hasError);
  }

  async setConversationDataAvailable(available: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'agentforceDX:hasConversationData', available);
  }

  async setIsScriptAgent(isScript: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'agentforceDX:isScriptAgent', isScript);
  }

  async setHasAgents(hasAgents: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'agentforceDX:hasAgents', hasAgents);
  }

  // Export directory persistence (per-project using workspaceState)
  getExportDirectory(): string | undefined {
    return this.context.workspaceState.get<string>(AgentViewState.EXPORT_DIR_KEY);
  }

  async setExportDirectory(directory: string): Promise<void> {
    await this.context.workspaceState.update(AgentViewState.EXPORT_DIR_KEY, directory);
  }

  // Clear session state
  clearSessionState(): void {
    this._agentInstance = undefined;
    this._sessionId = Date.now().toString();
    this._sessionAgentId = undefined;
    this._currentAgentName = undefined;
    this._currentPlanId = undefined;
    this._currentUserMessage = undefined;
    this._pendingStartAgentId = undefined;
    this._pendingStartAgentSource = undefined;
    this._pendingSelectAgentId = undefined;
  }
}
