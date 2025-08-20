import React from 'react';
import sparklesIcon from '../../assets/sparkles.svg';
import clockIcon from '../../assets/clock.svg';
import './StepResponseValidation.css';

interface StepResponseValidationProps {
  timing?: string;
  validationCode: string;
}

export const StepResponseValidation: React.FC<StepResponseValidationProps> = ({ timing, validationCode }) => {
  return (
    <div className="step-response-validation step-response-validation--default">
      <div className="step-response-validation-header">
        <div className="step-response-validation-title">
          <img src={sparklesIcon} alt="Sparkles" className="step-response-validation-icon" />
          Reasoning: Response Validation
        </div>
        {timing && (
          <div className="step-response-validation-timing">
            <img src={clockIcon} alt="Clock" className="step-response-validation-timing-icon" />
            {timing}
          </div>
        )}
      </div>
      <div className="step-response-validation-content">
        <div className="step-response-validation-code-block">
          <div className="step-response-validation-code-block-content">
            <pre>{validationCode}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
