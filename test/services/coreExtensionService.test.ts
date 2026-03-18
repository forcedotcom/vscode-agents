import { ExtensionContext, extensions, window } from 'vscode';
import {
  CoreExtensionService,
  CORE_EXTENSION_NOT_FOUND,
  CHANNEL_SERVICE_NOT_FOUND,
  TELEMETRY_SERVICE_NOT_FOUND,
  NOT_INITIALIZED_ERROR,
  WORKSPACE_CONTEXT_NOT_FOUND
} from '../../src/services/coreExtensionService';
import { ChannelService } from '../../src/types';
import { TelemetryService } from '../../src/types/TelemetryService';
import { CoreExtensionApi } from '../../src/types/CoreExtension';
import { satisfies, valid } from 'semver';
import { WorkspaceContext } from '../../src/types/WorkspaceContext';

const mockOutputChannel = {
  appendLine: jest.fn(),
  show: jest.fn(),
  clear: jest.fn(),
  dispose: jest.fn()
};

jest.mock('vscode', () => ({
  extensions: { getExtension: jest.fn() },
  window: {
    showWarningMessage: jest.fn(),
    createOutputChannel: jest.fn(() => mockOutputChannel)
  }
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
  let workspaceContextInstance: WorkspaceContext;

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
    workspaceContextInstance = {
      getInstance: jest.fn().mockReturnValue({
        initializeService: jest.fn()
      })
    } as unknown as WorkspaceContext;

    (extensions.getExtension as jest.Mock).mockReturnValue(mockExtension);
    (satisfies as jest.Mock).mockReturnValue(true);
    (valid as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    // Reset the initialized state and service instances
    (CoreExtensionService as any).initialized = false;
    (CoreExtensionService as any).channelService = undefined;
    (CoreExtensionService as any).testChannelService = undefined;
    (CoreExtensionService as any).telemetryService = undefined;
    (CoreExtensionService as any).workspaceContext = undefined;
    jest.restoreAllMocks();
  });

  it('should gracefully handle when core extension is not found', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    (extensions.getExtension as jest.Mock).mockReturnValue(null);
    // Should not throw - will initialize fallback services
    await expect(CoreExtensionService.loadDependencies(mockContext)).resolves.not.toThrow();
    // Channel service should be available (fallback)
    expect(CoreExtensionService.getChannelService()).toBeDefined();
    // Telemetry service should be undefined (no fallback)
    expect(CoreExtensionService.getTelemetryService()).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should gracefully handle when core extension version is below minimum required', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    (satisfies as jest.Mock).mockReturnValue(false);
    // Should not throw - will initialize fallback services
    await expect(CoreExtensionService.loadDependencies(mockContext)).resolves.not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should gracefully handle when ChannelService is not found', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    delete (mockExtension.exports.services as any).ChannelService;
    // Should not throw - will use fallback ColoredChannelService
    await expect(CoreExtensionService.loadDependencies(mockContext)).resolves.not.toThrow();
    expect(CoreExtensionService.getChannelService()).toBeDefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should gracefully handle when TelemetryService is not found', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    delete (mockExtension.exports.services as any).TelemetryService;
    // Should not throw - telemetry will just be undefined
    await expect(CoreExtensionService.loadDependencies(mockContext)).resolves.not.toThrow();
    expect(CoreExtensionService.getTelemetryService()).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should return core extension version', () => {
    expect(CoreExtensionService.getCoreExtensionVersion()).toBe('60.14.0');
  });

  it('should validate version correctly', () => {
    expect(CoreExtensionService.isAboveMinimumRequiredVersion('60.13.0', '60.14.0')).toBe(true);
  });

  it('should throw error if getting channel service before any initialization attempt', () => {
    // getChannelService should throw only if service was never created at all
    expect(() => CoreExtensionService.getChannelService()).toThrow(NOT_INITIALIZED_ERROR);
  });

  it('should throw error if getting test channel service before any initialization attempt', () => {
    expect(() => CoreExtensionService.getTestChannelService()).toThrow(NOT_INITIALIZED_ERROR);
  });

  it('should return test channel service after initialization', async () => {
    channelServiceInstance.getInstance = jest.fn().mockReturnValue({ appendLine: jest.fn() });

    jest.spyOn(CoreExtensionService as any, 'validateCoreExtension').mockReturnValue({
      services: {
        ChannelService: channelServiceInstance,
        TelemetryService: telemetryServiceInstance,
        WorkspaceContext: workspaceContextInstance
      }
    });

    await CoreExtensionService.loadDependencies(mockContext);
    const service = CoreExtensionService.getTestChannelService();
    expect(service).toBeDefined();
  });

  it('should return undefined if getting telemetry service before initialization', () => {
    // getTelemetryService now returns undefined instead of throwing
    expect(CoreExtensionService.getTelemetryService()).toBeUndefined();
  });

  it('should initialize channel/ telemetry/ workspace services', async () => {
    const channelSpy = jest.spyOn(channelServiceInstance, 'getInstance');
    const telemetrySpy = jest.spyOn(telemetryServiceInstance, 'getInstance');
    const workspaceSpy = jest.spyOn(workspaceContextInstance, 'getInstance');
    jest.spyOn(CoreExtensionService as any, 'validateCoreExtension').mockReturnValue({
      services: {
        ChannelService: channelServiceInstance,
        TelemetryService: telemetryServiceInstance,
        WorkspaceContext: workspaceContextInstance
      }
    });
    await CoreExtensionService.loadDependencies(mockContext);

    // ColoredChannelService creates its own channel with language support
    expect(window.createOutputChannel).toHaveBeenCalledWith('Agentforce DX', 'afdx-log');
    expect(telemetrySpy).toHaveBeenCalledWith('AgentforceDX');
    expect(workspaceSpy).toHaveBeenCalledWith(false);
  });

  it('should return isInitialized as false before initialization', () => {
    expect(CoreExtensionService.isInitialized).toBe(false);
  });

  it('should return isInitialized as true after initialization', async () => {
    jest.spyOn(CoreExtensionService as any, 'validateCoreExtension').mockReturnValue({
      services: {
        ChannelService: channelServiceInstance,
        TelemetryService: telemetryServiceInstance,
        WorkspaceContext: workspaceContextInstance
      }
    });
    await CoreExtensionService.loadDependencies(mockContext);
    expect(CoreExtensionService.isInitialized).toBe(true);
  });

  it('should gracefully handle when WorkspaceContext is not found', async () => {
    const mockChannelService = { appendLine: jest.fn() };
    const mockTelemetryService = { sendCommandEvent: jest.fn(), initializeService: jest.fn() };

    channelServiceInstance.getInstance = jest.fn().mockReturnValue(mockChannelService);
    telemetryServiceInstance.getInstance = jest.fn().mockReturnValue(mockTelemetryService);

    jest.spyOn(CoreExtensionService as any, 'validateCoreExtension').mockReturnValue({
      services: {
        ChannelService: channelServiceInstance,
        TelemetryService: telemetryServiceInstance,
        WorkspaceContext: undefined // No WorkspaceContext
      }
    });

    // Should not throw - will fall back to creating connection directly when needed
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    await expect(CoreExtensionService.loadDependencies(mockContext)).resolves.not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should throw error when getting core extension version if extension not found', () => {
    (extensions.getExtension as jest.Mock).mockReturnValue(null);
    expect(() => CoreExtensionService.getCoreExtensionVersion()).toThrow(CORE_EXTENSION_NOT_FOUND);
  });

  it('should show warning for invalid version format', () => {
    (valid as jest.Mock).mockReturnValue(false);
    CoreExtensionService.isAboveMinimumRequiredVersion('60.13.0', 'invalid-version');
    expect(window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('Invalid version format found'));
  });

  it('should return channel service when initialized', async () => {
    channelServiceInstance.getInstance = jest.fn().mockReturnValue({ appendLine: jest.fn() });

    jest.spyOn(CoreExtensionService as any, 'validateCoreExtension').mockReturnValue({
      services: {
        ChannelService: channelServiceInstance,
        TelemetryService: telemetryServiceInstance,
        WorkspaceContext: workspaceContextInstance
      }
    });

    await CoreExtensionService.loadDependencies(mockContext);
    const service = CoreExtensionService.getChannelService();
    // Service should be a ColoredChannelService instance
    expect(service).toBeDefined();
    expect(service.appendLine).toBeDefined();
    expect(service.showChannelOutput).toBeDefined();
    expect(service.clear).toBeDefined();
  });

  it('should return telemetry service when initialized', async () => {
    const mockTelemetryService = { sendCommandEvent: jest.fn(), initializeService: jest.fn() };
    telemetryServiceInstance.getInstance = jest.fn().mockReturnValue(mockTelemetryService);

    jest.spyOn(CoreExtensionService as any, 'validateCoreExtension').mockReturnValue({
      services: {
        ChannelService: channelServiceInstance,
        TelemetryService: telemetryServiceInstance,
        WorkspaceContext: workspaceContextInstance
      }
    });

    await CoreExtensionService.loadDependencies(mockContext);
    const service = CoreExtensionService.getTelemetryService();
    expect(service).toBe(mockTelemetryService);
  });

  it('should return default connection when initialized', async () => {
    const mockConnection = { instanceUrl: 'https://test.salesforce.com' };
    const mockWorkspaceContext = {
      getConnection: jest.fn().mockResolvedValue(mockConnection)
    };
    workspaceContextInstance.getInstance = jest.fn().mockReturnValue(mockWorkspaceContext);

    jest.spyOn(CoreExtensionService as any, 'validateCoreExtension').mockReturnValue({
      services: {
        ChannelService: channelServiceInstance,
        TelemetryService: telemetryServiceInstance,
        WorkspaceContext: workspaceContextInstance
      }
    });

    await CoreExtensionService.loadDependencies(mockContext);
    const connection = await CoreExtensionService.getDefaultConnection();
    expect(connection).toBe(mockConnection);
    expect(mockWorkspaceContext.getConnection).toHaveBeenCalled();
  });

  it('should attempt to create connection directly when getting default connection before initialization', async () => {
    // When not initialized, should try to create connection via ConfigAggregator
    // This will fail in test environment without mocking, but error message will include
    // both NOT_INITIALIZED_ERROR prefix and more specific info about what went wrong
    await expect(CoreExtensionService.getDefaultConnection()).rejects.toThrow();
  });

  it('should not reinitialize if already initialized', async () => {
    const validateSpy = jest.spyOn(CoreExtensionService as any, 'validateCoreExtension').mockReturnValue({
      services: {
        ChannelService: channelServiceInstance,
        TelemetryService: telemetryServiceInstance,
        WorkspaceContext: workspaceContextInstance
      }
    });

    // First initialization
    await CoreExtensionService.loadDependencies(mockContext);
    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(CoreExtensionService.isInitialized).toBe(true);

    // Second call should not reinitialize
    await CoreExtensionService.loadDependencies(mockContext);
    expect(validateSpy).toHaveBeenCalledTimes(1); // Still only called once
    expect(CoreExtensionService.isInitialized).toBe(true);
  });

  it('should throw error when getting onOrgChange event before initialization', () => {
    expect(() => CoreExtensionService.getOnOrgChangeEvent()).toThrow(NOT_INITIALIZED_ERROR);
  });

  it('should return onOrgChange event when initialized', async () => {
    const mockOnOrgChange = jest.fn();
    const mockWorkspaceContext = {
      onOrgChange: mockOnOrgChange,
      getConnection: jest.fn().mockResolvedValue({})
    };
    workspaceContextInstance.getInstance = jest.fn().mockReturnValue(mockWorkspaceContext);

    jest.spyOn(CoreExtensionService as any, 'validateCoreExtension').mockReturnValue({
      services: {
        ChannelService: channelServiceInstance,
        TelemetryService: telemetryServiceInstance,
        WorkspaceContext: workspaceContextInstance
      }
    });

    await CoreExtensionService.loadDependencies(mockContext);
    const event = CoreExtensionService.getOnOrgChangeEvent();
    expect(event).toBe(mockOnOrgChange);
  });
});
