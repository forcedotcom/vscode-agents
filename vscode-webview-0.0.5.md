This file is a merged representation of a subset of the codebase, containing specifically included files, combined into a single document by Repomix.

# File Summary

## Purpose

This file contains a packed representation of a subset of the repository's contents that is considered the most important context.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format

The content is organized as follows:

1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
   a. A header with the file path (## File: path/to/file)
   b. The full contents of the file in a code block

## Usage Guidelines

- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes

- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: src/\*_/_.{tsx,css}
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure

```
src/
  badge/
    Badge.css
    Badge.tsx
  button/
    Button.css
    Button.tsx
    SplitButton.css
    SplitButton.tsx
  card/
    Card.css
    Card.tsx
  checkbox/
    Checkbox.css
    Checkbox.tsx
  checkbox-group/
    CheckboxGroup.css
    CheckboxGroup.tsx
  code-block/
    CodeBlock.css
    CodeBlock.tsx
  data-grid/
    DataGrid.css
    DataGrid.tsx
  divider/
    Divider.css
    Divider.tsx
  dropdown/
    Dropdown.css
    Dropdown.tsx
  link/
    Link.css
    Link.tsx
  option/
    Option.css
    Option.tsx
  panels/
    Panels.css
    Panels.tsx
  progress-bar/
    ProgressBar.css
    ProgressBar.tsx
  progress-ring/
    ProgressRing.css
    ProgressRing.tsx
  radio/
    Radio.css
    Radio.tsx
  radio-group/
    RadioGroup.css
    RadioGroup.tsx
  segmented-control/
    SegmentedControl.css
    SegmentedControl.tsx
  tag/
    Tag.css
    Tag.tsx
  text-area/
    TextArea.css
    TextArea.tsx
  text-field/
    TextField.css
    TextField.tsx
  timeline/
    Timeline.css
    Timeline.tsx
  toggle/
    Toggle.css
    Toggle.tsx
```

# Files

## File: src/badge/Badge.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-badge {
  display: inline-flex;
  box-sizing: border-box;
  font-family: var(--vscode-font-family);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  align-items: center;
  background-color: var(--vscode-badge-background);
  border: 1px solid var(--vscode-button-border, transparent);
  border-radius: 11px;
  color: var(--vscode-badge-foreground);
  height: 16px;
  justify-content: center;
  min-width: 18px;
  min-height: 18px;
  padding: 3px 6px;
}
```

## File: src/badge/Badge.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Badge.css';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
	/**
	 * Content to display in the badge (typically a number or short text)
	 */
	children?: React.ReactNode;
}

/**
 * The Visual Studio Code badge component.
 *
 * @remarks
 * A standalone React badge component that inherits from VSCode theme colors.
 * Badges are always circular/pill-shaped.
 *
 * @public
 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
	({ children, className, ...props }, ref) => {
		const badgeClass = [
			'vscode-badge',
			className
		].filter(Boolean).join(' ');

		return (
			<span ref={ref} className={badgeClass} {...props}>
				{children}
			</span>
		);
	}
);

Badge.displayName = 'Badge';
```

## File: src/button/Button.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-button {
  display: inline-flex;
  outline: none;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  line-height: normal;
  color: var(--vscode-button-foreground);
  background: var(--vscode-button-background);
  border-radius: 2px;
  fill: currentColor;
  cursor: pointer;
  border: 1px solid var(--vscode-button-border, transparent);
  padding: 4px 11px;
  box-sizing: border-box;
  justify-content: center;
  align-items: center;
  white-space: wrap;
  text-decoration: none;
}

.vscode-button:hover {
  background: var(--vscode-button-hoverBackground);
}

.vscode-button:active {
  background: var(--vscode-button-background);
}

.vscode-button:focus-visible {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: 2px;
}

.vscode-button::-moz-focus-inner {
  border: 0;
}

.vscode-button:disabled {
  opacity: 0.4;
  background: var(--vscode-button-background);
  cursor: not-allowed;
}

.vscode-button__content {
  display: flex;
}

.vscode-button__start {
  display: flex;
  margin-inline-end: 8px;
}

.vscode-button__start svg,
.vscode-button__start span {
  width: 16px;
  height: 16px;
}

/* Primary Button Styles */
.vscode-button--primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.vscode-button--primary:hover {
  background: var(--vscode-button-hoverBackground);
}

.vscode-button--primary:active {
  background: var(--vscode-button-background);
}

.vscode-button--primary:focus-visible {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: 2px;
}

.vscode-button--primary:disabled {
  background: var(--vscode-button-background);
}

/* Secondary Button Styles */
.vscode-button--secondary {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

.vscode-button--secondary:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

.vscode-button--secondary:active {
  background: var(--vscode-button-secondaryBackground);
}

.vscode-button--secondary:focus-visible {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: 2px;
}

.vscode-button--secondary:disabled {
  background: var(--vscode-button-secondaryBackground);
}

/* Icon Button Styles */
.vscode-button--icon {
  background: transparent;
  border-radius: 5px;
  color: var(--vscode-foreground);
  padding: 3px;
  border: none;
}

.vscode-button--icon:hover {
  background: rgba(90, 93, 94, 0.31);
  outline: 1px dotted var(--vscode-contrastActiveBorder);
  outline-offset: -1px;
}

.vscode-button--icon:active {
  background: rgba(90, 93, 94, 0.31);
}

.vscode-button--icon:focus-visible {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: 0;
}

.vscode-button--icon:disabled {
  background: transparent;
}
```

## File: src/button/Button.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Button.css';

/**
 * Types of button appearance.
 * @public
 */
export type ButtonAppearance = 'primary' | 'secondary' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/**
	 * The appearance the button should have.
	 */
	appearance?: ButtonAppearance;
	/**
	 * Content to display before the button text (e.g., icons)
	 */
	startIcon?: React.ReactNode;
}

/**
 * The Visual Studio Code button component.
 *
 * @remarks
 * A standalone React button component that inherits from VSCode theme colors.
 *
 * @public
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ appearance = 'primary', startIcon, children, className, ...props }, ref) => {
		const buttonClass = [
			'vscode-button',
			`vscode-button--${appearance}`,
			className
		].filter(Boolean).join(' ');

		return (
			<button
				ref={ref}
				className={buttonClass}
				{...props}
			>
				{startIcon && <span className="vscode-button__start">{startIcon}</span>}
				<span className="vscode-button__content">{children}</span>
			</button>
		);
	}
);

Button.displayName = 'Button';
```

## File: src/card/Card.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-card {
  background: var(--vscode-panel-background);
  padding: 20px;
  border-radius: 4px;
  margin-top: 20px;
  border: 1px solid var(--vscode-panel-border);
}

.vscode-card__title {
  color: var(--vscode-foreground);
  margin-top: 0;
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
}
```

## File: src/card/Card.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Card.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * Optional title for the card
	 */
	title?: string;
}

/**
 * The Visual Studio Code card component.
 *
 * @remarks
 * A standalone React card component that inherits from VSCode theme colors.
 * Provides a contained, elevated surface for grouping related content.
 *
 * @public
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
	({ title, children, className, ...props }, ref) => {
		const cardClass = [
			'vscode-card',
			className
		].filter(Boolean).join(' ');

		return (
			<div
				ref={ref}
				className={cardClass}
				{...props}
			>
				{title && <h2 className="vscode-card__title">{title}</h2>}
				{children}
			</div>
		);
	}
);

Card.displayName = 'Card';
```

## File: src/checkbox/Checkbox.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-checkbox {
  display: inline-flex;
  align-items: center;
  outline: none;
  margin: 4px 0;
  user-select: none;
  font-size: var(--vscode-font-size);
  line-height: normal;
  cursor: pointer;
}

.vscode-checkbox__control {
  position: relative;
  width: 18px;
  height: 18px;
  box-sizing: border-box;
  border-radius: 3px;
  border: 1px solid var(--vscode-checkbox-border);
  background: var(--vscode-checkbox-background);
  outline: none;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.vscode-checkbox__input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
}

.vscode-checkbox__label {
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
  padding-inline-start: 10px;
  margin-inline-end: 10px;
  cursor: pointer;
}

.vscode-checkbox__checked-indicator {
  width: 100%;
  height: 100%;
  min-width: 16px;
  min-height: 16px;
  display: block;
  fill: var(--vscode-checkbox-foreground);
  opacity: 0;
  pointer-events: none;
}

.vscode-checkbox__indeterminate-indicator {
  border-radius: 2px;
  background: var(--vscode-checkbox-foreground);
  position: absolute;
  top: 50%;
  left: 50%;
  width: 50%;
  height: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  pointer-events: none;
}

.vscode-checkbox__input:hover + .vscode-checkbox__checked-indicator,
.vscode-checkbox__input:hover ~ .vscode-checkbox__indeterminate-indicator {
  /* Hover styles handled by control background */
}

.vscode-checkbox:hover .vscode-checkbox__control {
  background: var(--vscode-checkbox-background);
  border-color: var(--vscode-checkbox-border);
}

.vscode-checkbox__input:active ~ .vscode-checkbox__checked-indicator,
.vscode-checkbox__input:active ~ .vscode-checkbox__indeterminate-indicator {
  /* Active styles handled by control border */
}

.vscode-checkbox:active .vscode-checkbox__control {
  background: var(--vscode-checkbox-background);
  border-color: var(--vscode-focusBorder);
}

.vscode-checkbox__input:focus-visible ~ .vscode-checkbox__checked-indicator,
.vscode-checkbox__input:focus-visible ~ .vscode-checkbox__indeterminate-indicator {
  /* Focus styles handled by control border */
}

.vscode-checkbox:has(.vscode-checkbox__input:focus-visible) .vscode-checkbox__control {
  border: 1px solid var(--vscode-focusBorder);
}

.vscode-checkbox--checked:not(.vscode-checkbox--indeterminate) .vscode-checkbox__checked-indicator,
.vscode-checkbox--indeterminate .vscode-checkbox__indeterminate-indicator {
  opacity: 1;
}

