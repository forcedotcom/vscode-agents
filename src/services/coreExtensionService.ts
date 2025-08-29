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
import { satisfies, valid } from 'semver';
import { ExtensionContext, extensions, window } from 'vscode';
import { EXTENSION_NAME } from '../consts';
import { ChannelService } from '../types';
import { TelemetryService } from '../types/TelemetryService';
import { CoreExtensionApi } from '../types/CoreExtension';
import { WorkspaceContext } from '../types/WorkspaceContext';
import { Connection } from '@salesforce/core';

const CORE_EXTENSION_ID = 'salesforce.salesforcedx-vscode-core';
export const NOT_INITIALIZED_ERROR = 'CoreExtensionService not initialized';
export const CHANNEL_SERVICE_NOT_FOUND = 'ChannelService not found';
export const TELEMETRY_SERVICE_NOT_FOUND = 'TelemetryService not found';
export const CORE_EXTENSION_NOT_FOUND = 'Core extension not found';
export const WORKSPACE_CONTEXT_NOT_FOUND = 'Workspace Context not found';

export class CoreExtensionService {
  private static initialized = false;
  private static channelService: ChannelService;
  private static telemetryService: TelemetryService;
  private static workspaceContext: WorkspaceContext;

  static get isInitialized(): boolean {
    return CoreExtensionService.initialized;
  }

  static async loadDependencies(context: ExtensionContext): Promise<void> {
    if (!CoreExtensionService.initialized) {
      const coreExtensionApi = CoreExtensionService.validateCoreExtension();

      CoreExtensionService.initializeChannelService(coreExtensionApi?.services.ChannelService);
      CoreExtensionService.initializeTelemetryService(coreExtensionApi?.services.TelemetryService, context);
      CoreExtensionService.initializeWorkspaceContext(coreExtensionApi?.services.WorkspaceContext);

      CoreExtensionService.initialized = true;
    }
  }

  private static initializeWorkspaceContext(workspaceContext: WorkspaceContext | undefined) {
    if (!workspaceContext) {
      throw new Error(WORKSPACE_CONTEXT_NOT_FOUND);
    }
    CoreExtensionService.workspaceContext = workspaceContext.getInstance(false);
  }

  public static getCoreExtensionVersion(): string {
    const coreExtension = extensions.getExtension(CORE_EXTENSION_ID);
    if (!coreExtension) {
      throw new Error(CORE_EXTENSION_NOT_FOUND);
    }
    return coreExtension.packageJSON.version;
  }

  private static validateCoreExtension(): CoreExtensionApi {
    const coreExtension = extensions.getExtension(CORE_EXTENSION_ID);
    if (!coreExtension) {
      throw new Error(CORE_EXTENSION_NOT_FOUND);
    }
    const coreExtensionVersion = CoreExtensionService.getCoreExtensionVersion();
    if (!CoreExtensionService.isAboveMinimumRequiredVersion('60.13.0', coreExtensionVersion)) {
      throw new Error(
        "It looks you're running an older version of the Salesforce CLI Integration VSCode Extension. Update the Salesforce Extension pack and try again."
      );
    }
    return coreExtension.exports;
  }

  private static initializeChannelService(channelService: ChannelService | undefined): void {
    if (!channelService) {
      throw new Error(CHANNEL_SERVICE_NOT_FOUND);
    }
    CoreExtensionService.channelService = channelService.getInstance(EXTENSION_NAME);
  }

  private static initializeTelemetryService(
    telemetryService: TelemetryService | undefined,
    context: ExtensionContext
  ): void {
    if (!telemetryService) {
      throw new Error(TELEMETRY_SERVICE_NOT_FOUND);
    }
    const { aiKey, name, version } = context.extension.packageJSON;
    CoreExtensionService.telemetryService = telemetryService.getInstance(name);
    void CoreExtensionService.telemetryService.initializeService(context, name, aiKey, version);
  }

  public static isAboveMinimumRequiredVersion(minRequiredVersion: string, actualVersion: string): boolean {
    // Check to see if version is in the expected MAJOR.MINOR.PATCH format
    if (!valid(actualVersion)) {
      void window.showWarningMessage(
        `Invalid version format found for the Core Extension ${actualVersion} < ${minRequiredVersion}`
      );
    }
    return satisfies(actualVersion, '>=' + minRequiredVersion);
  }

  static getChannelService(): ChannelService {
    if (CoreExtensionService.initialized) {
      return CoreExtensionService.channelService;
    }
    throw new Error(NOT_INITIALIZED_ERROR);
  }

  static async getDefaultConnection(): Promise<Connection> {
    if (CoreExtensionService.initialized) {
      return await CoreExtensionService.workspaceContext.getConnection();
    }
    throw new Error(NOT_INITIALIZED_ERROR);
  }

  static getTelemetryService(): TelemetryService {
    if (CoreExtensionService.initialized) {
      return CoreExtensionService.telemetryService;
    }
    throw new Error(NOT_INITIALIZED_ERROR);
  }
}
