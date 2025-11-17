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
import { Button } from '../../webview/src/components/shared/Button';

describe('Button', () => {
  describe('Rendering', () => {
    it('should render button with text', () => {
      render(<Button>Click Me</Button>);
      expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
    });

    it('should render with startIcon', () => {
      const icon = <span data-testid="test-icon">Icon</span>;
      render(<Button startIcon={icon}>Button</Button>);

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
      expect(screen.getByText('Button')).toBeInTheDocument();
    });
  });

  describe('Appearance', () => {
    it('should apply primary appearance class by default', () => {
      const { container } = render(<Button>Primary</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('vscode-button--primary');
    });

    it('should apply secondary appearance class when specified', () => {
      const { container } = render(<Button appearance="secondary">Secondary</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('vscode-button--secondary');
    });

    it('should apply icon appearance class when specified', () => {
      const { container } = render(<Button appearance="icon">Icon</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('vscode-button--icon');
    });
  });

  describe('Size', () => {
    it('should apply default size by default', () => {
      const { container } = render(<Button>Default Size</Button>);
      const button = container.querySelector('button');
      expect(button).not.toHaveClass('vscode-button--small');
    });

    it('should apply small size class when specified', () => {
      const { container } = render(<Button size="small">Small</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('vscode-button--small');
    });
  });

  describe('Custom Props', () => {
    it('should apply custom className', () => {
      const { container } = render(<Button className="custom-class">Button</Button>);
      const button = container.querySelector('button');
      expect(button).toHaveClass('custom-class');
    });

    it('should forward other button props', () => {
      render(<Button disabled data-testid="test-button">Disabled</Button>);
      const button = screen.getByTestId('test-button');
      expect(button).toBeDisabled();
    });

    it('should handle onClick events', async () => {
      const onClick = jest.fn();
      render(<Button onClick={onClick}>Click Me</Button>);

      const button = screen.getByRole('button', { name: 'Click Me' });
      await userEvent.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Ref Forwarding', () => {
    it('should forward ref to button element', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Button ref={ref}>Button</Button>);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      expect(ref.current?.tagName).toBe('BUTTON');
    });
  });
});
