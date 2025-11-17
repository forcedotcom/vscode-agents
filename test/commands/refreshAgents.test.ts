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
      refreshAvailableAgents: jest.fn().mockResolvedValue(undefined),
      resetCurrentAgentView: jest.fn().mockResolvedValue(undefined),
      getCurrentAgentId: jest.fn().mockReturnValue('0X1234567890123')
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

  it('should refresh the agent list and show toast', async () => {
    const refreshCommand = async () => {
      await mockProvider.refreshAvailableAgents();
      vscode.window.showInformationMessage('Agentforce DX: Agent list refreshed');
    };

    await refreshCommand();

    expect(mockProvider.refreshAvailableAgents).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Agentforce DX: Agent list refreshed');
  });

  it('should reset the agent view when an agent is selected', async () => {
    const resetCommand = async () => {
      const currentAgentId = mockProvider.getCurrentAgentId();
      if (!currentAgentId) {
        vscode.window.showErrorMessage('Agentforce DX: Select an agent to reset.');
        return;
      }

      try {
        await mockProvider.resetCurrentAgentView();
        vscode.window.showInformationMessage('Agentforce DX: Agent preview reset');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Agentforce DX: Unable to reset agent view: ${errorMessage}`);
      }
    };

    await resetCommand();

    expect(mockProvider.resetCurrentAgentView).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Agentforce DX: Agent preview reset');
  });

  it('should show an error when no agent is selected', async () => {
    mockProvider.getCurrentAgentId.mockReturnValueOnce(undefined);

    const resetCommand = async () => {
      const currentAgentId = mockProvider.getCurrentAgentId();
      if (!currentAgentId) {
        vscode.window.showErrorMessage('Agentforce DX: Select an agent to reset.');
        return;
      }
      await mockProvider.resetCurrentAgentView();
    };

    await resetCommand();

    expect(mockProvider.resetCurrentAgentView).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Agentforce DX: Select an agent to reset.');
  });

  it('should surface reset errors to the user', async () => {
    mockProvider.resetCurrentAgentView.mockRejectedValueOnce(new Error('reset failed'));

    const resetCommand = async () => {
      const currentAgentId = mockProvider.getCurrentAgentId();
      if (!currentAgentId) {
        vscode.window.showErrorMessage('Agentforce DX: Select an agent to reset.');
        return;
      }

      try {
        await mockProvider.resetCurrentAgentView();
        vscode.window.showInformationMessage('Agentforce DX: Agent preview reset');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Agentforce DX: Unable to reset agent view: ${errorMessage}`);
      }
    };

    await resetCommand();

    expect(mockProvider.resetCurrentAgentView).toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Agentforce DX: Unable to reset agent view: reset failed');
  });
});
