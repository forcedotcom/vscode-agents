import React from 'react';
import AgentSelector from './AgentSelector';
import DebugToggle from './DebugToggle';
import ChatInput from './ChatInput';
import './FormContainer.css';

interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  systemType?: 'session' | 'debug' | 'error';
  timestamp?: string;
}

interface FormContainerProps {
  debugMode: boolean;
  onDebugModeChange: (enabled: boolean) => void;
  onSendMessage: (message: string) => void;
  onClearChat: () => void;
  sessionActive: boolean; // Now represents agent connection status
  isLoading: boolean;
  messages?: Message[];
  onClientAppRequired?: (data: any) => void;
  onClientAppSelection?: (data: any) => void;
  selectedAgent: string;
  onAgentChange: (agentId: string) => void;
}

const FormContainer: React.FC<FormContainerProps> = ({
  debugMode,
  onDebugModeChange,
  onSendMessage,
  onClearChat,
  sessionActive,
  isLoading: _isLoading, // Renamed to indicate it's intentionally unused
  messages = [],
  onClientAppRequired,
  onClientAppSelection,
  selectedAgent,
  onAgentChange
}) => {
  return (
    <div className="form-container">
      <div className="form-controls">
        <AgentSelector
          onClientAppRequired={onClientAppRequired}
          onClientAppSelection={onClientAppSelection}
          selectedAgent={selectedAgent}
          onAgentChange={onAgentChange}
        />
        <DebugToggle isEnabled={debugMode} onChange={onDebugModeChange} />
        <button className="clear-chat-button" onClick={onClearChat}>
          Reset
        </button>
      </div>
      <ChatInput onSendMessage={onSendMessage} disabled={!sessionActive} messages={messages} />
    </div>
  );
};

export default FormContainer;
