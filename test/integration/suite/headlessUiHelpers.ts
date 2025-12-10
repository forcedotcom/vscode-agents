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

/**
 * Headless UI Helpers for NUTs (Non-Unit Tests)
 * 
 * These helpers automatically mock VS Code UI interactions to make tests
 * headless CI/CD friendly. All NUTs should use these helpers to avoid
 * requiring user interaction.
 */

import * as vscode from 'vscode';

export interface ProgressReport {
  message?: string;
  increment?: number;
}

export interface MockedUI {
  restore: () => void;
  inputBoxCalls: () => number;
  quickPickCalls: () => number;
  informationMessageCalls: () => number;
  errorMessageCalls: () => number;
  progressReports: () => ProgressReport[];
  progressTitles: () => string[];
}

/**
 * Mock VS Code UI functions for headless testing
 * Automatically handles showInputBox, showQuickPick, and other UI interactions
 * 
 * @param options Configuration for mocked UI responses
 * @returns Object with restore function and call counters
 */
export function mockHeadlessUI(options: {
  inputBoxResponses?: string[];
  quickPickResponses?: (string | undefined)[];
  informationMessageResponse?: boolean;
  errorMessageResponse?: boolean;
} = {}): MockedUI {
  const {
    inputBoxResponses = [],
    quickPickResponses = [],
    informationMessageResponse = true,
    errorMessageResponse = true
  } = options;

  // Store original functions
  const originalShowInputBox = vscode.window.showInputBox;
  const originalShowQuickPick = vscode.window.showQuickPick;
  const originalShowInformationMessage = vscode.window.showInformationMessage;
  const originalShowErrorMessage = vscode.window.showErrorMessage;
  const originalShowWarningMessage = vscode.window.showWarningMessage;
  const originalWithProgress = vscode.window.withProgress;

  let inputBoxCallCount = 0;
  let quickPickCallCount = 0;
  let informationMessageCallCount = 0;
  let errorMessageCallCount = 0;
  const progressReports: ProgressReport[] = [];
  const progressTitles: string[] = [];

  // Mock showInputBox
  (vscode.window as any).showInputBox = async (
    options?: vscode.InputBoxOptions
  ): Promise<string | undefined> => {
    inputBoxCallCount++;
    const responseIndex = inputBoxCallCount - 1;
    
    if (responseIndex < inputBoxResponses.length) {
      const response = inputBoxResponses[responseIndex];
      console.log(`[Headless UI] showInputBox call #${inputBoxCallCount}: "${options?.prompt || 'no prompt'}" -> returning "${response}"`);
      return response;
    }
    
    console.warn(`[Headless UI] showInputBox call #${inputBoxCallCount}: No response configured, returning undefined`);
    return undefined;
  };

  // Mock showQuickPick
  (vscode.window as any).showQuickPick = async (
    items: readonly string[] | Thenable<readonly string[]>,
    options?: vscode.QuickPickOptions
  ): Promise<string | undefined> => {
    quickPickCallCount++;
    const responseIndex = quickPickCallCount - 1;
    
    // Resolve items if it's a Thenable
    const resolvedItems = items instanceof Promise ? await items : items;
    
    if (responseIndex < quickPickResponses.length) {
      const response = quickPickResponses[responseIndex];
      console.log(`[Headless UI] showQuickPick call #${quickPickCallCount}: "${options?.title || 'no title'}" -> returning "${response}"`);
      
      if (response === undefined) {
        return undefined;
      }
      
      // If response is a string, try to find it in the items
      if (Array.isArray(resolvedItems)) {
        if (resolvedItems.includes(response)) {
          return response;
        }
        // If exact match not found, return first item or the response string
        return resolvedItems[0] || response;
      }
      
      return response;
    }
    
    // Default: return first item if available
    if (Array.isArray(resolvedItems) && resolvedItems.length > 0) {
      console.log(`[Headless UI] showQuickPick call #${quickPickCallCount}: No response configured, returning first item "${resolvedItems[0]}"`);
      return resolvedItems[0];
    }
    
    console.warn(`[Headless UI] showQuickPick call #${quickPickCallCount}: No response configured and no items available`);
    return undefined;
  };

  // Mock showInformationMessage (auto-accept)
  (vscode.window as any).showInformationMessage = async (
    message: string,
    ...items: string[]
  ): Promise<string | undefined> => {
    informationMessageCallCount++;
    console.log(`[Headless UI] showInformationMessage: "${message}"`);
    return informationMessageResponse && items.length > 0 ? items[0] : undefined;
  };

  // Mock showErrorMessage (auto-dismiss)
  (vscode.window as any).showErrorMessage = async (
    message: string,
    ...items: string[]
  ): Promise<string | undefined> => {
    errorMessageCallCount++;
    console.log(`[Headless UI] showErrorMessage: "${message}"`);
    return errorMessageResponse && items.length > 0 ? items[0] : undefined;
  };

  // Mock showWarningMessage (auto-dismiss)
  (vscode.window as any).showWarningMessage = async (
    message: string,
    ...items: string[]
  ): Promise<string | undefined> => {
    console.log(`[Headless UI] showWarningMessage: "${message}"`);
    return items.length > 0 ? items[0] : undefined;
  };

  // Mock withProgress to track progress messages
  (vscode.window as any).withProgress = async <T>(
    options: vscode.ProgressOptions,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Thenable<T>
  ): Promise<T> => {
    progressTitles.push(options.title || '');
    
    const mockProgress: vscode.Progress<{ message?: string; increment?: number }> = {
      report: (value: { message?: string; increment?: number }) => {
        progressReports.push({ message: value.message, increment: value.increment });
      }
    };

    return task(mockProgress);
  };

  // Restore function
  const restore = () => {
    vscode.window.showInputBox = originalShowInputBox;
    vscode.window.showQuickPick = originalShowQuickPick;
    vscode.window.showInformationMessage = originalShowInformationMessage;
    vscode.window.showErrorMessage = originalShowErrorMessage;
    vscode.window.showWarningMessage = originalShowWarningMessage;
    vscode.window.withProgress = originalWithProgress;
    console.log('[Headless UI] Restored original UI functions');
  };

  return {
    restore,
    inputBoxCalls: () => inputBoxCallCount,
    quickPickCalls: () => quickPickCallCount,
    informationMessageCalls: () => informationMessageCallCount,
    errorMessageCalls: () => errorMessageCallCount,
    progressReports: () => [...progressReports],
    progressTitles: () => [...progressTitles]
  };
}

/**
 * Helper to create a simple mock for a single input box call
 */
export function mockSingleInputBox(response: string): MockedUI {
  return mockHeadlessUI({ inputBoxResponses: [response] });
}

/**
 * Helper to create a simple mock for a single quick pick call
 */
export function mockSingleQuickPick(response: string): MockedUI {
  return mockHeadlessUI({ quickPickResponses: [response] });
}

