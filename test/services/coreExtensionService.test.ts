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
    // Reset the initialized state
    (CoreExtensionService as any).initialized = false;
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

  it('should throw error if WorkspaceContext is not found', async () => {
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

    await expect(CoreExtensionService.loadDependencies(mockContext)).rejects.toThrow(WORKSPACE_CONTEXT_NOT_FOUND);
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

  it('should throw error when getting default connection before initialization', async () => {
    await expect(CoreExtensionService.getDefaultConnection()).rejects.toThrow(NOT_INITIALIZED_ERROR);
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
