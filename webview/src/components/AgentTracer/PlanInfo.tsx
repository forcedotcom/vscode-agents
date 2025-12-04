import React, { ReactNode } from 'react';
import chevronIconDark from '../../assets/chevron-dark.svg';
import chevronIconLight from '../../assets/chevron-light.svg';
import './PlanInfo.css';

interface PlanInfoProps {
  title: string;
  planId: string;
  isExpanded?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
}

export const PlanInfo: React.FC<PlanInfoProps> = ({ title, planId, isExpanded = false, onToggle, children }) => {
  const isDark =
    document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');

  return (
    <div className="plan-info">
      <button className="plan-info-header" onClick={onToggle}>
        <img
          src={isDark ? chevronIconDark : chevronIconLight}
          alt="Expand"
          className={`plan-icon ${isExpanded ? 'expanded' : ''}`}
        />
        <span className="plan-title">{title}</span>
        <span className="plan-id">Plan ID: {planId}</span>
      </button>
      {isExpanded && children && <div className="plan-info-content">{children}</div>}
    </div>
  );
};
