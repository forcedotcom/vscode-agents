/**
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/
import { satisfies, valid } from 'semver';
import { ExtensionContext, extensions, window } from 'vscode';
import { EXTENSION_NAME } from '../consts';
import { ChannelService } from '../types';
import { TelemetryService } from '../types/TelemetryService';
import { CoreExtensionApi } from '../types/CoreExtension';

const CORE_EXTENSION_ID = 'salesforce.salesforcedx-vscode-core';
export const NOT_INITIALIZED_ERROR = 'CoreExtensionService not initialized';
export const CHANNEL_SERVICE_NOT_FOUND = 'ChannelService not found';
export const TELEMETRY_SERVICE_NOT_FOUND = 'TelemetryService not found';
export const CORE_EXTENSION_NOT_FOUND = 'Core extension not found';

export class CoreExtensionService {
  private static initialized = false;
  private static channelService: ChannelService;
  private static telemetryService: TelemetryService;

  static get isInitialized(): boolean {
    return CoreExtensionService.initialized;
  }

  static async loadDependencies(context: ExtensionContext): Promise<void> {
    if (!CoreExtensionService.initialized) {
      const coreExtensionApi = CoreExtensionService.validateCoreExtension();

      CoreExtensionService.initializeChannelService(coreExtensionApi?.services.ChannelService);
      CoreExtensionService.initializeTelemetryService(coreExtensionApi?.services.TelemetryService, context);

      CoreExtensionService.initialized = true;
    }
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

  static getTelemetryService(): TelemetryService {
    if (CoreExtensionService.initialized) {
      return CoreExtensionService.telemetryService;
    }
    throw new Error(NOT_INITIALIZED_ERROR);
  }
}
