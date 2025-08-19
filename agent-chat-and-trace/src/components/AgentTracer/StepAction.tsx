import React from 'react';
import boltIcon from '../../assets/bolt.svg';
import clockIcon from '../../assets/clock.svg';
import './StepAction.css';

interface StepActionProps {
  actionName: string;
  description: string;
  timing?: string;
  inputCode?: string;
  outputCode?: string;
}

export const StepAction: React.FC<StepActionProps> = ({ 
  actionName,
  description,
  timing,
  inputCode,
  outputCode
}) => {
  return (
    <div className="step-action step-action--default">
      <div className="step-action-header">
        <div className="step-action-title">
          <img src={boltIcon} alt="Action" className="step-action-icon" />
          Action: {actionName}
        </div>
        {timing && (
          <div className="step-action-timing">
            <img src={clockIcon} alt="Clock" className="step-action-timing-icon" />
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