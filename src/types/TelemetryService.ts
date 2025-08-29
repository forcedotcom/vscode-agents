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

import { ExtensionContext } from 'vscode';

export interface Measurements {
  [key: string]: number;
}

export interface Properties {
  [key: string]: string;
}

//Microsoft Telemetry Reporter used for AppInsights
export type TelemetryReporter = {
  sendTelemetryEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void;

  sendExceptionEvent(exceptionName: string, exceptionMessage: string, measurements?: { [key: string]: number }): void;

  dispose(): Promise<unknown>;
};

// Note this is a subset of the TelemetryService interface from the core extension
export interface TelemetryService {
  extensionName: string;
  isTelemetryEnabled(): Promise<boolean>;
  getInstance(extensionName: string): TelemetryService;
  getReporters(): TelemetryReporter[];
  initializeService(
    extensionContext: ExtensionContext,
    extensionName: string,
    aiKey: string,
    version: string
  ): Promise<void>;
  sendExtensionActivationEvent(hrstart: [number, number]): void;
  sendExtensionDeactivationEvent(): void;
  sendCommandEvent(
    commandName?: string,
    hrstart?: [number, number],
    properties?: Properties,
    measurements?: Measurements
  ): void;
  sendException(name: string, message: string): void;
  dispose(): void;
}
