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
import { SplitButton, SplitButtonOption } from '../../webview/src/components/shared/SplitButton';

describe('SplitButton', () => {
  const mockOptions: SplitButtonOption[] = [
    { label: 'Option 1', value: 'option1' },
    { label: 'Option 2', value: 'option2' },
    { label: 'Option 3', value: 'option3', disabled: true }
  ];

  describe('Rendering', () => {
    it('should render the split button with main button text', () => {
      render(
        <SplitButton options={mockOptions}>
          Test Button
        </SplitButton>
      );

      expect(screen.getByText('Test Button')).toBeInTheDocument();
    });

    it('should render with startIcon', () => {
      const icon = <span data-testid="test-icon">Icon</span>;
      render(
        <SplitButton options={mockOptions} startIcon={icon}>
          Test Button
        </SplitButton>
      );

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('should render dropdown trigger button', () => {
      render(
        <SplitButton options={mockOptions}>
          Test Button
        </SplitButton>
      );

      const triggerButton = screen.getByLabelText('Show options');
      expect(triggerButton).toBeInTheDocument();
    });

    it('should render all options in select element', () => {
      render(
        <SplitButton options={mockOptions}>
          Test Button
        </SplitButton>
      );

      expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Option 2' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Option 3' })).toBeInTheDocument();
    });

    it('should disable options when marked as disabled', () => {
      render(
        <SplitButton options={mockOptions}>
          Test Button
        </SplitButton>
      );

      const option3 = screen.getByRole('option', { name: 'Option 3' }) as HTMLOptionElement;
      expect(option3.disabled).toBe(true);
    });
  });

  describe('Main Button Click', () => {
    it('should call onClick when main button is clicked', async () => {
      const onClick = jest.fn();
      render(
        <SplitButton options={mockOptions} onClick={onClick}>
          Test Button
        </SplitButton>
      );

      const mainButton = screen.getByText('Test Button').closest('button')!;
      await userEvent.click(mainButton);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when main button is disabled', async () => {
      const onClick = jest.fn();
      render(
        <SplitButton options={mockOptions} onClick={onClick} disabled>
          Test Button
        </SplitButton>
      );

      const mainButton = screen.getByText('Test Button').closest('button')!;
      expect(mainButton).toBeDisabled();

      // Disabled button won't trigger click
      await userEvent.click(mainButton);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Dropdown Selection', () => {
    it('should call onSelect when an option is selected', async () => {
      const onSelect = jest.fn();
      render(
        <SplitButton options={mockOptions} onSelect={onSelect}>
          Test Button
        </SplitButton>
      );

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, 'option2');

      expect(onSelect).toHaveBeenCalledWith('option2');
    });

    it('should not call onSelect when empty value is selected', async () => {
      const onSelect = jest.fn();
      const optionsWithEmpty = [{ label: '', value: '' }, ...mockOptions];
      render(
        <SplitButton options={optionsWithEmpty} onSelect={onSelect}>
          Test Button
        </SplitButton>
      );

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, '');

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Controlled vs Uncontrolled', () => {
    it('should work as uncontrolled component with defaultValue', () => {
      render(
        <SplitButton options={mockOptions} defaultValue="option2">
          Test Button
        </SplitButton>
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('option2');
    });

    it('should work as controlled component with value prop', () => {
      const { rerender } = render(
        <SplitButton options={mockOptions} value="option1">
          Test Button
        </SplitButton>
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('option1');

      // Rerender with new value
      rerender(
        <SplitButton options={mockOptions} value="option2">
          Test Button
        </SplitButton>
      );

      expect(select.value).toBe('option2');
    });

    it('should update internal state for uncontrolled component on selection', async () => {
      render(
        <SplitButton options={mockOptions} defaultValue="option1">
          Test Button
        </SplitButton>
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('option1');

      await userEvent.selectOptions(select, 'option2');
      expect(select.value).toBe('option2');
    });

    it('should not update internal state for controlled component on selection', async () => {
      const onSelect = jest.fn();
      render(
        <SplitButton options={mockOptions} value="option1" onSelect={onSelect}>
          Test Button
        </SplitButton>
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      await userEvent.selectOptions(select, 'option2');

      // Value stays at option1 because it's controlled
      expect(select.value).toBe('option1');
      // But onSelect was called
      expect(onSelect).toHaveBeenCalledWith('option2');
    });
  });

  describe('Dropdown Trigger Button', () => {
    it('should open dropdown when trigger button is clicked', async () => {
      const selectElement = {
        showPicker: jest.fn(),
        focus: jest.fn(),
        click: jest.fn()
      };

      render(
        <SplitButton options={mockOptions}>
          Test Button
        </SplitButton>
      );

      const triggerButton = screen.getByLabelText('Show options');

      // Mock the select ref
      const select = screen.getByRole('combobox');
      Object.defineProperty(select, 'showPicker', {
        value: selectElement.showPicker,
        writable: true
      });

      await userEvent.click(triggerButton);

      expect(selectElement.showPicker).toHaveBeenCalled();
    });

    it('should fall back to focus and click when showPicker is not available', async () => {
      render(
        <SplitButton options={mockOptions}>
          Test Button
        </SplitButton>
      );

      const triggerButton = screen.getByLabelText('Show options');
      const select = screen.getByRole('combobox');

      // Ensure showPicker is undefined
      Object.defineProperty(select, 'showPicker', {
        value: undefined,
        writable: true
      });

      const focusSpy = jest.spyOn(select, 'focus');
      const clickSpy = jest.spyOn(select, 'click');

      await userEvent.click(triggerButton);

      expect(focusSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should not open dropdown when trigger button is disabled', async () => {
      render(
        <SplitButton options={mockOptions} disabled>
          Test Button
        </SplitButton>
      );

      const triggerButton = screen.getByLabelText('Show options');
      expect(triggerButton).toBeDisabled();

      const select = screen.getByRole('combobox');
      const focusSpy = jest.spyOn(select, 'focus');

      await userEvent.click(triggerButton);
      expect(focusSpy).not.toHaveBeenCalled();
    });
  });

  describe('Appearance and Styling', () => {
    it('should apply primary appearance class by default', () => {
      const { container } = render(
        <SplitButton options={mockOptions}>
          Test Button
        </SplitButton>
      );

      const splitButton = container.querySelector('.vscode-split-button');
      expect(splitButton).toHaveClass('vscode-split-button--primary');
    });

    it('should apply secondary appearance class when specified', () => {
      const { container } = render(
        <SplitButton options={mockOptions} appearance="secondary">
          Test Button
        </SplitButton>
      );

      const splitButton = container.querySelector('.vscode-split-button');
      expect(splitButton).toHaveClass('vscode-split-button--secondary');
    });

    it('should apply small size class when specified', () => {
      const { container } = render(
        <SplitButton options={mockOptions} size="small">
          Test Button
        </SplitButton>
      );

      const splitButton = container.querySelector('.vscode-split-button');
      expect(splitButton).toHaveClass('vscode-split-button--small');
    });

    it('should apply disabled class when disabled', () => {
      const { container } = render(
        <SplitButton options={mockOptions} disabled>
          Test Button
        </SplitButton>
      );

      const splitButton = container.querySelector('.vscode-split-button');
      expect(splitButton).toHaveClass('vscode-split-button--disabled');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <SplitButton options={mockOptions} className="custom-class">
          Test Button
        </SplitButton>
      );

      const splitButton = container.querySelector('.vscode-split-button');
      expect(splitButton).toHaveClass('custom-class');
    });
  });

  describe('Disabled State', () => {
    it('should disable all buttons when disabled prop is true', () => {
      render(
        <SplitButton options={mockOptions} disabled>
          Test Button
        </SplitButton>
      );

      const mainButton = screen.getByText('Test Button').closest('button')!;
      const triggerButton = screen.getByLabelText('Show options');
      const select = screen.getByRole('combobox');

      expect(mainButton).toBeDisabled();
      expect(triggerButton).toBeDisabled();
      expect(select).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label for dropdown trigger', () => {
      render(
        <SplitButton options={mockOptions}>
          Test Button
        </SplitButton>
      );

      const triggerButton = screen.getByLabelText('Show options');
      expect(triggerButton).toHaveAttribute('aria-label', 'Show options');
    });

    it('should use button text for select aria-label when children is string', () => {
      render(
        <SplitButton options={mockOptions}>
          Test Button
        </SplitButton>
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-label', 'Test Button');
    });

    it('should use default aria-label for select when children is not string', () => {
      render(
        <SplitButton options={mockOptions}>
          <span>Complex Content</span>
        </SplitButton>
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-label', 'Split button');
    });
  });
});