.vscode-checkbox--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.vscode-checkbox--disabled .vscode-checkbox__label,
.vscode-checkbox--disabled .vscode-checkbox__input {
  cursor: not-allowed;
}
```

## File: src/checkbox/Checkbox.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Checkbox.css';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
	/**
	 * Label text for the checkbox
	 */
	label?: string;
	/**
	 * Whether the checkbox is in an indeterminate state
	 */
	indeterminate?: boolean;
}

/**
 * The Visual Studio Code checkbox component.
 *
 * @remarks
 * A standalone React checkbox component that inherits from VSCode theme colors.
 *
 * @public
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
	({ label, indeterminate = false, className, children, ...props }, ref) => {
		const checkboxRef = React.useRef<HTMLInputElement>(null);

		React.useImperativeHandle(ref, () => checkboxRef.current!);

		React.useEffect(() => {
			if (checkboxRef.current) {
				checkboxRef.current.indeterminate = indeterminate;
			}
		}, [indeterminate]);

		const labelClass = [
			'vscode-checkbox',
			props.disabled && 'vscode-checkbox--disabled',
			props.checked && 'vscode-checkbox--checked',
			indeterminate && 'vscode-checkbox--indeterminate',
			className
		].filter(Boolean).join(' ');

		const labelText = label || children;

		return (
			<label className={labelClass}>
				<div className="vscode-checkbox__control">
					<input
						ref={checkboxRef}
						type="checkbox"
						className="vscode-checkbox__input"
						{...props}
					/>
					<svg
						className="vscode-checkbox__checked-indicator"
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
							d="M14.431 3.323l-8.47 10-.79-.036-3.35-4.77.818-.574 2.978 4.24 8.051-9.506.764.646z"
						/>
					</svg>
					<div className="vscode-checkbox__indeterminate-indicator" aria-hidden="true"></div>
				</div>
				{labelText && (
					<span className="vscode-checkbox__label">{labelText}</span>
				)}
			</label>
		);
	}
);

Checkbox.displayName = 'Checkbox';
```

## File: src/checkbox-group/CheckboxGroup.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-checkbox-group {
  display: flex;
  align-items: flex-start;
  margin: 4px 0;
  flex-direction: column;
}

.vscode-checkbox-group__positioning-region {
  display: flex;
  flex-wrap: wrap;
}

.vscode-checkbox-group--vertical .vscode-checkbox-group__positioning-region {
  flex-direction: column;
}

.vscode-checkbox-group--horizontal .vscode-checkbox-group__positioning-region {
  flex-direction: row;
}

.vscode-checkbox-group__label {
  color: var(--vscode-foreground);
  font-size: var(--vscode-font-size);
  margin: 4px 0;
}
```

## File: src/checkbox-group/CheckboxGroup.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './CheckboxGroup.css';

export type CheckboxGroupOrientation = 'horizontal' | 'vertical';

export interface CheckboxGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
	/**
	 * Label text for the checkbox group
	 */
	label?: string;
	/**
	 * Orientation of the checkbox group
	 */
	orientation?: CheckboxGroupOrientation;
	/**
	 * The name attribute for all checkboxes in the group
	 */
	name?: string;
	/**
	 * Array of currently selected values
	 */
	value?: string[];
	/**
	 * Callback fired when the selected values change
	 */
	onChange?: (values: string[]) => void;
}

/**
 * The Visual Studio Code checkbox group component.
 *
 * @remarks
 * A standalone React checkbox group component that inherits from VSCode theme colors.
 * Contains and manages a group of checkboxes with multiple selection support.
 *
 * @public
 */
export const CheckboxGroup = React.forwardRef<HTMLDivElement, CheckboxGroupProps>(
	({ label, orientation = 'vertical', name, value = [], onChange, children, className, ...props }, ref) => {
		const labelId = React.useId();

		const rootClass = [
			'vscode-checkbox-group',
			`vscode-checkbox-group--${orientation}`,
			className
		].filter(Boolean).join(' ');

		const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
			if (onChange) {
				const checkboxValue = event.target.value;
				const isChecked = event.target.checked;

				let newValues: string[];
				if (isChecked) {
					// Add value to array
					newValues = [...value, checkboxValue];
				} else {
					// Remove value from array
					newValues = value.filter(v => v !== checkboxValue);
				}

				onChange(newValues);
			}
		};

		// Clone children to inject checked and onChange props
		const enhancedChildren = React.Children.map(children, (child) => {
			if (React.isValidElement(child)) {
				// Check if this is a Checkbox component or checkbox input
				const isCheckbox = (child.type as any)?.displayName === 'Checkbox' ||
					(child.type === 'input' && (child.props as any).type === 'checkbox');

				if (isCheckbox && child.props.value) {
					return React.cloneElement(child as React.ReactElement<any>, {
						name: name || child.props.name,
						checked: value.includes(child.props.value),
						onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
							handleChange(e);
							if (child.props.onChange) {
								child.props.onChange(e);
							}
						}
					});
				}
			}
			return child;
		});

		return (
			<div
				ref={ref}
				className={rootClass}
				role="group"
				aria-labelledby={label ? labelId : undefined}
				{...props}
			>
				{label && (
					<label id={labelId} className="vscode-checkbox-group__label">
						{label}
					</label>
				)}
				<div className="vscode-checkbox-group__positioning-region">
					{enhancedChildren}
				</div>
			</div>
		);
	}
);

CheckboxGroup.displayName = 'CheckboxGroup';
```

## File: src/divider/Divider.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-divider {
  display: block;
  border: none;
  border-top: 1px solid var(--vscode-settings-dropdownListBorder);
  box-sizing: content-box;
  height: 0;
  margin: 4px 0;
  width: 100%;
}
```

## File: src/divider/Divider.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Divider.css';

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
	/**
	 * The role of the divider (separator or presentation)
	 */
	role?: 'separator' | 'presentation';
}

/**
 * The Visual Studio Code divider component.
 *
 * @remarks
 * A standalone React divider component that inherits from VSCode theme colors.
 *
 * @public
 */
export const Divider = React.forwardRef<HTMLHRElement, DividerProps>(
	({ role = 'separator', className, ...props }, ref) => {
		const dividerClass = [
			'vscode-divider',
			className
		].filter(Boolean).join(' ');

		return (
			<hr
				ref={ref}
				role={role}
				className={dividerClass}
				{...props}
			/>
		);
	}
);

Divider.displayName = 'Divider';
```

## File: src/dropdown/Dropdown.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-dropdown {
  display: inline-block;
  font-family: var(--vscode-font-family);
  outline: none;
  user-select: none;
}

.vscode-dropdown__control-wrapper {
  display: inline-flex;
  background: var(--vscode-dropdown-background);
  border-radius: 2px;
  box-sizing: border-box;
  color: var(--vscode-foreground);
  position: relative;
  height: 26px;
  min-width: 100px;
  align-items: center;
  border: 1px solid var(--vscode-dropdown-border);
  padding: 2px 6px 2px 8px;
}

.vscode-dropdown__control {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background: transparent;
  border: none;
  box-sizing: border-box;
  color: inherit;
  cursor: pointer;
  flex: 1 1 auto;
  font-family: inherit;
  font-size: var(--vscode-font-size);
  line-height: normal;
  min-height: 100%;
  outline: none;
  overflow: hidden;
  padding: 0;
  text-align: start;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.vscode-dropdown__control::-ms-expand {
  display: none;
}

.vscode-dropdown__label {
  display: block;
  color: var(--vscode-foreground);
  cursor: pointer;
  font-size: var(--vscode-font-size);
  line-height: normal;
  margin-bottom: 2px;
}

.vscode-dropdown__indicator {
  flex: 0 0 auto;
  margin-inline-start: 1em;
  fill: currentcolor;
  height: 1em;
  min-height: 16px;
  min-width: 16px;
  width: 1em;
  pointer-events: none;
}

.vscode-dropdown__start,
.vscode-dropdown__end {
  display: flex;
  margin: auto;
  fill: currentcolor;
  height: 1em;
  min-height: 16px;
  min-width: 16px;
  width: 1em;
}

.vscode-dropdown__start {
  margin-inline-end: 8px;
}

.vscode-dropdown__end {
  margin-inline-start: auto;
}

.vscode-dropdown:not(.vscode-dropdown--disabled):hover .vscode-dropdown__control-wrapper {
  background: var(--vscode-dropdown-background);
  border-color: var(--vscode-dropdown-border);
}

.vscode-dropdown:has(.vscode-dropdown__control:focus-visible) .vscode-dropdown__control-wrapper {
  border-color: var(--vscode-focusBorder);
}

.vscode-dropdown:not(.vscode-dropdown--disabled):active .vscode-dropdown__control-wrapper {
  border-color: var(--vscode-focusBorder);
}

.vscode-dropdown--disabled {
  opacity: 0.4;
}

.vscode-dropdown--disabled .vscode-dropdown__control {
  cursor: not-allowed;
  user-select: none;
}

.vscode-dropdown--disabled:hover .vscode-dropdown__control-wrapper {
  background: var(--vscode-dropdown-background);
  color: var(--vscode-foreground);
  fill: currentcolor;
}
```

## File: src/dropdown/Dropdown.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Dropdown.css';

export interface DropdownProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
	/**
	 * Label text for the dropdown
	 */
	label?: string;
	/**
	 * Content to display at the start of the dropdown (e.g., icons)
	 */
	startIcon?: React.ReactNode;
	/**
	 * Content to display at the end of the dropdown (e.g., icons)
	 */
	endIcon?: React.ReactNode;
}

/**
 * The Visual Studio Code dropdown component.
 *
 * @remarks
 * A standalone React dropdown (select) component that inherits from VSCode theme colors.
 *
 * @public
 */
export const Dropdown = React.forwardRef<HTMLSelectElement, DropdownProps>(
	({ label, startIcon, endIcon, children, className, disabled, ...props }, ref) => {
		const rootClass = [
			'vscode-dropdown',
			disabled && 'vscode-dropdown--disabled',
			className
		].filter(Boolean).join(' ');

		return (
			<div className={rootClass}>
				{label && (
					<label className="vscode-dropdown__label">
						{label}
					</label>
				)}
				<div className="vscode-dropdown__control-wrapper">
					{startIcon && (
						<span className="vscode-dropdown__start">{startIcon}</span>
					)}
					<select
						ref={ref}
						className="vscode-dropdown__control"
						disabled={disabled}
						{...props}
					>
						{children}
					</select>
					{endIcon && (
						<span className="vscode-dropdown__end">{endIcon}</span>
					)}
					<svg
						className="vscode-dropdown__indicator"
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
				</div>
			</div>
		);
	}
);

Dropdown.displayName = 'Dropdown';
```

## File: src/link/Link.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-link {
  display: inline-flex;
  background: transparent;
  box-sizing: border-box;
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
  fill: currentcolor;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  line-height: normal;
  outline: none;
  border: 1px solid transparent;
  border-radius: 0;
  padding: 0;
  text-decoration: none;
  word-break: break-word;
}

