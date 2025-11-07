// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Button.css';

/**
 * Types of button appearance.
 * @public
 */
export type ButtonAppearance = 'primary' | 'secondary' | 'icon';

/**
 * Types of button size.
 * @public
 */
export type ButtonSize = 'default' | 'small';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/**
	 * The appearance the button should have.
	 */
	appearance?: ButtonAppearance;
	/**
	 * Content to display before the button text (e.g., icons)
	 */
	startIcon?: React.ReactNode;
	/**
	 * The size of the button
	 */
	size?: ButtonSize;
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
	({ appearance = 'primary', size = 'default', startIcon, children, className, ...props }, ref) => {
		const buttonClass = [
			'vscode-button',
			`vscode-button--${appearance}`,
			size === 'small' && 'vscode-button--small',
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
