import React from 'react';
import './PlaceholderContent.css';

const PlaceholderContent: React.FC = () => {
  return (
    <div className="placeholder-content">
      <h3>Welcome to Agent Chat</h3>
      <p>Select an agent from the dropdown above to start a conversation.</p>
      <p>
        <strong>Note:</strong> Agents are loaded from your Salesforce org. Only active agents are shown.
      </p>
    </div>
  );
};

export default PlaceholderContent;
