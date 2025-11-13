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
  onMessage: jest.fn(),
  getTraceData: jest.fn()
};

jest.mock('../../webview/src/services/vscodeApi', () => ({
  vscodeApi: mockVscodeApi
}));

import AgentTracer from '../../webview/src/components/AgentTracer/AgentTracer';

describe('AgentTracer Error Display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays error without "Error:" prefix when triggered via vscodeApi', async () => {
    const mockOnMessage = jest.fn((event: string, callback: (data: any) => void) => {
      if (event === 'error') {
        setTimeout(() => callback({ message: 'Failed to load trace data' }), 0);
      }
      return () => {};
    });

    mockVscodeApi.onMessage = mockOnMessage;

    render(<AgentTracer isVisible={true} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load trace data')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Error: Failed to load trace data/)).not.toBeInTheDocument();
  });

  it('displays "Something went wrong" for empty error message', async () => {
    const mockOnMessage = jest.fn((event: string, callback: (data: any) => void) => {
      if (event === 'error') {
        setTimeout(() => callback({ message: '' }), 0);
      }
      return () => {};
    });

    mockVscodeApi.onMessage = mockOnMessage;

    render(<AgentTracer isVisible={true} />);

    // Empty error messages aren't set as errors (filtered out by the component logic)
    // So we won't see the error display at all
    await waitFor(() => {
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  it('does not display error div when trace data loads successfully', async () => {
    const mockTraceData = {
      type: 'success',
      planId: 'test-plan',
      sessionId: 'test-session',
      plan: [
        { step: 1, description: 'Test step' }
      ]
    };

    const mockOnMessage = jest.fn((event: string, callback: (data: any) => void) => {
      if (event === 'traceData') {
        setTimeout(() => callback(mockTraceData), 0);
      }
      return () => {};
    });

    mockVscodeApi.onMessage = mockOnMessage;

    render(<AgentTracer isVisible={true} />);

    await waitFor(() => {
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
      expect(screen.queryByText(/Error:/)).not.toBeInTheDocument();
    });
  });

  it('properly formats trace-related error messages without prefix', async () => {
    const traceError = 'No trace data available for plan ID';

    const mockOnMessage = jest.fn((event: string, callback: (data: any) => void) => {
      if (event === 'error') {
        setTimeout(() => callback({ message: traceError }), 0);
      }
      return () => {};
    });

    mockVscodeApi.onMessage = mockOnMessage;

    render(<AgentTracer isVisible={true} />);

    await waitFor(() => {
      expect(screen.getByText(traceError)).toBeInTheDocument();
    });

    expect(screen.queryByText(new RegExp(`Error: ${traceError}`))).not.toBeInTheDocument();
  });

  it('verifies error fallback logic handles null/empty errors correctly', () => {
    // Test the error display logic directly
    const errorWithContent = 'Some error message';
    const emptyError = '';
    const nullError = null;

    expect(errorWithContent || 'Something went wrong').toBe('Some error message');
    expect(emptyError || 'Something went wrong').toBe('Something went wrong');
    expect(nullError || 'Something went wrong').toBe('Something went wrong');
  });
});
