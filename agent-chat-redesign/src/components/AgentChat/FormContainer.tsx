import React from 'react';
import AgentSelector from './AgentSelector';
import DebugToggle from './DebugToggle';
import ChatInput from './ChatInput';
import './FormContainer.css';

interface FormContainerProps {
  debugMode: boolean;
  onDebugModeChange: (enabled: boolean) => void;
  onSendMessage: (message: string) => void;
}

const FormContainer: React.FC<FormContainerProps> = ({
  debugMode,
  onDebugModeChange,
  onSendMessage
}) => {
  return (
    <div className="form-container">
      <div className="form-controls">
        <AgentSelector />
        <DebugToggle isEnabled={debugMode} onChange={onDebugModeChange} />
      </div>
      <ChatInput onSendMessage={onSendMessage} />
    </div>
  );
};

export default FormContainer;