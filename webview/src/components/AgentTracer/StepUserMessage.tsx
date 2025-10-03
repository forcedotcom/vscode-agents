import React from 'react';
import userIcon from '../../assets/user.svg';
import clockIcon from '../../assets/clock.svg';
import './StepUserMessage.css';

interface StepUserMessageProps {
  message: string;
  timing?: string;
}

export const StepUserMessage: React.FC<StepUserMessageProps> = ({ message, timing }) => {
  return (
    <div className="step-user-message step-user-message--user">
      <div className="step-user-message-header">
        <div className="step-user-message-title">
          <img src={userIcon} alt="User" className="step-user-message-icon" />
          User Message
        </div>
        {timing && (
          <div className="step-user-message-timing">
            <img src={clockIcon} alt="Clock" className="step-user-message-timing-icon" />
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
