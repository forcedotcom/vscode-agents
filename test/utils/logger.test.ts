import { Logger } from '../../src/utils/logger';
import { ChannelService } from '../../src/types/ChannelService';
import { SfError } from '@salesforce/core';

jest.mock('@salesforce/core', () => ({
  SfError: class SfError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'SfError';
    }
  }
}));

describe('Logger', () => {
  let logger: Logger;
  let mockChannelService: jest.Mocked<ChannelService>;

  beforeEach(() => {
    mockChannelService = {
      appendLine: jest.fn(),
      showChannelOutput: jest.fn(),
      clear: jest.fn(),
      getInstance: jest.fn(),
      showCommandWithTimestamp: jest.fn(),
      dispose: jest.fn()
    } as any;
    logger = new Logger(mockChannelService);
  });

  describe('error', () => {
    it('should log error message with timestamp', () => {
      logger.error('something broke');
      expect(mockChannelService.appendLine).toHaveBeenCalledTimes(1);
      expect(mockChannelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('[error] something broke'));
    });

    it('should log error details when message differs', () => {
      const error = new SfError('detailed reason') as SfError;
      logger.error('something broke', error);
      expect(mockChannelService.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Details: detailed reason')
      );
    });

    it('should not log duplicate details when messages match', () => {
      const error = new SfError('something broke') as SfError;
      logger.error('something broke', error);
      const calls = mockChannelService.appendLine.mock.calls.map(c => c[0]);
      expect(calls.filter(c => c.includes('Details:'))).toHaveLength(0);
    });

    it('should log API response data as object', () => {
      const error = new SfError('api error') as SfError & { data: unknown };
      (error as any).data = { errorCode: 'NOT_FOUND', message: 'Resource missing' };
      logger.error('api call failed', error);
      const calls = mockChannelService.appendLine.mock.calls.map(c => c[0]);
      expect(calls.some(c => c.includes('API Response:'))).toBe(true);
      expect(calls.some(c => c.includes('NOT_FOUND'))).toBe(true);
    });

    it('should log API response data as string', () => {
      const error = new SfError('api error') as SfError & { response: unknown };
      (error as any).response = 'raw response text';
      logger.error('api call failed', error);
      const calls = mockChannelService.appendLine.mock.calls.map(c => c[0]);
      expect(calls.some(c => c.includes('raw response text'))).toBe(true);
    });

    it('should log status code when available', () => {
      const error = new SfError('api error') as SfError & { statusCode: number };
      (error as any).statusCode = 404;
      logger.error('api call failed', error);
      const calls = mockChannelService.appendLine.mock.calls.map(c => c[0]);
      expect(calls.some(c => c.includes('Status Code: 404'))).toBe(true);
    });

    it('should log error code when statusCode is not available', () => {
      const error = new SfError('api error') as SfError & { code: string };
      (error as any).code = 'ECONNREFUSED';
      logger.error('api call failed', error);
      const calls = mockChannelService.appendLine.mock.calls.map(c => c[0]);
      expect(calls.some(c => c.includes('Status Code: ECONNREFUSED'))).toBe(true);
    });

    it('should log stack trace', () => {
      const error = new SfError('with stack') as SfError;
      error.stack = 'Error: with stack\n    at someFunc (file.ts:10)\n    at anotherFunc (file.ts:20)';
      logger.error('error with stack', error);
      const calls = mockChannelService.appendLine.mock.calls.map(c => c[0]);
      expect(calls.some(c => c.includes('at someFunc'))).toBe(true);
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      logger.warn('watch out');
      expect(mockChannelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('[warn] watch out'));
    });
  });

  describe('debug', () => {
    it('should log debug message', () => {
      logger.debug('debug info');
      expect(mockChannelService.appendLine).toHaveBeenCalledWith(expect.stringContaining('[debug] debug info'));
    });
  });

  describe('appendLine', () => {
    it('should log raw line without formatting', () => {
      logger.appendLine('raw message');
      expect(mockChannelService.appendLine).toHaveBeenCalledWith('raw message');
    });
  });

  describe('errorDetail', () => {
    it('should log indented detail line', () => {
      logger.errorDetail('some detail');
      expect(mockChannelService.appendLine).toHaveBeenCalledWith('\tsome detail');
    });
  });

  describe('show', () => {
    it('should show channel output', () => {
      logger.show();
      expect(mockChannelService.showChannelOutput).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear the channel', () => {
      logger.clear();
      expect(mockChannelService.clear).toHaveBeenCalled();
    });
  });
});
