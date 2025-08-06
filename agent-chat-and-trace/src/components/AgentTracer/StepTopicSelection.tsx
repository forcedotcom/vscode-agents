import React, { ReactNode, useState } from 'react';
import chevronIcon from '../../assets/chevron.svg';
import clockIcon from '../../assets/clock.svg';
import sparklesIcon from '../../assets/sparkles.svg';
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

  return (
    <div className="step-topic-selection-expandable">
      <button 
        className="step-topic-selection-expandable-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <img 
          src={chevronIcon} 
          alt="Expand" 
          className={`step-topic-selection-expand-icon ${isExpanded ? 'expanded' : ''}`}
        />
        <span className="step-topic-selection-section-title">{title}</span>
        {badge && <span className="step-topic-selection-section-badge">{badge}</span>}
      </button>
      {isExpanded && (
        <div className="step-topic-selection-expandable-content">
          {children}
        </div>
      )}
    </div>
  );
};

export const StepTopicSelection: React.FC<StepTopicSelectionProps> = ({ 
  timing,
  promptUsed,
  availableTopics,
  availableTopicsCount = 4
}) => {
  return (
    <div className="step-topic-selection step-topic-selection--default">
      <div className="step-topic-selection-header">
        <div className="step-topic-selection-title">
          <img src={sparklesIcon} alt="Sparkles" className="step-topic-selection-icon" />
          Reasoning: Topic Selection
        </div>
        {timing && (
          <div className="step-topic-selection-timing">
            <img src={clockIcon} alt="Clock" className="step-topic-selection-timing-icon" />
            {timing}
          </div>
        )}
      </div>
      <div className="step-topic-selection-content">
        {promptUsed && (
          <ExpandableSection title="Prompt Used">
            {promptUsed}
          </ExpandableSection>
        )}
        {availableTopics && (
          <ExpandableSection title="Available Topics" badge={`${availableTopicsCount} available`}>
            {availableTopics}
          </ExpandableSection>
        )}
      </div>
    </div>
  );
};