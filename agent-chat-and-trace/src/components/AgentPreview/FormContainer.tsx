import React from 'react';
import AgentSelector from './AgentSelector';
import DebugToggle from './DebugToggle';
import ChatInput from './ChatInput';
import './FormContainer.css';

interface FormContainerProps {
  debugMode: boolean;
  onDebugModeChange: (enabled: boolean) => void;
  onSendMessage: (message: string) => void;
  onClearChat: () => void;
  sessionActive: boolean;
  isLoading: boolean;
}

const FormContainer: React.FC<FormContainerProps> = ({
  debugMode,
  onDebugModeChange,
  onSendMessage,
  onClearChat,
  sessionActive,
  isLoading
}) => {
  return (
    <div className="form-container">
      <div className="form-controls">
        <AgentSelector />
        <DebugToggle isEnabled={debugMode} onChange={onDebugModeChange} />
        <button 
          className="clear-chat-button" 
          onClick={onClearChat}
          disabled={!sessionActive}
        >
          Clear Chat
        </button>
      </div>
      <ChatInput 
        onSendMessage={onSendMessage} 
        disabled={!sessionActive || isLoading}
      />
    </div>
  );
};

export default FormContainer;