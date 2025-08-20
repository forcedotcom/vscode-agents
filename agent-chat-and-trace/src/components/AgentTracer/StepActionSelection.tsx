import React, { ReactNode, useState } from 'react';
import chevronIcon from '../../assets/chevron.svg';
import clockIcon from '../../assets/clock.svg';
import sparklesIcon from '../../assets/sparkles.svg';
import './StepActionSelection.css';

interface StepActionSelectionProps {
  timing?: string;
  promptUsed?: ReactNode;
}

const ExpandableSection: React.FC<{
  title: string;
  badge?: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}> = ({ title, badge, children, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="step-action-selection-expandable">
      <button className="step-action-selection-expandable-header" onClick={() => setIsExpanded(!isExpanded)}>
        <img
          src={chevronIcon}
          alt="Expand"
          className={`step-action-selection-expand-icon ${isExpanded ? 'expanded' : ''}`}
        />
        <span className="step-action-selection-section-title">{title}</span>
        {badge && <span className="step-action-selection-section-badge">{badge}</span>}
      </button>
      {isExpanded && <div className="step-action-selection-expandable-content">{children}</div>}
    </div>
  );
};

export const StepActionSelection: React.FC<StepActionSelectionProps> = ({ timing, promptUsed }) => {
  return (
    <div className="step-action-selection">
      <div className="step-action-selection-header">
        <div className="step-action-selection-title">
          <img src={sparklesIcon} alt="Sparkles" className="step-action-selection-icon" />
          Reasoning: Action Selection
        </div>
        {timing && (
          <div className="step-action-selection-timing">
            <img src={clockIcon} alt="Clock" className="step-action-selection-timing-icon" />
            {timing}
          </div>
        )}
      </div>
      {promptUsed && (
        <div className="step-action-selection-content">
          <ExpandableSection title="Prompt Used">{promptUsed}</ExpandableSection>
        </div>
      )}
    </div>
  );
};
