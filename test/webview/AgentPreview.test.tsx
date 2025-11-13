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
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Mock vscodeApi
const mockVscodeApi = {
  postMessage: jest.fn(),
  onMessage: jest.fn((_event: string, _callback: (data: any) => void) => {
    // Return a dispose function
    return () => {};
  }),
  startSession: jest.fn(),
  endSession: jest.fn(),
  sendChatMessage: jest.fn(),
  setApexDebugging: jest.fn(),
  getAvailableAgents: jest.fn(),
  getTraceData: jest.fn(),
  clearChat: jest.fn(),
  clearMessages: jest.fn(),
  getConfiguration: jest.fn(),
  selectClientApp: jest.fn(),
  onClientAppReady: jest.fn(),
  executeCommand: jest.fn(),
  setSelectedAgentId: jest.fn(),
  loadAgentHistory: jest.fn()
};

jest.mock('../../webview/src/services/vscodeApi', () => ({
  vscodeApi: mockVscodeApi
}));

import AgentPreview from '../../webview/src/components/AgentPreview/AgentPreview';

describe('AgentPreview Error Display', () => {
  const defaultProps = {
    clientAppState: 'none' as const,
    availableClientApps: [],
    onClientAppStateChange: jest.fn(),
    onAvailableClientAppsChange: jest.fn(),
    isSessionTransitioning: false,
    onSessionTransitionSettled: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the onMessage mock - always return a proper dispose function
    mockVscodeApi.onMessage = jest.fn((_event: string, _callback: (data: any) => void) => {
      return jest.fn(); // Return a jest mock function as disposer
    });
  });

  it('displays compilation error without "Compilation Error:" prefix', async () => {
    mockVscodeApi.onMessage = jest.fn((event: string, callback: (data: any) => void) => {
      if (event === 'compilationError') {
        setTimeout(() => callback({ message: 'Syntax error on line 5' }), 0);
      }
      return jest.fn(); // Always return a dispose function
    });

    render(
      <AgentPreview
        {...defaultProps}
        selectedAgentId="test-agent"
        pendingAgentId={null}
      />
    );

    await waitFor(() => {
      const errorElements = screen.queryAllByText('Syntax error on line 5');
      expect(errorElements.length).toBeGreaterThan(0);
    });

    // Verify "Compilation Error:" prefix is not present
    expect(screen.queryByText(/Compilation Error: Syntax error on line 5/)).not.toBeInTheDocument();
  });

  it('displays fallback message for compilation error with no message', async () => {
    mockVscodeApi.onMessage = jest.fn((event: string, callback: (data: any) => void) => {
      if (event === 'compilationError') {
        setTimeout(() => callback({ message: '' }), 0);
      }
      return jest.fn(); // Always return a dispose function
    });

    render(
      <AgentPreview
        {...defaultProps}
        selectedAgentId="test-agent"
        pendingAgentId={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to compile agent')).toBeInTheDocument();
    });
  });

  it('displays session error without "Error:" prefix', async () => {
    mockVscodeApi.onMessage = jest.fn((event: string, callback: (data: any) => void) => {
      if (event === 'error') {
        setTimeout(() => callback({ message: 'Connection timeout' }), 0);
      }
      return jest.fn(); // Always return a dispose function
    });

    render(
      <AgentPreview
        {...defaultProps}
        selectedAgentId="test-agent"
        pendingAgentId={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Connection timeout')).toBeInTheDocument();
    });

    // Verify "Error:" prefix is not present
    expect(screen.queryByText(/Error: Connection timeout/)).not.toBeInTheDocument();
  });

  it('displays "Something went wrong" for empty session error message', async () => {
    mockVscodeApi.onMessage = jest.fn((event: string, callback: (data: any) => void) => {
      if (event === 'error') {
        setTimeout(() => callback({ message: '' }), 0);
      }
      return jest.fn(); // Always return a dispose function
    });

    render(
      <AgentPreview
        {...defaultProps}
        selectedAgentId="test-agent"
        pendingAgentId={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  it('displays "Something went wrong" for null session error message', async () => {
    mockVscodeApi.onMessage = jest.fn((event: string, callback: (data: any) => void) => {
      if (event === 'error') {
        setTimeout(() => callback({ message: null }), 0);
      }
      return jest.fn(); // Always return a dispose function
    });

    render(
      <AgentPreview
        {...defaultProps}
        selectedAgentId="test-agent"
        pendingAgentId={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });
});
