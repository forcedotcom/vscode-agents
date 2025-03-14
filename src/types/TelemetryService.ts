/**
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/

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