.vscode-link::-moz-focus-inner {
  border: 0;
}

.vscode-link:hover {
  color: var(--vscode-textLink-activeForeground);
}

.vscode-link:hover .vscode-link__content {
  text-decoration: underline;
}

.vscode-link:active {
  background: transparent;
  color: var(--vscode-textLink-activeForeground);
}

.vscode-link:focus-visible,
.vscode-link:focus {
  border: 1px solid var(--vscode-focusBorder);
}

.vscode-link__content {
  display: inline;
}
```

## File: src/link/Link.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Link.css';

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
	/**
	 * The URL to link to
	 */
	href?: string;
}

/**
 * The Visual Studio Code link component.
 *
 * @remarks
 * A standalone React link component that inherits from VSCode theme colors.
 *
 * @public
 */
export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
	({ children, className, ...props }, ref) => {
		const linkClass = [
			'vscode-link',
			className
		].filter(Boolean).join(' ');

		return (
			<a
				ref={ref}
				className={linkClass}
				{...props}
			>
				<span className="vscode-link__content">{children}</span>
			</a>
		);
	}
);

Link.displayName = 'Link';
```

## File: src/option/Option.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-option {
  font-family: var(--vscode-font-family);
  border-radius: 0;
  border: 1px solid transparent;
  box-sizing: border-box;
  color: var(--vscode-foreground);
  cursor: pointer;
  fill: currentcolor;
  font-size: var(--vscode-font-size);
  line-height: normal;
  margin: 0;
  outline: none;
  overflow: hidden;
  padding: 0 2px 1px;
  user-select: none;
  white-space: nowrap;
}

.vscode-option:focus-visible {
  border-color: var(--vscode-focusBorder);
  background: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-foreground);
}

.vscode-option:checked {
  background: var(--vscode-list-activeSelectionBackground);
  border: 1px solid transparent;
  color: var(--vscode-list-activeSelectionForeground);
}

.vscode-option:active {
  background: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
}

.vscode-option:not(:checked):hover {
  background: var(--vscode-list-activeSelectionBackground);
  border: 1px solid transparent;
  color: var(--vscode-list-activeSelectionForeground);
}

.vscode-option:not(:checked):active {
  background: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-foreground);
}

.vscode-option:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.vscode-option:disabled:hover {
  background-color: inherit;
}
```

## File: src/option/Option.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Option.css';

export interface OptionProps extends React.OptionHTMLAttributes<HTMLOptionElement> {
	/**
	 * The value of the option
	 */
	value?: string;
}

/**
 * The Visual Studio Code option component.
 *
 * @remarks
 * A standalone React option component that inherits from VSCode theme colors.
 * Should be used within a Dropdown/Select component.
 *
 * @public
 */
export const Option = React.forwardRef<HTMLOptionElement, OptionProps>(
	({ children, className, ...props }, ref) => {
		const optionClass = [
			'vscode-option',
			className
		].filter(Boolean).join(' ');

		return (
			<option
				ref={ref}
				className={optionClass}
				{...props}
			>
				{children}
			</option>
		);
	}
);

Option.displayName = 'Option';
```

## File: src/panels/Panels.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Panels.css';

export interface PanelsProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * The currently active tab index
	 */
	activeIndex?: number;
	/**
	 * Callback fired when the active tab changes
	 */
	onActiveIndexChange?: (index: number) => void;
	/**
	 * Accessible label for the panels
	 */
	'aria-label'?: string;
}

/**
 * The Visual Studio Code panels component.
 *
 * @remarks
 * A standalone React panels (tabs) component that inherits from VSCode theme colors.
 * Container for PanelTab and PanelView components.
 *
 * @public
 */
export const Panels = React.forwardRef<HTMLDivElement, PanelsProps>(
	({ activeIndex = 0, onActiveIndexChange, children, className, 'aria-label': ariaLabel = 'Panels', ...props }, ref) => {
		const [activeTab, setActiveTab] = React.useState(activeIndex);
		const tabRefs = React.useRef<(HTMLDivElement | null)[]>([]);
		const [indicatorStyle, setIndicatorStyle] = React.useState({ width: 0, left: 0 });

		React.useEffect(() => {
			setActiveTab(activeIndex);
		}, [activeIndex]);

		React.useEffect(() => {
			const activeTabElement = tabRefs.current[activeTab];
			if (activeTabElement) {
				setIndicatorStyle({
					width: activeTabElement.offsetWidth,
					left: activeTabElement.offsetLeft,
				});
			}
		}, [activeTab]);

		const handleTabClick = (index: number) => {
			setActiveTab(index);
			if (onActiveIndexChange) {
				onActiveIndexChange(index);
			}
		};

		const panelsClass = [
			'vscode-panels',
			className
		].filter(Boolean).join(' ');

		const childrenArray = React.Children.toArray(children);
		const tabs: React.ReactElement[] = [];
		const views: React.ReactElement[] = [];

		childrenArray.forEach((child) => {
			if (React.isValidElement(child)) {
				if (child.type === PanelTab || (child.type as any).displayName === 'PanelTab') {
					tabs.push(child);
				} else if (child.type === PanelView || (child.type as any).displayName === 'PanelView') {
					views.push(child);
				}
			}
		});

		return (
			<div
				ref={ref}
				className={panelsClass}
				role="tablist"
				aria-label={ariaLabel}
				{...props}
			>
				<div className="vscode-panels__tablist">
					<div className="vscode-panels__tabs">
						{tabs.map((tab, index) =>
							React.cloneElement(tab, {
								key: index,
								ref: (el: HTMLDivElement) => (tabRefs.current[index] = el),
								isActive: index === activeTab,
								onClick: () => handleTabClick(index),
								'aria-selected': index === activeTab,
								role: 'tab',
								tabIndex: index === activeTab ? 0 : -1,
							} as any)
						)}
					</div>
					<div
						className="vscode-panels__active-indicator"
						style={{
							width: `${indicatorStyle.width}px`,
							transform: `translateX(${indicatorStyle.left}px)`,
						}}
					/>
				</div>
				<div className="vscode-panels__views">
					{views.map((view, index) =>
						React.cloneElement(view, {
							key: index,
							hidden: index !== activeTab,
							role: 'tabpanel',
							'aria-hidden': index !== activeTab,
						} as any)
					)}
				</div>
			</div>
		);
	}
);

Panels.displayName = 'Panels';

export interface PanelTabProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * Whether this tab is active (managed by Panels)
	 */
	isActive?: boolean;
}

/**
 * The Visual Studio Code panel tab component.
 *
 * @public
 */
export const PanelTab = React.forwardRef<HTMLDivElement, PanelTabProps>(
	({ children, className, isActive, ...props }, ref) => {
		const tabClass = [
			'vscode-panel-tab',
			isActive && 'vscode-panel-tab--active',
			className
		].filter(Boolean).join(' ');

		return (
			<div
				ref={ref}
				className={tabClass}
				{...props}
			>
				{children}
			</div>
		);
	}
);

PanelTab.displayName = 'PanelTab';

export interface PanelViewProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * The Visual Studio Code panel view component.
 *
 * @public
 */
export const PanelView = React.forwardRef<HTMLDivElement, PanelViewProps>(
	({ children, className, ...props }, ref) => {
		const viewClass = [
			'vscode-panel-view',
			className
		].filter(Boolean).join(' ');

		return (
			<div
				ref={ref}
				className={viewClass}
				{...props}
			>
				{children}
			</div>
		);
	}
);

PanelView.displayName = 'PanelView';
```

## File: src/radio/Radio.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-radio {
  display: inline-flex;
  align-items: center;
  flex-direction: row;
  font-size: var(--vscode-font-size);
  line-height: normal;
  margin: 4px 0;
  outline: none;
  position: relative;
  transition: all 0.2s ease-in-out;
  user-select: none;
  cursor: pointer;
}

.vscode-radio__control {
  background: var(--vscode-checkbox-background);
  border-radius: 999px;
  border: 1px solid var(--vscode-checkbox-border);
  box-sizing: border-box;
  cursor: pointer;
  height: 16px;
  position: relative;
  outline: none;
  width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.vscode-radio__input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
}

.vscode-radio__label {
  color: var(--vscode-foreground);
  cursor: pointer;
  font-family: var(--vscode-font-family);
  margin-inline-end: 10px;
  padding-inline-start: 10px;
}

.vscode-radio__checked-indicator {
  background: var(--vscode-checkbox-foreground);
  border-radius: 999px;
  display: inline-block;
  position: absolute;
  inset: 4px;
  opacity: 0;
  pointer-events: none;
  flex-shrink: 0;
}

.vscode-radio:not(.vscode-radio--disabled):hover .vscode-radio__control {
  background: var(--vscode-checkbox-background);
  border-color: var(--vscode-checkbox-border);
}

.vscode-radio:not(.vscode-radio--disabled):active .vscode-radio__control {
  background: var(--vscode-checkbox-background);
  border-color: var(--vscode-focusBorder);
}

.vscode-radio:has(.vscode-radio__input:focus-visible) .vscode-radio__control {
  border: 1px solid var(--vscode-focusBorder);
}

.vscode-radio:has(.vscode-radio__input:checked) .vscode-radio__control {
  background: var(--vscode-checkbox-background);
  border: 1px solid var(--vscode-checkbox-border);
}

.vscode-radio:not(.vscode-radio--disabled):has(.vscode-radio__input:checked):hover .vscode-radio__control {
  background: var(--vscode-checkbox-background);
  border: 1px solid var(--vscode-checkbox-border);
}

.vscode-radio:not(.vscode-radio--disabled):has(.vscode-radio__input:checked):active .vscode-radio__control {
  background: var(--vscode-checkbox-background);
  border: 1px solid var(--vscode-focusBorder);
}

.vscode-radio:has(.vscode-radio__input:checked:focus-visible):not(.vscode-radio--disabled) .vscode-radio__control {
  border: 1px solid var(--vscode-focusBorder);
}

.vscode-radio--disabled .vscode-radio__label,
.vscode-radio--disabled .vscode-radio__input {
  cursor: not-allowed;
}

.vscode-radio:has(.vscode-radio__input:checked) .vscode-radio__checked-indicator {
  opacity: 1;
}

.vscode-radio--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

## File: src/radio/Radio.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Radio.css';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
	/**
	 * Label text for the radio button
	 */
	label?: string;
}

/**
 * The Visual Studio Code radio component.
 *
 * @remarks
 * A standalone React radio button component that inherits from VSCode theme colors.
 * Should typically be used within a RadioGroup component.
 *
 * @public
 */
export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
	({ label, className, children, disabled, ...props }, ref) => {
		const labelClass = [
			'vscode-radio',
			disabled && 'vscode-radio--disabled',
			className
		].filter(Boolean).join(' ');

		const labelText = label || children;

		return (
			<label className={labelClass}>
				<div className="vscode-radio__control">
					<input
						ref={ref}
						type="radio"
						className="vscode-radio__input"
						disabled={disabled}
						{...props}
					/>
					<div className="vscode-radio__checked-indicator" aria-hidden="true"></div>
				</div>
				{labelText && (
					<span className="vscode-radio__label">{labelText}</span>
				)}
			</label>
		);
	}
);

Radio.displayName = 'Radio';
```

