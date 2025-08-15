import React, { useState, ReactNode } from 'react';
import chevronIcon from '../../assets/chevron.svg';
import './PlanInfo.css';

interface PlanInfoProps {
  title: string;
  planId: string;
  isExpanded?: boolean;
  children?: ReactNode;
}

export const PlanInfo: React.FC<PlanInfoProps> = ({
  title,
  planId,
  isExpanded: initialExpanded = false,
  children
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  return (
    <div className="plan-info">
      <button
        className="plan-info-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <img 
          src={chevronIcon} 
          alt="Expand" 
          className={`plan-icon ${isExpanded ? 'expanded' : ''}`}
        />
        <span className="plan-title">{title}</span>
        <span className="plan-id">Plan ID: {planId}</span>
      </button>
      {isExpanded && children && (
        <div className="plan-info-content">
          {children}
        </div>
      )}
    </div>
  );
};