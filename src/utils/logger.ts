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

import { ChannelService } from '../types/ChannelService';
import { SfError } from '@salesforce/core';

export type LogLevel = 'error' | 'warn' | 'debug';

/**
 * Formats a log message with timestamp and status indicator
 * Format: [HH:MM:SS] [STATUS] message
 */
function formatLogMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const statusMap: Record<LogLevel, string> = {
    error: '[error]',
    warn: '[warn]',
    debug: '[debug]'
  };

  return `[${timestamp}] ${statusMap[level]} ${message}`;
}

/**
 * Logger utility for structured logging with timestamps and status indicators
 */
export class Logger {
  constructor(private readonly channelService: ChannelService) {}

  /**
   * Log an error message with optional stack trace and API response
   * @param message - The error message to log
   * @param error - Optional SfError instance containing error details
   */
  error(message: string, error?: SfError): void {
    this.channelService.appendLine(formatLogMessage('error', message));

    if (error) {
      if (error.message && error.message !== message) {
        this.channelService.appendLine(formatLogMessage('error', `  Details: ${error.message}`));
      }

      // Try to extract API response data from SfError
      const errorAny = error as any;
      if (errorAny.data || errorAny.response || errorAny.body) {
        this.channelService.appendLine(formatLogMessage('error', '  API Response:'));
        try {
          const responseData = errorAny.data || errorAny.response || errorAny.body;
          const responseStr = typeof responseData === 'string' ? responseData : JSON.stringify(responseData, null, 2);
          // Indent each line of the response
          responseStr.split('\n').forEach(line => {
            this.channelService.appendLine(formatLogMessage('error', `    ${line}`));
          });
        } catch (e) {
          this.channelService.appendLine(
            formatLogMessage('error', `    ${String(errorAny.data || errorAny.response || errorAny.body)}`)
          );
        }
      }

      // Log status code if available
      if (errorAny.statusCode || errorAny.code) {
        this.channelService.appendLine(
          formatLogMessage('error', `  Status Code: ${errorAny.statusCode || errorAny.code}`)
        );
      }

      if (error.stack) {
        // Indent stack trace for readability
        const stackLines = error.stack.split('\n').slice(1); // Skip first line (message)
        stackLines.forEach(line => {
          this.channelService.appendLine(formatLogMessage('error', `  ${line.trim()}`));
        });
      }
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string): void {
    this.channelService.appendLine(formatLogMessage('warn', message));
  }

  /**
   * Log a debug message
   */
  debug(message: string): void {
    this.channelService.appendLine(formatLogMessage('debug', message));
  }

  /**
   * Log a raw line without formatting (for backward compatibility with test output)
   */
  appendLine(message: string): void {
    this.channelService.appendLine(message);
  }

  /**
   * Show the channel output
   */
  show(): void {
    this.channelService.showChannelOutput();
  }

  /**
   * Clear the channel
   */
  clear(): void {
    this.channelService.clear();
  }
}
