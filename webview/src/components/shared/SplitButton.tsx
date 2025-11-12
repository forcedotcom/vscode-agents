// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './SplitButton.css';

export type ButtonAppearance = 'primary' | 'secondary' | 'icon';
export type ButtonSize = 'normal' | 'small';

export interface SplitButtonOption {
	/**
	 * The label to display for this option
	 */
	label: string;
	/**
	 * The value of this option
	 */
	value: string;
	/**
	 * Whether this option is disabled
	 */
	disabled?: boolean;
}

export interface SplitButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onSelect' | 'size'> {
	/**
	 * The appearance of the button
	 */
	appearance?: ButtonAppearance;
	/**
	 * The size of the button
	 */
	size?: ButtonSize;
	/**
	 * The options to display in the dropdown
	 */
	options: SplitButtonOption[];
	/**
	 * Callback when an option is selected
	 */
	onSelect?: (value: string) => void;
	/**
	 * Callback when the main button is clicked
	 */
	onClick?: () => void;
	/**
	 * The currently selected value (for controlled component)
	 */
	value?: string;
	/**
	 * The default selected value (for uncontrolled component)
	 */
	defaultValue?: string;
	/**
	 * Content to display before the button text (e.g., icons)
	 */
	startIcon?: React.ReactNode;
}

/**
 * A split button component with dropdown options.
 *
 * @remarks
 * A button split into two parts: a main action button and a dropdown trigger.
 * Uses native HTML select element for system-native dropdown behavior.
 *
 * @public
 */
export const SplitButton = React.forwardRef<HTMLDivElement, SplitButtonProps>(
	({
		appearance = 'primary',
		size = 'normal',
		options,
		onSelect,
		onClick,
		children,
		className,
		disabled,
		value: controlledValue,
		defaultValue,
		startIcon,
		...props
	}, ref) => {
		const selectRef = React.useRef<HTMLSelectElement>(null);
		const [internalValue, setInternalValue] = React.useState(defaultValue || '');

		// Use controlled value if provided, otherwise use internal state
		const currentValue = controlledValue !== undefined ? controlledValue : internalValue;

		// Find the selected option to display its label
		const selectedOption = options.find(opt => opt.value === currentValue);
		const displayText = selectedOption ? selectedOption.label : children;

		const handleMainButtonClick = () => {
			if (!disabled && onClick) {
				onClick();
			}
		};

		const handleDropdownClick = () => {
			if (!disabled && selectRef.current) {
				// Programmatically open the select dropdown
				selectRef.current.showPicker?.();
			}
		};

		const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
			const value = e.target.value;
			if (value) {
				// Update internal state if uncontrolled
				if (controlledValue === undefined) {
					setInternalValue(value);
				}
				// Call the onSelect callback
				if (onSelect) {
					onSelect(value);
				}
			}
		};

		const containerClass = [
			'vscode-split-button',
			`vscode-split-button--${appearance}`,
			size === 'small' && 'vscode-split-button--small',
			disabled && 'vscode-split-button--disabled',
			className
		].filter(Boolean).join(' ');

		// Chevron icon SVG
		const chevronIcon = (
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				xmlns="http://www.w3.org/2000/svg"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"
				/>
			</svg>
		);

		return (
			<div ref={ref} className={containerClass}>
				<button
					className="vscode-split-button__main"
					onClick={handleMainButtonClick}
					disabled={disabled}
					type="button"
					{...props}
				>
					{startIcon && <span className="vscode-split-button__start">{startIcon}</span>}
					<span className="vscode-split-button__content">{displayText}</span>
				</button>
				<div className="vscode-split-button__divider" />
				<button
					className="vscode-split-button__trigger"
					onClick={handleDropdownClick}
					disabled={disabled}
					aria-label="Show options"
					type="button"
				>
					{chevronIcon}
				</button>
				<select
					ref={selectRef}
					className="vscode-split-button__select"
					onChange={handleSelectChange}
					disabled={disabled}
					value={currentValue}
					aria-label={typeof children === 'string' ? children : 'Split button'}
				>
					{options.map((option) => (
						<option
							key={option.value}
							value={option.value}
							disabled={option.disabled}
						>
							{option.label}
						</option>
					))}
				</select>
			</div>
		);
	}
);

SplitButton.displayName = 'SplitButton';
