import React from 'react';
import boltIconDark from '../../assets/bolt-dark.svg';
import boltIconLight from '../../assets/bolt-light.svg';
import clockIconDark from '../../assets/clock-dark.svg';
import clockIconLight from '../../assets/clock-light.svg';
import './StepAction.css';

interface StepActionProps {
  actionName: string;
  description: string;
  timing?: string;
  inputCode?: string;
  outputCode?: string;
}

export const StepAction: React.FC<StepActionProps> = ({ actionName, description, timing, inputCode, outputCode }) => {
  const isDark =
    document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');

  return (
    <div className="step-action step-action--default">
      <div className="step-action-header">
        <div className="step-action-title">
          <img src={isDark ? boltIconDark : boltIconLight} alt="Action" className="step-action-icon" />
          Action: {actionName}
        </div>
        {timing && (
          <div className="step-action-timing">
            <img src={isDark ? clockIconDark : clockIconLight} alt="Clock" className="step-action-timing-icon" />
            {timing}
          </div>
        )}
      </div>
      <div className="step-action-content">
        <p>{description}</p>
        {(inputCode || outputCode) && (
          <div className="step-action-blocks">
            {inputCode && (
              <div className="step-action-code-block">
                <div className="step-action-code-block-header">Input</div>
                <div className="step-action-code-block-content">
                  <pre>{inputCode}</pre>
                </div>
              </div>
            )}
            {outputCode && (
              <div className="step-action-code-block">
                <div className="step-action-code-block-header">Output</div>
                <div className="step-action-code-block-content">
                  <pre>{outputCode}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
