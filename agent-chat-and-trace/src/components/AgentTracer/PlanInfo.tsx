import React from 'react';
import chevronIcon from '../../assets/chevron.svg';
import './PlanInfo.css';

interface PlanInfoProps {
  title: string;
  planId: string;
  isExpanded?: boolean;
}

export const PlanInfo: React.FC<PlanInfoProps> = ({
  title,
  planId,
  isExpanded = false
}) => {
  return (
    <div className="plan-info">
      <img 
        src={chevronIcon} 
        alt="Expand" 
        className={`plan-icon ${isExpanded ? 'expanded' : ''}`}
      />
      <span className="plan-title">{title}</span>
      <span className="plan-id">Plan ID: {planId}</span>
    </div>
  );
};