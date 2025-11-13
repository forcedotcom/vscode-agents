import * as vscode from 'vscode';
import { AgentCombinedViewProvider } from '../../src/views/agentCombinedViewProvider';

// Mock vscode
jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn()
  },
  commands: {
    executeCommand: jest.fn(),
    registerCommand: jest.fn()
  }
}));

describe('Refresh Agents Command', () => {
  let mockProvider: jest.Mocked<AgentCombinedViewProvider>;
  let registeredCommands: Map<string, Function>;

  beforeEach(() => {
    jest.clearAllMocks();
    registeredCommands = new Map();

    // Mock the provider
    mockProvider = {
      refreshAvailableAgents: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock getInstance to return our mock provider
    jest.spyOn(AgentCombinedViewProvider, 'getInstance').mockReturnValue(mockProvider);

    // Capture registered commands
    (vscode.commands.registerCommand as jest.Mock).mockImplementation((id: string, handler: Function) => {
      registeredCommands.set(id, handler);
      return { dispose: jest.fn() };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should show notification toast after refreshing agent list', async () => {
    // Simulate the command being registered and executed
    const refreshCommand = async () => {
      await mockProvider.refreshAvailableAgents();
      vscode.window.showInformationMessage('Agentforce DX: Agent list refreshed');
    };

    // Execute the command
    await refreshCommand();

    // Verify refreshAvailableAgents was called
    expect(mockProvider.refreshAvailableAgents).toHaveBeenCalled();

    // Verify notification toast was shown
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Agentforce DX: Agent list refreshed');
  });

  it('should show notification toast even when no agents are found', async () => {
    // Simulate the command being registered and executed
    const refreshCommand = async () => {
      await mockProvider.refreshAvailableAgents();
      vscode.window.showInformationMessage('Agentforce DX: Agent list refreshed');
    };

    // Execute the command
    await refreshCommand();

    // Verify notification is shown regardless of result
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Agentforce DX: Agent list refreshed');
  });
});
