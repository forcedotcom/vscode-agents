import React from 'react';
import AgentSelector from './AgentSelector';
import DebugToggle from './DebugToggle';
import ChatInput from './ChatInput';
import './FormContainer.css';

interface AgentOption {
  Id: string;
  MasterLabel: string;
}

interface FormContainerProps {
  debugMode: boolean;
  onDebugModeChange: (enabled: boolean) => void;
  onSendMessage: (message: string) => void;
  agents: AgentOption[];
  currentAgent: string;
  selectable: boolean;
  onAgentSelect: (agentId: string) => void;
  onEndSession: () => void;
  sendDisabled: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
}

const FormContainer: React.FC<FormContainerProps> = ({
  debugMode,
  onDebugModeChange,
  onSendMessage,
  agents,
  currentAgent,
  selectable,
  onAgentSelect,
  onEndSession,
  sendDisabled,
  inputRef
}) => {
  return (
    <div className="form-container">
      <div className="form-controls">
        <AgentSelector 
          agents={agents}
          currentAgent={currentAgent}
          selectable={selectable}
          onAgentSelect={onAgentSelect}
          onEndSession={onEndSession}
        />
        <DebugToggle isEnabled={debugMode} onChange={onDebugModeChange} />
      </div>
      <ChatInput 
        onSendMessage={onSendMessage}
        disabled={sendDisabled}
        inputRef={inputRef}
      />
    </div>
  );
};

export default FormContainer;