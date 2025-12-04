import React, { ReactNode, useState } from 'react';
import chevronIconDark from '../../assets/chevron-dark.svg';
import chevronIconLight from '../../assets/chevron-light.svg';
import clockIconDark from '../../assets/clock-dark.svg';
import clockIconLight from '../../assets/clock-light.svg';
import sparklesIconDark from '../../assets/sparkles-dark.svg';
import sparklesIconLight from '../../assets/sparkles-light.svg';
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
  const isDark =
    document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');

  return (
    <div className="step-action-selection-expandable">
      <button className="step-action-selection-expandable-header" onClick={() => setIsExpanded(!isExpanded)}>
        <img
          src={isDark ? chevronIconDark : chevronIconLight}
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
  const isDark =
    document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');

  return (
    <div className="step-action-selection">
      <div className="step-action-selection-header">
        <div className="step-action-selection-title">
          <img
            src={isDark ? sparklesIconDark : sparklesIconLight}
            alt="Sparkles"
            className="step-action-selection-icon"
          />
          Reasoning: Action Selection
        </div>
        {timing && (
          <div className="step-action-selection-timing">
            <img
              src={isDark ? clockIconDark : clockIconLight}
              alt="Clock"
              className="step-action-selection-timing-icon"
            />
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