## File: src/radio-group/RadioGroup.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-radio-group {
  display: flex;
  align-items: flex-start;
  margin: 4px 0;
  flex-direction: column;
}

.vscode-radio-group__positioning-region {
  display: flex;
  flex-wrap: wrap;
}

.vscode-radio-group--vertical .vscode-radio-group__positioning-region {
  flex-direction: column;
}

.vscode-radio-group--horizontal .vscode-radio-group__positioning-region {
  flex-direction: row;
}

.vscode-radio-group__label {
  color: var(--vscode-foreground);
  font-size: var(--vscode-font-size);
  margin: 4px 0;
}
```

## File: src/radio-group/RadioGroup.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './RadioGroup.css';

export type RadioGroupOrientation = 'horizontal' | 'vertical';

export interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
	/**
	 * Label text for the radio group
	 */
	label?: string;
	/**
	 * Orientation of the radio group
	 */
	orientation?: RadioGroupOrientation;
	/**
	 * The name attribute for all radio buttons in the group
	 */
	name?: string;
	/**
	 * The currently selected value
	 */
	value?: string;
	/**
	 * Callback fired when the selected value changes
	 */
	onChange?: (value: string) => void;
}

/**
 * The Visual Studio Code radio group component.
 *
 * @remarks
 * A standalone React radio group component that inherits from VSCode theme colors.
 * Contains and manages a group of radio buttons.
 *
 * @public
 */
export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
	({ label, orientation = 'vertical', name, value, onChange, children, className, ...props }, ref) => {
		const labelId = React.useId();

		const rootClass = [
			'vscode-radio-group',
			`vscode-radio-group--${orientation}`,
			className
		].filter(Boolean).join(' ');

		const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
			if (onChange) {
				onChange(event.target.value);
			}
		};

		// Clone children to inject name, value, and onChange props
		const enhancedChildren = React.Children.map(children, (child) => {
			if (React.isValidElement(child) && child.type === 'input' && (child.props as any).type === 'radio') {
				return React.cloneElement(child as React.ReactElement<any>, {
					name: name || child.props.name,
					checked: value !== undefined ? child.props.value === value : child.props.checked,
					onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
						handleChange(e);
						if (child.props.onChange) {
							child.props.onChange(e);
						}
					}
				});
			}
			return child;
		});

		return (
			<div
				ref={ref}
				className={rootClass}
				role="radiogroup"
				aria-labelledby={label ? labelId : undefined}
				{...props}
			>
				{label && (
					<label id={labelId} className="vscode-radio-group__label">
						{label}
					</label>
				)}
				<div className="vscode-radio-group__positioning-region">
					{enhancedChildren}
				</div>
			</div>
		);
	}
);

RadioGroup.displayName = 'RadioGroup';
```

## File: src/segmented-control/SegmentedControl.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './SegmentedControl.css';

export interface SegmentedControlOption {
	/**
	 * The value for this option
	 */
	value: string;
	/**
	 * The label text to display
	 */
	label: string;
	/**
	 * Whether this option is disabled
	 */
	disabled?: boolean;
}

export interface SegmentedControlProps {
	/**
	 * The options to display in the segmented control
	 */
	options: SegmentedControlOption[];
	/**
	 * The currently selected value
	 */
	value?: string;
	/**
	 * Callback fired when the selection changes
	 */
	onChange?: (value: string) => void;
	/**
	 * Whether the entire control is disabled
	 */
	disabled?: boolean;
	/**
	 * Additional CSS class name
	 */
	className?: string;
	/**
	 * Name attribute for the radio inputs
	 */
	name?: string;
}

/**
 * The Visual Studio Code segmented control component.
 *
 * @remarks
 * A standalone React segmented control component that allows users to select between
 * multiple options in a toggle-like interface. Each segment displays text and can be
 * clicked to toggle between options.
 *
 * @public
 */
export const SegmentedControl: React.FC<SegmentedControlProps> = ({
	options,
	value,
	onChange,
	disabled = false,
	className,
	name = 'segmented-control'
}) => {
	const handleChange = (optionValue: string) => {
		if (!disabled && onChange) {
			onChange(optionValue);
		}
	};

	const containerClass = [
		'vscode-segmented-control',
		disabled && 'vscode-segmented-control--disabled',
		className
	].filter(Boolean).join(' ');

	return (
		<div className={containerClass} role="radiogroup">
			{options.map((option) => {
				const isSelected = option.value === value;
				const isDisabled = disabled || option.disabled;

				const segmentClass = [
					'vscode-segmented-control__segment',
					isSelected && 'vscode-segmented-control__segment--selected',
					isDisabled && 'vscode-segmented-control__segment--disabled'
				].filter(Boolean).join(' ');

				return (
					<label key={option.value} className={segmentClass}>
						<input
							type="radio"
							name={name}
							value={option.value}
							checked={isSelected}
							disabled={isDisabled}
							onChange={() => handleChange(option.value)}
							className="vscode-segmented-control__input"
							role="radio"
							aria-checked={isSelected}
						/>
						<span className="vscode-segmented-control__label">
							{option.label}
						</span>
					</label>
				);
			})}
		</div>
	);
};

SegmentedControl.displayName = 'SegmentedControl';
```

## File: src/tag/Tag.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-tag {
  display: inline-block;
  box-sizing: border-box;
  font-family: var(--vscode-font-family);
  font-size: 11px;
  line-height: 16px;
  background-color: var(--vscode-badge-background);
  border: 1px solid var(--vscode-button-border, transparent);
  border-radius: 2px;
  color: var(--vscode-badge-foreground);
  padding: 2px 4px;
  text-transform: uppercase;
}
```

## File: src/tag/Tag.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Tag.css';

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
	/**
	 * Content to display in the tag
	 */
	children?: React.ReactNode;
}

/**
 * The Visual Studio Code tag component.
 *
 * @remarks
 * A standalone React tag component that inherits from VSCode theme colors.
 * Tags are rectangular (not circular like badges).
 *
 * @public
 */
export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(
	({ children, className, ...props }, ref) => {
		const tagClass = [
			'vscode-tag',
			className
		].filter(Boolean).join(' ');

		return (
			<span ref={ref} className={tagClass} {...props}>
				{children}
			</span>
		);
	}
);

Tag.displayName = 'Tag';
```

## File: src/text-area/TextArea.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-text-area {
  display: inline-block;
  font-family: var(--vscode-font-family);
  outline: none;
  user-select: none;
}

.vscode-text-area__control {
  box-sizing: border-box;
  position: relative;
  color: var(--vscode-input-foreground);
  background: var(--vscode-input-background);
  border-radius: 2px;
  border: 1px solid var(--vscode-dropdown-border);
  font: inherit;
  font-size: var(--vscode-font-size);
  line-height: normal;
  padding: 9px;
  width: 100%;
  min-width: 100px;
  resize: none;
}

.vscode-text-area__control::placeholder {
  color: var(--vscode-input-placeholderForeground);
}

.vscode-text-area__control:hover:enabled {
  background: var(--vscode-input-background);
  border-color: var(--vscode-dropdown-border);
}

.vscode-text-area__control:active:enabled {
  background: var(--vscode-input-background);
  border-color: var(--vscode-focusBorder);
}

.vscode-text-area__control:hover,
.vscode-text-area__control:focus-visible,
.vscode-text-area__control:disabled,
.vscode-text-area__control:active {
  outline: none;
}

.vscode-text-area__control::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.vscode-text-area__control::-webkit-scrollbar-corner {
  background: var(--vscode-input-background);
}

.vscode-text-area__control::-webkit-scrollbar-thumb {
  background: var(--vscode-scrollbarSlider-background);
}

.vscode-text-area__control::-webkit-scrollbar-thumb:hover {
  background: var(--vscode-scrollbarSlider-hoverBackground);
}

.vscode-text-area__control::-webkit-scrollbar-thumb:active {
  background: var(--vscode-scrollbarSlider-activeBackground);
}

.vscode-text-area:has(.vscode-text-area__control:focus):not(.vscode-text-area--disabled) .vscode-text-area__control {
  border-color: var(--vscode-focusBorder);
}

.vscode-text-area--resize-both .vscode-text-area__control {
  resize: both;
}

.vscode-text-area--resize-horizontal .vscode-text-area__control {
  resize: horizontal;
}

.vscode-text-area--resize-vertical .vscode-text-area__control {
  resize: vertical;
}

.vscode-text-area__label {
  display: block;
  color: var(--vscode-foreground);
  cursor: pointer;
  font-size: var(--vscode-font-size);
  line-height: normal;
  margin-bottom: 2px;
}

.vscode-text-area--disabled .vscode-text-area__label,
.vscode-text-area--readonly .vscode-text-area__label,
.vscode-text-area--readonly .vscode-text-area__control,
.vscode-text-area--disabled .vscode-text-area__control {
  cursor: not-allowed;
}

.vscode-text-area--disabled {
  opacity: 0.4;
}

.vscode-text-area--disabled .vscode-text-area__control {
  border-color: var(--vscode-dropdown-border);
}
```

## File: src/text-area/TextArea.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './TextArea.css';

export type TextAreaResize = 'none' | 'both' | 'horizontal' | 'vertical';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
	/**
	 * Label text for the text area
	 */
	label?: string;
	/**
	 * Resize behavior for the text area
	 */
	resize?: TextAreaResize;
}

