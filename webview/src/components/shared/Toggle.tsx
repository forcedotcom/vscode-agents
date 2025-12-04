// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Toggle.css';

export type ToggleSize = 'default' | 'small';

export interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
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
    ]
      .filter(Boolean)
      .join(' ');

    const labelText = label || children;

    return (
      <label className={labelClass}>
        {hasSideLabels && leftLabel && (
          <span className="vscode-toggle__side-label vscode-toggle__side-label--left">{leftLabel}</span>
        )}
        <div className="vscode-toggle__control">
          <input ref={toggleRef} type="checkbox" role="switch" className="vscode-toggle__input" {...props} />
          <div className="vscode-toggle__track">
            <div className="vscode-toggle__thumb" />
          </div>
        </div>
        {hasSideLabels && rightLabel && (
          <span className="vscode-toggle__side-label vscode-toggle__side-label--right">{rightLabel}</span>
        )}
        {!hasSideLabels && labelText && <span className="vscode-toggle__label">{labelText}</span>}
      </label>
    );
  }
);

Toggle.displayName = 'Toggle';
