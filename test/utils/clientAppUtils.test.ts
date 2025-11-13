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
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getAvailableClientApps, createConnectionWithClientApp } from '../../src/utils/clientAppUtils';

// Mock modules
jest.mock('fs');
jest.mock('os');

// Mock @salesforce/core with proper mock functions
const mockReload = jest.fn();
const mockGetPropertyValue = jest.fn();
const mockGetUsername = jest.fn();
const mockConfigAggregatorCreate = jest.fn();
const mockOrgCreate = jest.fn();
const mockAuthInfoCreate = jest.fn();
const mockConnectionCreate = jest.fn();

jest.mock('@salesforce/core', () => ({
  ConfigAggregator: {
    create: (...args: any[]) => mockConfigAggregatorCreate(...args)
  },
  Org: {
    create: (...args: any[]) => mockOrgCreate(...args)
  },
  AuthInfo: {
    create: (...args: any[]) => mockAuthInfoCreate(...args)
  },
  Connection: {
    create: (...args: any[]) => mockConnectionCreate(...args)
  }
}));

describe('clientAppUtils', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockOs = os as jest.Mocked<typeof os>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOs.homedir.mockReturnValue('/home/testuser');
    mockReload.mockResolvedValue(undefined);
  });

  describe('getAvailableClientApps', () => {
    it('should return error when no target org is configured', async () => {
      mockGetPropertyValue.mockReturnValue(undefined);
      mockConfigAggregatorCreate.mockResolvedValue({
        getPropertyValue: mockGetPropertyValue,
        reload: mockReload
      });

      const result = await getAvailableClientApps();

      expect(result).toEqual({
        type: 'none',
        clientApps: [],
        error: 'No default target org configured. Please set your default target org using "sf config set target-org <username>"'
      });
    });

    it('should return error when username cannot be resolved', async () => {
      mockGetPropertyValue.mockReturnValue('my-org');
      mockConfigAggregatorCreate.mockResolvedValue({
        getPropertyValue: mockGetPropertyValue,
        reload: mockReload
      });

      mockGetUsername.mockReturnValue(undefined);
      mockOrgCreate.mockResolvedValue({
        getUsername: mockGetUsername
      });

      const result = await getAvailableClientApps();

      expect(result).toEqual({
        type: 'none',
        clientApps: [],
        error: 'Could not resolve username for target org value: my-org'
      });
    });

    it('should return error when auth file does not exist', async () => {
      mockGetPropertyValue.mockReturnValue('my-org');
      mockConfigAggregatorCreate.mockResolvedValue({
        getPropertyValue: mockGetPropertyValue,
        reload: mockReload
      });

      mockGetUsername.mockReturnValue('test@example.com');
      mockOrgCreate.mockResolvedValue({
        getUsername: mockGetUsername
      });

      mockFs.existsSync.mockReturnValue(false);

      const result = await getAvailableClientApps();

      expect(result).toEqual({
        type: 'none',
        clientApps: [],
        username: 'test@example.com',
        error: 'Authentication file not found for username: test@example.com. Please authenticate using "sf org login jwt"'
      });
      expect(mockFs.existsSync).toHaveBeenCalledWith('/home/testuser/.sfdx/test@example.com.json');
    });

    it('should return none when auth file has no client apps', async () => {
      mockGetPropertyValue.mockReturnValue('my-org');
      mockConfigAggregatorCreate.mockResolvedValue({
        getPropertyValue: mockGetPropertyValue,
        reload: mockReload
      });

      mockGetUsername.mockReturnValue('test@example.com');
      mockOrgCreate.mockResolvedValue({
        getUsername: mockGetUsername
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        username: 'test@example.com',
        clientApps: {}
      }));

      const result = await getAvailableClientApps();

      expect(result).toEqual({
        type: 'none',
        clientApps: [],
        username: 'test@example.com'
      });
    });

    it('should return single when auth file has one client app', async () => {
      mockGetPropertyValue.mockReturnValue('my-org');
      mockConfigAggregatorCreate.mockResolvedValue({
        getPropertyValue: mockGetPropertyValue,
        reload: mockReload
      });

      mockGetUsername.mockReturnValue('test@example.com');
      mockOrgCreate.mockResolvedValue({
        getUsername: mockGetUsername
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        username: 'test@example.com',
        clientApps: {
          'app1': {
            clientId: 'client-id-1'
          }
        }
      }));

      const result = await getAvailableClientApps();

      expect(result).toEqual({
        type: 'single',
        clientApps: [
          { name: 'app1', clientId: 'client-id-1' }
        ],
        username: 'test@example.com'
      });
    });

    it('should return multiple when auth file has multiple client apps', async () => {
      mockGetPropertyValue.mockReturnValue('my-org');
      mockConfigAggregatorCreate.mockResolvedValue({
        getPropertyValue: mockGetPropertyValue,
        reload: mockReload
      });

      mockGetUsername.mockReturnValue('test@example.com');
      mockOrgCreate.mockResolvedValue({
        getUsername: mockGetUsername
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        username: 'test@example.com',
        clientApps: {
          'app1': {
            clientId: 'client-id-1'
          },
          'app2': {
            clientId: 'client-id-2'
          }
        }
      }));

      const result = await getAvailableClientApps();

      expect(result).toEqual({
        type: 'multiple',
        clientApps: [
          { name: 'app1', clientId: 'client-id-1' },
          { name: 'app2', clientId: 'client-id-2' }
        ],
        username: 'test@example.com'
      });
    });

    it('should skip client apps without clientId', async () => {
      mockGetPropertyValue.mockReturnValue('my-org');
      mockConfigAggregatorCreate.mockResolvedValue({
        getPropertyValue: mockGetPropertyValue,
        reload: mockReload
      });

      mockGetUsername.mockReturnValue('test@example.com');
      mockOrgCreate.mockResolvedValue({
        getUsername: mockGetUsername
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        username: 'test@example.com',
        clientApps: {
          'app1': {
            clientId: 'client-id-1'
          },
          'invalid-app': {
            // Missing clientId
            name: 'Invalid'
          },
          'app2': {
            clientId: 'client-id-2'
          }
        }
      }));

      const result = await getAvailableClientApps();

      expect(result).toEqual({
        type: 'multiple',
        clientApps: [
          { name: 'app1', clientId: 'client-id-1' },
          { name: 'app2', clientId: 'client-id-2' }
        ],
        username: 'test@example.com'
      });
    });

    it('should handle clientApps as array (invalid format)', async () => {
      mockGetPropertyValue.mockReturnValue('my-org');
      mockConfigAggregatorCreate.mockResolvedValue({
        getPropertyValue: mockGetPropertyValue,
        reload: mockReload
      });

      mockGetUsername.mockReturnValue('test@example.com');
      mockOrgCreate.mockResolvedValue({
        getUsername: mockGetUsername
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        username: 'test@example.com',
        clientApps: [] // Array instead of object
      }));

      const result = await getAvailableClientApps();

      expect(result).toEqual({
        type: 'none',
        clientApps: [],
        username: 'test@example.com'
      });
    });

    it('should handle missing username in auth data', async () => {
      mockGetPropertyValue.mockReturnValue('my-org');
      mockConfigAggregatorCreate.mockResolvedValue({
        getPropertyValue: mockGetPropertyValue,
        reload: mockReload
      });

      mockGetUsername.mockReturnValue('test@example.com');
      mockOrgCreate.mockResolvedValue({
        getUsername: mockGetUsername
      });

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        // No username field
        clientApps: {
          'app1': {
            clientId: 'client-id-1'
          }
        }
      }));

      const result = await getAvailableClientApps();

      expect(result).toEqual({
        type: 'single',
        clientApps: [
          { name: 'app1', clientId: 'client-id-1' }
        ],
        username: 'test@example.com' // Falls back to resolved username
      });
    });

    it('should handle errors gracefully', async () => {
      mockGetPropertyValue.mockReturnValue('my-org');
      mockConfigAggregatorCreate.mockResolvedValue({
        getPropertyValue: mockGetPropertyValue,
        reload: mockReload
      });

      mockOrgCreate.mockRejectedValue(new Error('Failed to create org'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await getAvailableClientApps();

      expect(result).toEqual({
        type: 'none',
        clientApps: [],
        error: 'Error reading authentication: Failed to create org'
      });
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle non-Error exceptions', async () => {
      mockGetPropertyValue.mockReturnValue('my-org');
      mockConfigAggregatorCreate.mockResolvedValue({
        getPropertyValue: mockGetPropertyValue,
        reload: mockReload
      });

      mockOrgCreate.mockRejectedValue('String error');

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await getAvailableClientApps();

      expect(result).toEqual({
        type: 'none',
        clientApps: [],
        error: 'Error reading authentication: Unknown error'
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('createConnectionWithClientApp', () => {
    it('should throw error when no target org is configured', async () => {
      mockGetPropertyValue.mockReturnValue(undefined);
      mockConfigAggregatorCreate.mockResolvedValue({
        getPropertyValue: mockGetPropertyValue,
        reload: mockReload
      });

      await expect(createConnectionWithClientApp('app1')).rejects.toThrow('No default target org configured');
    });

    it('should throw error when username cannot be resolved', async () => {
      mockGetPropertyValue.mockReturnValue('my-org');
      mockConfigAggregatorCreate.mockResolvedValue({
        getPropertyValue: mockGetPropertyValue,
        reload: mockReload
      });

      mockGetUsername.mockReturnValue(undefined);
      mockOrgCreate.mockResolvedValue({
        getUsername: mockGetUsername
      });

      await expect(createConnectionWithClientApp('app1')).rejects.toThrow(
        'Could not resolve username for target org value: my-org'
      );
    });

    it('should create connection with client app', async () => {
      mockGetPropertyValue.mockReturnValue('my-org');
      mockConfigAggregatorCreate.mockResolvedValue({
        getPropertyValue: mockGetPropertyValue,
        reload: mockReload
      });

      mockGetUsername.mockReturnValue('test@example.com');
      mockOrgCreate.mockResolvedValue({
        getUsername: mockGetUsername
      });

      const mockAuthInfoInstance = {
        getUsername: jest.fn().mockReturnValue('test@example.com')
      };
      mockAuthInfoCreate.mockResolvedValue(mockAuthInfoInstance as any);

      const mockConnectionInstance = {
        instanceUrl: 'https://test.salesforce.com'
      };
      mockConnectionCreate.mockResolvedValue(mockConnectionInstance as any);

      const result = await createConnectionWithClientApp('app1');

      expect(mockAuthInfoCreate).toHaveBeenCalledWith({
        username: 'test@example.com'
      });
      expect(mockConnectionCreate).toHaveBeenCalledWith({
        authInfo: mockAuthInfoInstance,
        clientApp: 'app1'
      });
      expect(result).toBe(mockConnectionInstance);
    });

    it('should reload config before reading target org', async () => {
      mockGetPropertyValue.mockReturnValue('my-org');
      mockConfigAggregatorCreate.mockResolvedValue({
        getPropertyValue: mockGetPropertyValue,
        reload: mockReload
      });

      mockGetUsername.mockReturnValue('test@example.com');
      mockOrgCreate.mockResolvedValue({
        getUsername: mockGetUsername
      });

      const mockAuthInfoInstance = {};
      mockAuthInfoCreate.mockResolvedValue(mockAuthInfoInstance as any);

      const mockConnectionInstance = {};
      mockConnectionCreate.mockResolvedValue(mockConnectionInstance as any);

      await createConnectionWithClientApp('app1');

      expect(mockReload).toHaveBeenCalled();
    });
  });
});