/**
 * The Visual Studio Code text area component.
 *
 * @remarks
 * A standalone React text area component that inherits from VSCode theme colors.
 *
 * @public
 */
export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
	({ label, resize = 'none', className, disabled, readOnly, ...props }, ref) => {
		const rootClass = [
			'vscode-text-area',
			disabled && 'vscode-text-area--disabled',
			readOnly && 'vscode-text-area--readonly',
			resize && `vscode-text-area--resize-${resize}`,
			className
		].filter(Boolean).join(' ');

		return (
			<div className={rootClass}>
				{label && (
					<label className="vscode-text-area__label">
						{label}
					</label>
				)}
				<textarea
					ref={ref}
					className="vscode-text-area__control"
					disabled={disabled}
					readOnly={readOnly}
					{...props}
				/>
			</div>
		);
	}
);

TextArea.displayName = 'TextArea';
```

## File: src/text-field/TextField.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-text-field {
  display: inline-block;
  font-family: var(--vscode-font-family);
  outline: none;
  user-select: none;
}

.vscode-text-field__root {
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: row;
  color: var(--vscode-input-foreground);
  background: var(--vscode-input-background);
  border-radius: 2px;
  border: 1px solid var(--vscode-dropdown-border);
  height: 26px;
  min-width: 100px;
}

.vscode-text-field__control {
  -webkit-appearance: none;
  font: inherit;
  background: transparent;
  border: 0;
  color: inherit;
  height: calc(100% - 4px);
  width: 100%;
  margin-top: auto;
  margin-bottom: auto;
  padding: 0 9px;
  font-size: var(--vscode-font-size);
  line-height: normal;
}

.vscode-text-field__control:hover,
.vscode-text-field__control:focus-visible,
.vscode-text-field__control:disabled,
.vscode-text-field__control:active {
  outline: none;
}

.vscode-text-field__control::placeholder {
  color: var(--vscode-input-placeholderForeground);
}

.vscode-text-field__label {
  display: block;
  color: var(--vscode-foreground);
  cursor: pointer;
  font-size: var(--vscode-font-size);
  line-height: normal;
  margin-bottom: 2px;
}

.vscode-text-field__start,
.vscode-text-field__end {
  display: flex;
  margin: auto;
  fill: currentcolor;
}

.vscode-text-field__start svg,
.vscode-text-field__start span,
.vscode-text-field__end svg,
.vscode-text-field__end span {
  width: 16px;
  height: 16px;
}

.vscode-text-field__start {
  margin-inline-start: 8px;
}

.vscode-text-field__end {
  margin-inline-end: 8px;
}

.vscode-text-field:hover:not(.vscode-text-field--disabled) .vscode-text-field__root {
  background: var(--vscode-input-background);
  border-color: var(--vscode-dropdown-border);
}

.vscode-text-field:active:not(.vscode-text-field--disabled) .vscode-text-field__root {
  background: var(--vscode-input-background);
  border-color: var(--vscode-focusBorder);
}

.vscode-text-field:has(.vscode-text-field__control:focus):not(.vscode-text-field--disabled) .vscode-text-field__root {
  border-color: var(--vscode-focusBorder);
}

.vscode-text-field--disabled .vscode-text-field__label,
.vscode-text-field--readonly .vscode-text-field__label,
.vscode-text-field--readonly .vscode-text-field__control,
.vscode-text-field--disabled .vscode-text-field__control {
  cursor: not-allowed;
}

.vscode-text-field--disabled {
  opacity: 0.4;
}

.vscode-text-field--disabled .vscode-text-field__control {
  border-color: var(--vscode-dropdown-border);
}
```

## File: src/text-field/TextField.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './TextField.css';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
	/**
	 * Label text for the text field
	 */
	label?: string;
	/**
	 * Content to display before the input (e.g., icons)
	 */
	startIcon?: React.ReactNode;
	/**
	 * Content to display after the input (e.g., icons)
	 */
	endIcon?: React.ReactNode;
}

/**
 * The Visual Studio Code text field component.
 *
 * @remarks
 * A standalone React text field component that inherits from VSCode theme colors.
 *
 * @public
 */
export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
	({ label, startIcon, endIcon, className, disabled, readOnly, ...props }, ref) => {
		const rootClass = [
			'vscode-text-field',
			disabled && 'vscode-text-field--disabled',
			readOnly && 'vscode-text-field--readonly',
			className
		].filter(Boolean).join(' ');

		return (
			<div className={rootClass}>
				{label && (
					<label className="vscode-text-field__label">
						{label}
					</label>
				)}
				<div className="vscode-text-field__root">
					{startIcon && (
						<span className="vscode-text-field__start">{startIcon}</span>
					)}
					<input
						ref={ref}
						type="text"
						className="vscode-text-field__control"
						disabled={disabled}
						readOnly={readOnly}
						{...props}
					/>
					{endIcon && (
						<span className="vscode-text-field__end">{endIcon}</span>
					)}
				</div>
			</div>
		);
	}
);

TextField.displayName = 'TextField';
```

## File: src/data-grid/DataGrid.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './DataGrid.css';

export interface DataGridProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * Whether to generate headers automatically
	 */
	generateHeader?: boolean;
	/**
	 * Accessible label for the data grid
	 */
	'aria-label'?: string;
	/**
	 * Display variant
	 */
	variant?: 'default' | 'bordered';
}

/**
 * The Visual Studio Code data grid component.
 *
 * @remarks
 * A standalone React data grid component that inherits from VSCode theme colors.
 * Contains DataGridRow and DataGridCell components.
 *
 * @public
 */
export const DataGrid = React.forwardRef<HTMLDivElement, DataGridProps>(
	({ generateHeader, variant = 'default', children, className, 'aria-label': ariaLabel = 'Data Grid', ...props }, ref) => {
		const gridClass = [
			'vscode-data-grid',
			variant === 'bordered' && 'vscode-data-grid--bordered',
			className
		].filter(Boolean).join(' ');

		return (
			<div
				ref={ref}
				className={gridClass}
				role="grid"
				aria-label={ariaLabel}
				{...props}
			>
				{children}
			</div>
		);
	}
);

DataGrid.displayName = 'DataGrid';

export interface DataGridRowProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * The row type (default, header, sticky-header)
	 */
	rowType?: 'default' | 'header' | 'sticky-header';
	/**
	 * Grid template columns CSS value
	 */
	gridTemplateColumns?: string;
}

/**
 * The Visual Studio Code data grid row component.
 *
 * @public
 */
export const DataGridRow = React.forwardRef<HTMLDivElement, DataGridRowProps>(
	({ rowType = 'default', gridTemplateColumns, children, className, style, ...props }, ref) => {
		const rowClass = [
			'vscode-data-grid-row',
			rowType === 'header' && 'vscode-data-grid-row--header',
			rowType === 'sticky-header' && 'vscode-data-grid-row--sticky-header',
			className
		].filter(Boolean).join(' ');

		const rowStyle = {
			...style,
			...(gridTemplateColumns && { gridTemplateColumns }),
		};

		return (
			<div
				ref={ref}
				className={rowClass}
				role="row"
				style={rowStyle}
				{...props}
			>
				{children}
			</div>
		);
	}
);

DataGridRow.displayName = 'DataGridRow';

export interface DataGridCellProps extends React.TdHTMLAttributes<HTMLDivElement> {
	/**
	 * The cell type (default, columnheader, rowheader)
	 */
	cellType?: 'default' | 'columnheader' | 'rowheader';
	/**
	 * Grid column position
	 */
	gridColumn?: string;
}

/**
 * The Visual Studio Code data grid cell component.
 *
 * @public
 */
export const DataGridCell = React.forwardRef<HTMLDivElement, DataGridCellProps>(
	({ cellType = 'default', gridColumn, children, className, style, ...props }, ref) => {
		const cellClass = [
			'vscode-data-grid-cell',
			cellType === 'columnheader' && 'vscode-data-grid-cell--column-header',
			cellType === 'rowheader' && 'vscode-data-grid-cell--row-header',
			className
		].filter(Boolean).join(' ');

		const cellStyle = {
			...style,
			...(gridColumn && { gridColumn }),
		};

		const role = cellType === 'columnheader' ? 'columnheader' : cellType === 'rowheader' ? 'rowheader' : 'gridcell';

		return (
			<div
				ref={ref}
				className={cellClass}
				role={role}
				style={cellStyle}
				tabIndex={-1}
				{...props}
			>
				{children}
			</div>
		);
	}
);

DataGridCell.displayName = 'DataGridCell';
```

## File: src/progress-bar/ProgressBar.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-progress-bar {
  display: flex;
  width: 100%;
  height: 2px;
  background-color: transparent;
  overflow: hidden;
  position: relative;
}

.vscode-progress-bar__indicator {
  height: 100%;
  background-color: var(--vscode-progressBar-background);
  transition: width 0.2s ease-in-out;
}

/* Indeterminate progress bar animation */
.vscode-progress-bar--indeterminate .vscode-progress-bar__indicator {
  width: 30%;
  position: absolute;
  animation: vscode-progress-bar-slide 2s linear infinite;
}

@keyframes vscode-progress-bar-slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(400%);
  }
}
```

## File: src/progress-bar/ProgressBar.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './ProgressBar.css';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * Progress value from 0 to 100
	 */
	value?: number;
	/**
	 * Whether the progress is indeterminate (no specific value)
	 */
	indeterminate?: boolean;
	/**
	 * Accessible label for the progress bar
	 */
	'aria-label'?: string;
}

/**
 * The Visual Studio Code progress bar component.
 *
 * @remarks
 * A standalone React progress bar component that inherits from VSCode theme colors.
 * Can be used as a determinate progress indicator (with value) or indeterminate (loading state).
 *
 * @public
 */
export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
	({
		className,
		value = 0,
		indeterminate = false,
		'aria-label': ariaLabel = 'Progress',
		...props
	}, ref) => {
		const progressClass = [
			'vscode-progress-bar',
			indeterminate && 'vscode-progress-bar--indeterminate',
			className
		].filter(Boolean).join(' ');

		const clampedValue = Math.min(100, Math.max(0, value));
		const progressStyle = !indeterminate ? { width: `${clampedValue}%` } : undefined;

		return (
			<div
				ref={ref}
				className={progressClass}
				role="progressbar"
				aria-label={ariaLabel}
				aria-valuenow={!indeterminate ? clampedValue : undefined}
				aria-valuemin={!indeterminate ? 0 : undefined}
				aria-valuemax={!indeterminate ? 100 : undefined}
				{...props}
			>
				<div
					className="vscode-progress-bar__indicator"
					style={progressStyle}
				/>
			</div>
		);
	}
);

ProgressBar.displayName = 'ProgressBar';
```

