import React, { ReactNode, useState } from "react";
import chevronIcon from "../../assets/chevron.svg";
import clockIcon from "../../assets/clock.svg";
import bookIcon from "../../assets/book.svg";
import "./StepTopic.css";

interface StepTopicProps {
  topicName: string;
  description: string;
  timing?: string;
  instructions?: ReactNode;
  instructionsCount?: number;
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
    <div className="step-topic-expandable">
      <button
        className="step-topic-expandable-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <img
          src={chevronIcon}
          alt="Expand"
          className={`step-topic-expand-icon ${isExpanded ? "expanded" : ""}`}
        />
        <span className="step-topic-section-title">{title}</span>
        {badge && <span className="step-topic-section-badge">{badge}</span>}
      </button>
      {isExpanded && (
        <div className="step-topic-expandable-content">{children}</div>
      )}
    </div>
  );
};

export const StepTopic: React.FC<StepTopicProps> = ({
  topicName,
  description,
  timing,
  instructions,
  instructionsCount = 7,
  availableTopics,
  availableTopicsCount = 4,
}) => {
  return (
    <div className="step-topic step-topic--default">
      <div className="step-topic-header">
        <div className="step-topic-title">
          <img src={bookIcon} alt="Book" className="step-topic-icon" />
          Topic: {topicName}
        </div>
        {timing && (
          <div className="step-topic-timing">
            <img
              src={clockIcon}
              alt="Clock"
              className="step-topic-timing-icon"
            />
            {timing}
          </div>
        )}
      </div>
      <div className="step-topic-content">
        <p>{description}</p>
      </div>

      {instructions && (
        <ExpandableSection title="Instructions" badge={`${instructionsCount}`}>
          {instructions}
        </ExpandableSection>
      )}
      {availableTopics && (
        <ExpandableSection
          title="Available Topics"
          badge={`${availableTopicsCount} available`}
        >
          {availableTopics}
        </ExpandableSection>
      )}
    </div>
  );
};
