import React from 'react';
import userIconDark from '../../assets/user-dark.svg';
import userIconLight from '../../assets/user-light.svg';
import clockIconDark from '../../assets/clock-dark.svg';
import clockIconLight from '../../assets/clock-light.svg';
import './StepUserMessage.css';

interface StepUserMessageProps {
  message: string;
  timing?: string;
}

export const StepUserMessage: React.FC<StepUserMessageProps> = ({ message, timing }) => {
  const isDark =
    document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');

  return (
    <div className="step-user-message step-user-message--user">
      <div className="step-user-message-header">
        <div className="step-user-message-title">
          <img src={isDark ? userIconDark : userIconLight} alt="User" className="step-user-message-icon" />
          User Message
        </div>
        {timing && (
          <div className="step-user-message-timing">
            <img src={isDark ? clockIconDark : clockIconLight} alt="Clock" className="step-user-message-timing-icon" />
            {timing}
          </div>
        )}
      </div>
      <div className="step-user-message-content">
        <p>{message}</p>
      </div>
    </div>
  );
};
