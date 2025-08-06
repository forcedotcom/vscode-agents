import React from "react";
import chevronIcon from "../../assets/chevron.svg";
import "./SessionInfo.css";

interface SessionInfoProps {
  date: string;
  sessionId: string;
  isExpanded?: boolean;
}

export const SessionInfo: React.FC<SessionInfoProps> = ({
  date,
  sessionId,
  isExpanded = true,
}) => {
  return (
    <div className="session-info">
      <img
        src={chevronIcon}
        alt="Expand"
        className={`session-icon ${isExpanded ? "expanded" : ""}`}
      />
      <span className="session-title">{date}</span>
      <span className="session-id">Session ID: {sessionId}</span>
    </div>
  );
};
