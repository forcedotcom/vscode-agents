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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '../../webview/src/components/shared/ErrorBoundary';

// Component that throws an error for testing
const ThrowingComponent: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Normal content</div>;
};

// Suppress console.error for expected errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  describe('Normal Rendering', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      );
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display fallback UI when a child throws an error', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
    });

    it('should log error to console when error is caught', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Recovery', () => {
    it('should reset error state when Go Back button is clicked', async () => {
      // Use a stateful component to control when errors are thrown
      let shouldThrow = true;
      const ControlledComponent: React.FC = () => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <div>Normal content</div>;
      };

      const { rerender } = render(
        <ErrorBoundary>
          <ControlledComponent />
        </ErrorBoundary>
      );

      // Verify error state
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();

      // Stop throwing errors before clicking button
      shouldThrow = false;

      // Click Go Back - this resets the error state and re-renders children
      await userEvent.click(screen.getByRole('button', { name: 'Go Back' }));

      // Force a re-render to pick up the new shouldThrow value
      rerender(
        <ErrorBoundary>
          <ControlledComponent />
        </ErrorBoundary>
      );

      // Verify recovery - now showing normal content
      expect(screen.getByText('Normal content')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
    });
  });

  describe('Fallback UI Structure', () => {
    it('should display the error icon element', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(container.querySelector('.error-boundary-icon')).toBeInTheDocument();
    });
  });
});
