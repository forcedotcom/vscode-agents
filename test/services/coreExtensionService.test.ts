import { ExtensionContext, extensions, window } from 'vscode';
import {
  CoreExtensionService,
  CORE_EXTENSION_NOT_FOUND,
  CHANNEL_SERVICE_NOT_FOUND,
  TELEMETRY_SERVICE_NOT_FOUND,
  NOT_INITIALIZED_ERROR
} from '../../src/services/coreExtensionService';
import { ChannelService } from '../../src/types';
import { TelemetryService } from '../../src/types/TelemetryService';
import { CoreExtensionApi } from '../../src/types/CoreExtension';
import { satisfies, valid } from 'semver';

jest.mock('vscode', () => ({
  extensions: { getExtension: jest.fn() },
  window: { showWarningMessage: jest.fn() }
}));

jest.mock('semver', () => ({
  satisfies: jest.fn(),
  valid: jest.fn()
}));

describe('CoreExtensionService', () => {
  let mockExtension: { packageJSON: { version: string }; exports: CoreExtensionApi };
  let mockContext: ExtensionContext;
  let channelServiceInstance: ChannelService;
  let telemetryServiceInstance: TelemetryService;

  beforeEach(() => {
    mockExtension = {
      packageJSON: { version: '60.14.0' },
      exports: {
        services: {
          ChannelService: { getInstance: jest.fn() },
          TelemetryService: { getInstance: jest.fn() }
        }
      }
    } as unknown as { packageJSON: { version: string }; exports: CoreExtensionApi };

    mockContext = {
      extension: { packageJSON: { aiKey: 'fake-ai-key', name: 'test-extension', version: '1.0.0' } }
    } as ExtensionContext;

    channelServiceInstance = { getInstance: jest.fn() } as unknown as ChannelService;
    telemetryServiceInstance = {
      getInstance: jest.fn().mockReturnValue({
        initializeService: jest.fn()
      })
    } as unknown as TelemetryService;

    (extensions.getExtension as jest.Mock).mockReturnValue(mockExtension);
    (satisfies as jest.Mock).mockReturnValue(true);
    (valid as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should throw error if core extension is not found', async () => {
    (extensions.getExtension as jest.Mock).mockReturnValue(null);
    await expect(CoreExtensionService.loadDependencies(mockContext)).rejects.toThrow(CORE_EXTENSION_NOT_FOUND);
  });

  it('should throw error if core extension version is below minimum required', async () => {
    (satisfies as jest.Mock).mockReturnValue(false);
    await expect(CoreExtensionService.loadDependencies(mockContext)).rejects.toThrow();
  });

  it('should throw error if ChannelService is not found', async () => {
    delete (mockExtension.exports.services as any).ChannelService;
    await expect(CoreExtensionService.loadDependencies(mockContext)).rejects.toThrow(CHANNEL_SERVICE_NOT_FOUND);
  });

  it('should throw error if TelemetryService is not found', async () => {
    delete (mockExtension.exports.services as any).TelemetryService;
    await expect(CoreExtensionService.loadDependencies(mockContext)).rejects.toThrow(TELEMETRY_SERVICE_NOT_FOUND);
  });

  it('should return core extension version', () => {
    expect(CoreExtensionService.getCoreExtensionVersion()).toBe('60.14.0');
  });

  it('should validate version correctly', () => {
    expect(CoreExtensionService.isAboveMinimumRequiredVersion('60.13.0', '60.14.0')).toBe(true);
  });

  it('should throw error if getting channel service before initialization', () => {
    expect(() => CoreExtensionService.getChannelService()).toThrow(NOT_INITIALIZED_ERROR);
  });

  it('should throw error if getting telemetry service before initialization', () => {
    expect(() => CoreExtensionService.getTelemetryService()).toThrow(NOT_INITIALIZED_ERROR);
  });

  it('should initialize channel and telemetry services', async () => {
    const channelSpy = jest.spyOn(channelServiceInstance, 'getInstance');
    const telemetrySpy = jest.spyOn(telemetryServiceInstance, 'getInstance');
    jest.spyOn(CoreExtensionService as any, 'validateCoreExtension').mockReturnValue({
      services: {
        ChannelService: channelServiceInstance,
        TelemetryService: telemetryServiceInstance
      }
    } as any);
    await CoreExtensionService.loadDependencies(mockContext);

    expect(channelSpy).toHaveBeenCalledWith('Agentforce DX');
    expect(telemetrySpy).toHaveBeenCalledWith('test-extension');
  });
});