## File: src/progress-ring/ProgressRing.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-progress-ring {
  display: flex;
  align-items: center;
  outline: none;
  height: 28px;
  width: 28px;
  margin: 0;
}

.vscode-progress-ring--small {
  height: 16px;
  width: 16px;
}

.vscode-progress-ring__progress {
  height: 100%;
  width: 100%;
}

.vscode-progress-ring__background {
  fill: none;
  stroke: transparent;
  stroke-width: 2px;
}

.vscode-progress-ring__indicator {
  fill: none;
  stroke: var(--vscode-progressBar-background);
  stroke-width: 2px;
  stroke-linecap: square;
  transform-origin: 50% 50%;
  transform: rotate(-90deg);
  transition: all 0.2s ease-in-out;
  animation: vscode-progress-ring-spin 2s linear infinite;
}

@keyframes vscode-progress-ring-spin {
  0% {
    stroke-dasharray: 0.01px 43.97px;
    transform: rotate(0deg);
  }
  50% {
    stroke-dasharray: 21.99px 21.99px;
    transform: rotate(450deg);
  }
  100% {
    stroke-dasharray: 0.01px 43.97px;
    transform: rotate(1080deg);
  }
}
```

## File: src/progress-ring/ProgressRing.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './ProgressRing.css';

export interface ProgressRingProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * Accessible label for the progress ring
	 */
	'aria-label'?: string;
	/**
	 * Size of the progress ring
	 */
	size?: 'default' | 'small';
}

/**
 * The Visual Studio Code progress ring component.
 *
 * @remarks
 * A standalone React progress ring component that inherits from VSCode theme colors.
 * This is an indeterminate progress indicator that spins indefinitely.
 *
 * @public
 */
export const ProgressRing = React.forwardRef<HTMLDivElement, ProgressRingProps>(
	({ className, size = 'default', 'aria-label': ariaLabel = 'Loading', ...props }, ref) => {
		const progressClass = [
			'vscode-progress-ring',
			size === 'small' && 'vscode-progress-ring--small',
			className
		].filter(Boolean).join(' ');

		return (
			<div
				ref={ref}
				className={progressClass}
				role="alert"
				aria-label={ariaLabel}
				aria-live="assertive"
				{...props}
			>
				<svg className="vscode-progress-ring__progress" viewBox="0 0 16 16">
					<circle
						className="vscode-progress-ring__background"
						cx="8"
						cy="8"
						r="7"
					/>
					<circle
						className="vscode-progress-ring__indicator"
						cx="8"
						cy="8"
						r="7"
					/>
				</svg>
			</div>
		);
	}
);

ProgressRing.displayName = 'ProgressRing';
```

## File: src/panels/Panels.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-panels {
  display: grid;
  box-sizing: border-box;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  line-height: normal;
  color: var(--vscode-foreground);
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto 1fr;
  overflow-x: auto;
}

.vscode-panels__tablist {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  width: max-content;
  align-self: end;
  padding: 0;
  box-sizing: border-box;
}

.vscode-panels__tabs {
  display: flex;
  gap: 16px;
}

.vscode-panels__active-indicator {
  height: 1px;
  background: var(--vscode-panelTitle-activeBorder);
  margin: 0;
  border-radius: 0;
  transition: all 0.2s ease;
  position: relative;
}

.vscode-panels__views {
  grid-row: 2;
  grid-column-start: 1;
  grid-column-end: 4;
  position: relative;
}

/* Panel Tab Styles */
.vscode-panel-tab {
  display: inline-flex;
  box-sizing: border-box;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  line-height: normal;
  height: 28px;
  padding: 4px 0;
  color: var(--vscode-panelTitle-inactiveForeground);
  fill: currentcolor;
  border-radius: 0;
  border: 1px solid transparent;
  align-items: center;
  justify-content: center;
  grid-row: 1;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vscode-panel-tab:hover {
  color: var(--vscode-panelTitle-activeForeground);
  fill: currentcolor;
}

.vscode-panel-tab:active {
  color: var(--vscode-panelTitle-activeForeground);
  fill: currentcolor;
}

.vscode-panel-tab--active,
.vscode-panel-tab[aria-selected='true'] {
  background: transparent;
  color: var(--vscode-panelTitle-activeForeground);
  fill: currentcolor;
}

.vscode-panel-tab--active:hover,
.vscode-panel-tab[aria-selected='true']:hover {
  background: transparent;
  color: var(--vscode-panelTitle-activeForeground);
  fill: currentcolor;
}

.vscode-panel-tab--active:active,
.vscode-panel-tab[aria-selected='true']:active {
  background: transparent;
  color: var(--vscode-panelTitle-activeForeground);
  fill: currentcolor;
}

.vscode-panel-tab:focus-visible {
  outline: none;
  border: 1px solid var(--vscode-panelTitle-activeBorder);
}

.vscode-panel-tab:focus {
  outline: none;
}

/* Panel View Styles */
.vscode-panel-view {
  display: flex;
  color: inherit;
  background-color: transparent;
  border: 1px solid transparent;
  box-sizing: border-box;
  font-size: var(--vscode-font-size);
  line-height: normal;
  padding: 8px 12px;
}

.vscode-panel-view[hidden] {
  display: none;
}
```

## File: src/toggle/Toggle.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Toggle.css';

export type ToggleSize = 'default' | 'small';

export interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
	/**
	 * Label text for the toggle
	 */
	label?: string;
	/**
	 * Label for the left side (unchecked state)
	 */
	leftLabel?: string;
	/**
	 * Label for the right side (checked state)
	 */
	rightLabel?: string;
	/**
	 * Size of the toggle
	 */
	size?: ToggleSize;
}

/**
 * The Visual Studio Code toggle component.
 *
 * @remarks
 * A standalone React toggle (switch) component that inherits from VSCode theme colors.
 *
 * @public
 */
export const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
	({ label, leftLabel, rightLabel, size = 'default', className, children, ...props }, ref) => {
		const toggleRef = React.useRef<HTMLInputElement>(null);

		React.useImperativeHandle(ref, () => toggleRef.current!);

		const hasSideLabels = leftLabel || rightLabel;

		const labelClass = [
			'vscode-toggle',
			hasSideLabels && 'vscode-toggle--two-sided',
			size === 'small' && 'vscode-toggle--small',
			props.disabled && 'vscode-toggle--disabled',
			props.checked && 'vscode-toggle--checked',
			className
		].filter(Boolean).join(' ');

		const labelText = label || children;

		return (
			<label className={labelClass}>
				{hasSideLabels && leftLabel && (
					<span className="vscode-toggle__side-label vscode-toggle__side-label--left">
						{leftLabel}
					</span>
				)}
				<div className="vscode-toggle__control">
					<input
						ref={toggleRef}
						type="checkbox"
						role="switch"
						className="vscode-toggle__input"
						{...props}
					/>
					<div className="vscode-toggle__track">
						<div className="vscode-toggle__thumb" />
					</div>
				</div>
				{hasSideLabels && rightLabel && (
					<span className="vscode-toggle__side-label vscode-toggle__side-label--right">
						{rightLabel}
					</span>
				)}
				{!hasSideLabels && labelText && (
					<span className="vscode-toggle__label">{labelText}</span>
				)}
			</label>
		);
	}
);

Toggle.displayName = 'Toggle';
```

## File: src/button/SplitButton.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-split-button {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  border-radius: 2px;
  overflow: hidden;
  border-top: 1px solid transparent;
  border-bottom: 1px solid transparent;
}

.vscode-split-button__main,
.vscode-split-button__trigger {
  outline: none;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  line-height: normal;
  border: none;
  fill: currentColor;
  cursor: pointer;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  text-decoration: none;
  transition: background 0.1s ease;
}

.vscode-split-button__main {
  padding: 4px 11px;
  border-top-left-radius: 2px;
  border-bottom-left-radius: 2px;
}

.vscode-split-button__trigger {
  padding: 4px 6px;
  border-top-right-radius: 2px;
  border-bottom-right-radius: 2px;
}

.vscode-split-button__divider {
  width: 1px;
  align-self: stretch;
}

.vscode-split-button__main:focus-visible,
.vscode-split-button__trigger:focus-visible {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: 2px;
}

.vscode-split-button__main::-moz-focus-inner,
.vscode-split-button__trigger::-moz-focus-inner {
  border: 0;
}

.vscode-split-button__main:disabled,
.vscode-split-button__trigger:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.vscode-split-button__select {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
}

/* Primary Button Styles */
.vscode-split-button--primary {
  border-top-color: var(--vscode-button-border, transparent);
  border-bottom-color: var(--vscode-button-border, transparent);
}

