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

import * as vscode from 'vscode';
import { ChannelService } from '../types/ChannelService';

/**
 * Wrapper that uses VS Code's native OutputChannel with TextMate grammar support
 * for syntax highlighting. Creates a single channel with proper formatting.
 */
export class ColoredChannelService implements ChannelService {
  private nativeChannel: vscode.OutputChannel;

  constructor(channelName: string) {
    // Create a native VS Code OutputChannel with language grammar for syntax highlighting
    this.nativeChannel = vscode.window.createOutputChannel(channelName, 'afdx-log');
  }

  getInstance(_channelName: string): ChannelService {
    // Return self for compatibility, but we only use one channel
    return this;
  }

  showCommandWithTimestamp(_commandName: string): void {
    // Not used, but required by interface
  }

  showChannelOutput(): void {
    this.nativeChannel.show(true);
  }

  appendLine(text: string): void {
    this.nativeChannel.appendLine(text);
  }

  clear(): void {
    this.nativeChannel.clear();
  }

  dispose(): void {
    this.nativeChannel.dispose();
  }
}
