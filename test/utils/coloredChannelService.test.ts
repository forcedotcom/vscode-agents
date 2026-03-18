const mockOutputChannel = {
  appendLine: jest.fn(),
  show: jest.fn(),
  clear: jest.fn(),
  dispose: jest.fn()
};

jest.mock('vscode', () => ({
  window: {
    createOutputChannel: jest.fn().mockReturnValue(mockOutputChannel)
  }
}));

import { ColoredChannelService } from '../../src/utils/coloredChannelService';
import * as vscode from 'vscode';

describe('ColoredChannelService', () => {
  let service: ColoredChannelService;

  beforeEach(() => {
    jest.clearAllMocks();
    (vscode.window.createOutputChannel as jest.Mock).mockReturnValue(mockOutputChannel);
    service = new ColoredChannelService('Test Channel');
  });

  it('should create an output channel with language grammar', () => {
    expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('Test Channel', 'afdx-log');
  });

  it('should return self from getInstance', () => {
    expect(service.getInstance('any-name')).toBe(service);
  });

  it('should not throw from showCommandWithTimestamp', () => {
    expect(() => service.showCommandWithTimestamp('test')).not.toThrow();
  });

  it('should show channel output', () => {
    service.showChannelOutput();
    expect(mockOutputChannel.show).toHaveBeenCalledWith(true);
  });

  it('should append line to channel', () => {
    service.appendLine('test message');
    expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('test message');
  });

  it('should clear the channel', () => {
    service.clear();
    expect(mockOutputChannel.clear).toHaveBeenCalled();
  });

  it('should dispose the channel', () => {
    service.dispose();
    expect(mockOutputChannel.dispose).toHaveBeenCalled();
  });
});
