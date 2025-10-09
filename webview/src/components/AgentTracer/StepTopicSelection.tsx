import React, { ReactNode, useState } from 'react';
import chevronIconDark from '../../assets/chevron-dark.svg';
import chevronIconLight from '../../assets/chevron-light.svg';
import clockIconDark from '../../assets/clock-dark.svg';
import clockIconLight from '../../assets/clock-light.svg';
import sparklesIconDark from '../../assets/sparkles-dark.svg';
import sparklesIconLight from '../../assets/sparkles-light.svg';
import './StepTopicSelection.css';

interface StepTopicSelectionProps {
  timing?: string;
  promptUsed?: ReactNode;
  availableTopics?: ReactNode;
  availableTopicsCount?: number;
}

const ExpandableSection: React.FC<{
  title: string;
  badge?: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}> = ({ title, badge, children, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const isDark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');

  return (
    <div className="step-topic-selection-expandable">
      <button className="step-topic-selection-expandable-header" onClick={() => setIsExpanded(!isExpanded)}>
        <img
          src={isDark ? chevronIconDark : chevronIconLight}
          alt="Expand"
          className={`step-topic-selection-expand-icon ${isExpanded ? 'expanded' : ''}`}
        />
        <span className="step-topic-selection-section-title">{title}</span>
        {badge && <span className="step-topic-selection-section-badge">{badge}</span>}
      </button>
      {isExpanded && <div className="step-topic-selection-expandable-content">{children}</div>}
    </div>
  );
};

export const StepTopicSelection: React.FC<StepTopicSelectionProps> = ({
  timing,
  promptUsed,
  availableTopics,
  availableTopicsCount = 4
}) => {
  const isDark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');

  return (
    <div className="step-topic-selection step-topic-selection--default">
      <div className="step-topic-selection-header">
        <div className="step-topic-selection-title">
          <img src={isDark ? sparklesIconDark : sparklesIconLight} alt="Sparkles" className="step-topic-selection-icon" />
          Reasoning: Topic Selection
        </div>
        {timing && (
          <div className="step-topic-selection-timing">
            <img src={isDark ? clockIconDark : clockIconLight} alt="Clock" className="step-topic-selection-timing-icon" />
            {timing}
          </div>
        )}
      </div>
      <div className="step-topic-selection-content">
        {promptUsed && <ExpandableSection title="Prompt Used">{promptUsed}</ExpandableSection>}
        {availableTopics && (
          <ExpandableSection title="Available Topics" badge={`${availableTopicsCount} available`}>
            {availableTopics}
          </ExpandableSection>
        )}
      </div>
    </div>
  );
};