.vscode-split-button--primary .vscode-split-button__main,
.vscode-split-button--primary .vscode-split-button__trigger {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.vscode-split-button--primary .vscode-split-button__divider {
  background: rgba(0, 0, 0, 0.2);
}

.vscode-split-button--primary .vscode-split-button__main:hover,
.vscode-split-button--primary .vscode-split-button__trigger:hover {
  background: var(--vscode-button-hoverBackground);
}

.vscode-split-button--primary .vscode-split-button__main:active,
.vscode-split-button--primary .vscode-split-button__trigger:active {
  background: var(--vscode-button-background);
}

.vscode-split-button--primary .vscode-split-button__main:disabled,
.vscode-split-button--primary .vscode-split-button__trigger:disabled {
  background: var(--vscode-button-background);
}

/* Secondary Button Styles */
.vscode-split-button--secondary {
  border-top-color: var(--vscode-button-border, transparent);
  border-bottom-color: var(--vscode-button-border, transparent);
}

.vscode-split-button--secondary .vscode-split-button__main,
.vscode-split-button--secondary .vscode-split-button__trigger {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

.vscode-split-button--secondary .vscode-split-button__divider {
  background: rgba(0, 0, 0, 0.15);
}

.vscode-split-button--secondary .vscode-split-button__main:hover,
.vscode-split-button--secondary .vscode-split-button__trigger:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

.vscode-split-button--secondary .vscode-split-button__main:active,
.vscode-split-button--secondary .vscode-split-button__trigger:active {
  background: var(--vscode-button-secondaryBackground);
}

.vscode-split-button--secondary .vscode-split-button__main:disabled,
.vscode-split-button--secondary .vscode-split-button__trigger:disabled {
  background: var(--vscode-button-secondaryBackground);
}

/* Icon Button Styles */
.vscode-split-button--icon {
  border-top-color: transparent;
  border-bottom-color: transparent;
}

.vscode-split-button--icon .vscode-split-button__main,
.vscode-split-button--icon .vscode-split-button__trigger {
  background: transparent;
  color: var(--vscode-foreground);
  padding: 3px;
}

.vscode-split-button--icon .vscode-split-button__divider {
  background: rgba(90, 93, 94, 0.31);
}

.vscode-split-button--icon .vscode-split-button__main:hover,
.vscode-split-button--icon .vscode-split-button__trigger:hover {
  background: rgba(90, 93, 94, 0.31);
  outline: 1px dotted var(--vscode-contrastActiveBorder);
  outline-offset: -1px;
}

.vscode-split-button--icon .vscode-split-button__main:active,
.vscode-split-button--icon .vscode-split-button__trigger:active {
  background: rgba(90, 93, 94, 0.31);
}

.vscode-split-button--icon .vscode-split-button__main:focus-visible,
.vscode-split-button--icon .vscode-split-button__trigger:focus-visible {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: 0;
}

.vscode-split-button--icon .vscode-split-button__main:disabled,
.vscode-split-button--icon .vscode-split-button__trigger:disabled {
  background: transparent;
}
```

## File: src/toggle/Toggle.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-toggle {
  display: inline-flex;
  align-items: center;
  outline: none;
  margin: 4px 0;
  user-select: none;
  font-size: var(--vscode-font-size);
  line-height: normal;
  cursor: pointer;
}

.vscode-toggle__control {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
}

.vscode-toggle__input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
  z-index: 1;
}

.vscode-toggle__track {
  position: relative;
  width: 40px;
  height: 20px;
  background: var(--vscode-button-secondaryBackground);
  border-radius: 10px;
  transition: background-color 0.1s ease;
  box-sizing: border-box;
}

.vscode-toggle__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  background: var(--vscode-button-secondaryForeground);
  border-radius: 50%;
  transition: transform 0.1s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.vscode-toggle__label {
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
  padding-inline-start: 10px;
  margin-inline-end: 10px;
  cursor: pointer;
}

/* Checked state */
.vscode-toggle--checked .vscode-toggle__track {
  background: var(--vscode-button-background);
}

.vscode-toggle--checked .vscode-toggle__thumb {
  transform: translateX(20px);
  background: var(--vscode-button-foreground);
}

/* Hover state */
.vscode-toggle:hover:not(.vscode-toggle--checked) .vscode-toggle__track {
  background: var(--vscode-button-secondaryHoverBackground);
}

.vscode-toggle--checked:hover .vscode-toggle__track {
  background: var(--vscode-button-hoverBackground);
}

/* Focus state */
.vscode-toggle:has(.vscode-toggle__input:focus-visible) .vscode-toggle__track {
  outline: 1px solid var(--vscode-focusBorder, #007fd4);
  outline-offset: 2px;
}

/* Two-sided toggle */
.vscode-toggle--two-sided {
  gap: 8px;
}

.vscode-toggle__side-label {
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
  cursor: pointer;
  transition: color 0.1s ease;
}

/* Right label is active when checked */
.vscode-toggle--checked .vscode-toggle__side-label--right {
  color: var(--vscode-button-background);
  font-weight: 500;
}

/* Small size variant */
.vscode-toggle--small {
  font-size: calc(var(--vscode-font-size) - 1px);
}

.vscode-toggle--small .vscode-toggle__track {
  width: 32px;
  height: 16px;
  border-radius: 8px;
}

.vscode-toggle--small .vscode-toggle__thumb {
  width: 10px;
  height: 10px;
  top: 3px;
  left: 3px;
}

.vscode-toggle--small.vscode-toggle--checked .vscode-toggle__thumb {
  transform: translateX(16px);
}

.vscode-toggle--small.vscode-toggle--two-sided {
  gap: 6px;
}

/* Disabled state */
.vscode-toggle--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.vscode-toggle--disabled .vscode-toggle__label,
.vscode-toggle--disabled .vscode-toggle__side-label,
.vscode-toggle--disabled .vscode-toggle__input {
  cursor: not-allowed;
}
```

## File: src/button/SplitButton.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import { ButtonProps } from './Button';
import './SplitButton.css';

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

export interface SplitButtonProps extends Omit<ButtonProps, 'onClick'> {
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
	({ appearance = 'primary', options, onSelect, onClick, children, className, disabled, value: controlledValue, defaultValue, ...props }, ref) => {
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
					{...props}
				>
					{displayText}
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
```

## File: src/timeline/Timeline.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Timeline.css';

export type TimelineItemStatus = 'success' | 'error' | 'pending' | 'incomplete';

export interface TimelineItemProps {
	/**
	 * Status of the timeline item
	 */
	status: TimelineItemStatus;
	/**
	 * Primary text label for the timeline item
	 */
	label: string;
	/**
	 * Secondary text for additional description
	 */
	description?: string;
	/**
	 * Optional URL to make the label a clickable link
	 */
	href?: string;
}

export interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * Timeline items to display
	 */
	items: TimelineItemProps[];
}

/**
 * The Visual Studio Code timeline component.
 *
 * @remarks
 * A standalone React timeline component that displays a vertical timeline
 * with dots/icons on the left and text labels on the right.
 *
 * @public
 */
export const Timeline = React.forwardRef<HTMLDivElement, TimelineProps>(
	({ items, className, ...props }, ref) => {
		const timelineClass = [
			'vscode-timeline',
			className
		].filter(Boolean).join(' ');

		return (
			<div ref={ref} className={timelineClass} {...props}>
				{items.map((item, index) => (
					<TimelineItem
						key={index}
						{...item}
						isLast={index === items.length - 1}
					/>
				))}
			</div>
		);
	}
);

Timeline.displayName = 'Timeline';

interface TimelineItemInternalProps extends TimelineItemProps {
	isLast: boolean;
}

const TimelineItem: React.FC<TimelineItemInternalProps> = ({
	status,
	label,
	description,
	href,
	isLast
}) => {
	const getIconContent = () => {
		switch (status) {
			case 'success':
				return (
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M6.5 11.5L3 8L4.06 6.94L6.5 9.38L11.94 3.94L13 5L6.5 11.5Z" fill="currentColor"/>
					</svg>
				);
			case 'error':
				return (
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M12.32 11.26L9.06 8L12.32 4.74L11.26 3.68L8 6.94L4.74 3.68L3.68 4.74L6.94 8L3.68 11.26L4.74 12.32L8 9.06L11.26 12.32L12.32 11.26Z" fill="currentColor"/>
					</svg>
				);
			case 'pending':
			case 'incomplete':
			default:
				return (
					<div className="vscode-timeline-item__dot" />
				);
		}
	};

	const itemClass = [
		'vscode-timeline-item',
		`vscode-timeline-item--${status}`,
		isLast && 'vscode-timeline-item--last'
	].filter(Boolean).join(' ');

	return (
		<div className={itemClass}>
			<div className="vscode-timeline-item__indicator">
				<div className="vscode-timeline-item__icon">
					{getIconContent()}
				</div>
				{!isLast && <div className="vscode-timeline-item__line" />}
			</div>
			<div className="vscode-timeline-item__content">
				{href ? (
					<a href={href} className="vscode-timeline-item__link">
						<div className="vscode-timeline-item__label">{label}</div>
						{description && (
							<div className="vscode-timeline-item__description">{description}</div>
						)}
					</a>
				) : (
					<>
						<div className="vscode-timeline-item__label">{label}</div>
						{description && (
							<div className="vscode-timeline-item__description">{description}</div>
						)}
					</>
				)}
			</div>
		</div>
	);
};
```

## File: src/code-block/CodeBlock.tsx

```typescript
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './CodeBlock.css';

export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * The code content to display
	 */
	code: string;
	/**
	 * Optional language label
	 */
	language?: string;
	/**
	 * Whether to show the copy button
	 */
	showCopy?: boolean;
}

/**
 * The Visual Studio Code code block component.
 *
 * @remarks
 * A standalone React code block component with copy functionality that inherits from VSCode theme colors.
 *
 * @public
 */
export const CodeBlock = React.forwardRef<HTMLDivElement, CodeBlockProps>(
	({ code, language, showCopy = true, className, ...props }, ref) => {
		const [copied, setCopied] = React.useState(false);

		const handleCopy = async () => {
			try {
				await navigator.clipboard.writeText(code);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			} catch (err) {
				console.error('Failed to copy code:', err);
			}
		};

		const showHeader = language || showCopy;

		const codeBlockClass = [
			'vscode-code-block',
			!showHeader && 'vscode-code-block--no-header',
			!language && showCopy && 'vscode-code-block--no-language',
			language && 'vscode-code-block--has-language',
			className
		].filter(Boolean).join(' ');

		return (
			<div ref={ref} className={codeBlockClass} {...props}>
				{showHeader && (
					<div className="vscode-code-block__header">
						{language && (
							<span className="vscode-code-block__language">{language}</span>
						)}
						{showCopy && (
							<button
								className="vscode-code-block__copy"
								onClick={handleCopy}
								aria-label="Copy code"
								title={copied ? 'Copied!' : 'Copy code'}
							>
								{copied ? (
									<>
										<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
											<path d="M6.5 11.5L3 8L4.06 6.94L6.5 9.38L11.94 3.94L13 5L6.5 11.5Z" fill="currentColor"/>
										</svg>
										<span>Copied</span>
									</>
								) : (
									<>
										<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
											<path d="M4 4V2H12V10H10V12H2V4H4ZM4 4H10V10" stroke="currentColor" strokeWidth="1" fill="none"/>
										</svg>
										<span>Copy</span>
									</>
								)}
							</button>
						)}
					</div>
				)}
				<pre className="vscode-code-block__content">
					<code>{code}</code>
				</pre>
			</div>
		);
	}
);

CodeBlock.displayName = 'CodeBlock';
```

## File: src/data-grid/DataGrid.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-data-grid {
  display: flex;
  position: relative;
  flex-direction: column;
  width: 100%;
}

/* Data Grid Row Styles */
.vscode-data-grid-row {
  display: grid;
  padding: 1px 0;
  box-sizing: border-box;
  width: 100%;
  background: transparent;
}

.vscode-data-grid-row--header {
  /* Header-specific styles if needed */
}

.vscode-data-grid-row--sticky-header {
  background: var(--vscode-editor-background);
  position: sticky;
  top: 0;
  z-index: 1;
}

.vscode-data-grid-row:hover {
  background: var(--vscode-list-hoverBackground);
}

/* Bordered variant styles */
.vscode-data-grid--bordered .vscode-data-grid-row {
  border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-input-border, transparent));
  padding: 0;
}

.vscode-data-grid--bordered .vscode-data-grid-row--header {
  border-bottom: 2px solid var(--vscode-panel-border, var(--vscode-input-border, transparent));
}

.vscode-data-grid--bordered .vscode-data-grid-row:last-child {
  border-bottom: none;
}

.vscode-data-grid--bordered .vscode-data-grid-row:hover {
  background: var(--vscode-list-hoverBackground);
  outline: none;
}

.vscode-data-grid--bordered .vscode-data-grid-cell {
  padding: 6px 10px;
}

.vscode-data-grid--bordered .vscode-data-grid-cell--column-header {
  padding: 6px 10px;
}

/* Data Grid Cell Styles */
.vscode-data-grid-cell {
  padding: 6px 10px;
  color: var(--vscode-foreground);
  opacity: 1;
  box-sizing: border-box;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  line-height: normal;
  font-weight: 400;
  border: 1px solid transparent;
  border-radius: 0;
  white-space: wrap;
  overflow-wrap: anywhere;
}

.vscode-data-grid-cell--column-header,
.vscode-data-grid-cell--row-header {
  font-weight: 600;
}

.vscode-data-grid-cell:focus-visible,
.vscode-data-grid-cell:focus,
.vscode-data-grid-cell:active {
  background: var(--vscode-list-activeSelectionBackground);
  border: 1px solid var(--vscode-focusBorder);
  color: var(--vscode-list-activeSelectionForeground);
  outline: none;
}

.vscode-data-grid-cell:focus-visible *,
.vscode-data-grid-cell:focus *,
.vscode-data-grid-cell:active * {
  color: var(--vscode-list-activeSelectionForeground) !important;
}
```

## File: src/segmented-control/SegmentedControl.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-segmented-control {
  display: inline-flex;
  background: var(--vscode-input-background, #3c3c3c);
  border-radius: 4px;
  padding: 3px;
  gap: 2px;
  font-size: 11px;
  box-sizing: border-box;
}

.vscode-segmented-control__segment {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  padding: 3px 10px;
  cursor: pointer;
  user-select: none;
  border-radius: 2px;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.vscode-segmented-control__input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
}

.vscode-segmented-control__label {
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
  font-size: 11px;
  line-height: 16px;
  pointer-events: none;
  white-space: nowrap;
  transition: color 0.2s ease;
}

/* Selected state */
.vscode-segmented-control__segment--selected {
  background: var(--vscode-button-background, #0e639c);
}

.vscode-segmented-control__segment--selected .vscode-segmented-control__label {
  color: var(--vscode-button-foreground, #ffffff);
  font-weight: 500;
}

/* Hover state */
.vscode-segmented-control__segment:hover:not(.vscode-segmented-control__segment--selected):not(
    .vscode-segmented-control__segment--disabled
  ) {
  background: var(--vscode-list-hoverBackground, #2a2d2e);
}

.vscode-segmented-control__segment--selected:hover {
  background: var(--vscode-button-hoverBackground, #1177bb);
}

/* Focus state */
.vscode-segmented-control__segment:has(.vscode-segmented-control__input:focus-visible) {
  outline: 1px solid var(--vscode-focusBorder, #007fd4);
  outline-offset: 2px;
}

/* Disabled state */
.vscode-segmented-control--disabled {
  opacity: 0.4;
  pointer-events: none;
}

.vscode-segmented-control__segment--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.vscode-segmented-control__segment--disabled .vscode-segmented-control__input,
.vscode-segmented-control__segment--disabled .vscode-segmented-control__label {
  cursor: not-allowed;
}

/* Responsive sizing */
.vscode-segmented-control__segment {
  flex: 1;
}
```

## File: src/code-block/CodeBlock.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-code-block {
  display: flex;
  flex-direction: column;
  background-color: var(--vscode-editor-background);
  border: 1px solid var(--vscode-input-border, var(--vscode-panel-border, transparent));
  border-radius: 3px;
  overflow: hidden;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  position: relative;
}

