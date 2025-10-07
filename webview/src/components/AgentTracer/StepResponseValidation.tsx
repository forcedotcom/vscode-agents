import React from 'react';
import sparklesIconDark from '../../assets/sparkles-dark.svg';
import sparklesIconLight from '../../assets/sparkles-light.svg';
import clockIconDark from '../../assets/clock-dark.svg';
import clockIconLight from '../../assets/clock-light.svg';
import './StepResponseValidation.css';

interface StepResponseValidationProps {
  timing?: string;
  validationCode: string;
}

export const StepResponseValidation: React.FC<StepResponseValidationProps> = ({ timing, validationCode }) => {
  const isDark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');

  return (
    <div className="step-response-validation step-response-validation--default">
      <div className="step-response-validation-header">
        <div className="step-response-validation-title">
          <img src={isDark ? sparklesIconDark : sparklesIconLight} alt="Sparkles" className="step-response-validation-icon" />
          Reasoning: Response Validation
        </div>
        {timing && (
          <div className="step-response-validation-timing">
            <img src={isDark ? clockIconDark : clockIconLight} alt="Clock" className="step-response-validation-timing-icon" />
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