.vscode-code-block__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background-color: transparent;
  min-height: 24px;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1;
  pointer-events: none;
}

.vscode-code-block__header > * {
  pointer-events: auto;
}

/* When there's a language label, add border to make it look like a heading */
.vscode-code-block__header:has(.vscode-code-block__language) {
  border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-input-border, transparent));
  padding-bottom: 6px;
}

/* When there's no language label, align copy button to the right */
.vscode-code-block__header:not(:has(.vscode-code-block__language)) {
  justify-content: flex-end;
}

.vscode-code-block__language {
  font-size: 10px;
  color: var(--vscode-descriptionForeground);
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.3px;
  opacity: 0.6;
}

.vscode-code-block__copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  transition: all 0.1s ease;
  height: 20px;
  opacity: 0.6;
  font-size: 11px;
  font-weight: 500;
}

.vscode-code-block__copy:hover {
  background-color: var(--vscode-toolbar-hoverBackground);
  opacity: 1;
}

.vscode-code-block__copy:active {
  background-color: var(--vscode-toolbar-activeBackground);
  opacity: 1;
}

.vscode-code-block__copy:focus-visible {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: 2px;
}

.vscode-code-block__content {
  margin: 0;
  padding: 36px 12px 12px 12px;
  overflow-x: auto;
  background-color: transparent;
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-editor-font-family, 'Menlo', 'Monaco', 'Courier New', monospace);
  font-size: 12px;
  line-height: 1.5;
  tab-size: 4;
  -moz-tab-size: 4;
}

.vscode-code-block--no-header .vscode-code-block__content {
  padding: 12px;
}

/* When there's a language label with border, increase top padding for spacing */
.vscode-code-block--has-language .vscode-code-block__content {
  padding-top: 48px;
}

/* When there's no language label but there is a copy button, reduce top padding */
.vscode-code-block--no-language .vscode-code-block__content {
  padding-top: 12px;
}

.vscode-code-block__content code {
  font-family: inherit;
  font-size: inherit;
  background: transparent;
  padding: 0;
  border: none;
}

/* Scrollbar styling */
.vscode-code-block__content::-webkit-scrollbar {
  height: 10px;
}

.vscode-code-block__content::-webkit-scrollbar-thumb {
  background-color: var(--vscode-scrollbarSlider-background);
  border-radius: 5px;
}

.vscode-code-block__content::-webkit-scrollbar-thumb:hover {
  background-color: var(--vscode-scrollbarSlider-hoverBackground);
}

.vscode-code-block__content::-webkit-scrollbar-thumb:active {
  background-color: var(--vscode-scrollbarSlider-activeBackground);
}
```

## File: src/timeline/Timeline.css

```css
/* Copyright (c) Microsoft Corporation. */
/* Licensed under the MIT License. */

.vscode-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
}

.vscode-timeline-item {
  display: flex;
  gap: 12px;
  position: relative;
}

.vscode-timeline-item__indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.vscode-timeline-item__icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: var(--vscode-button-background);
  position: relative;
  z-index: 1;
}

.vscode-timeline-item__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: var(--vscode-descriptionForeground);
}

.vscode-timeline-item__line {
  width: 2px;
  flex: 1;
  background-color: var(--vscode-descriptionForeground);
  min-height: 24px;
}

.vscode-timeline-item__content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 16px;
  flex: 1;
}

.vscode-timeline-item__link {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-decoration: none;
  color: inherit;
}

.vscode-timeline-item__link:hover .vscode-timeline-item__label {
  color: var(--vscode-textLink-activeForeground);
  text-decoration: underline;
}

.vscode-timeline-item__link .vscode-timeline-item__label {
  color: var(--vscode-textLink-foreground);
}

.vscode-timeline-item__label {
  font-weight: 600;
  line-height: 16px;
  color: var(--vscode-foreground);
}

.vscode-timeline-item__description {
  font-size: calc(var(--vscode-font-size) - 1px);
  line-height: 1.4;
  color: var(--vscode-descriptionForeground);
  opacity: 0.7;
}

/* Status-specific styles */

/* Success state - completed with checkmark - uses button color */
.vscode-timeline-item--success .vscode-timeline-item__icon {
  color: var(--vscode-button-foreground);
  background-color: var(--vscode-button-background);
}

.vscode-timeline-item--success .vscode-timeline-item__line {
  background-color: var(--vscode-button-background);
}

/* All other states use muted colors */

/* Error state - failed with cross - uses same color as success */
.vscode-timeline-item--error .vscode-timeline-item__icon {
  color: var(--vscode-button-foreground);
  background-color: var(--vscode-button-background);
}

.vscode-timeline-item--error .vscode-timeline-item__line {
  background-color: var(--vscode-button-secondaryBackground);
}

/* Pending state - dot with button color, but muted line since not progressed */
.vscode-timeline-item--pending .vscode-timeline-item__icon {
  background-color: var(--vscode-button-background);
}

.vscode-timeline-item--pending .vscode-timeline-item__dot {
  background-color: var(--vscode-button-foreground);
}

.vscode-timeline-item--pending .vscode-timeline-item__line {
  background-color: var(--vscode-button-secondaryBackground);
}

/* Incomplete state - greyed out */
.vscode-timeline-item--incomplete .vscode-timeline-item__icon {
  background-color: var(--vscode-button-secondaryBackground);
}

.vscode-timeline-item--incomplete .vscode-timeline-item__dot {
  background-color: var(--vscode-button-secondaryForeground);
}

.vscode-timeline-item--incomplete .vscode-timeline-item__line {
  background-color: var(--vscode-button-secondaryBackground);
}

/* Last item - no padding bottom on content since there's no line */
.vscode-timeline-item--last .vscode-timeline-item__content {
  padding-bottom: 0;
}
```
