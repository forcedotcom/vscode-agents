import React from 'react';
import ChatInput from './ChatInput.js';
import './FormContainer.css';

interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  systemType?: 'session' | 'debug' | 'error' | 'warning';
  timestamp?: string;
}

interface FormContainerProps {
  debugMode: boolean;
  onDebugModeChange: (enabled: boolean) => void;
  onSendMessage: (message: string) => void;
  sessionActive: boolean; // Now represents agent connection status
  isLoading: boolean;
  messages?: Message[];
}

const FormContainer: React.FC<FormContainerProps> = ({
  debugMode: _debugMode,
  onDebugModeChange: _onDebugModeChange,
  onSendMessage,
  sessionActive,
  isLoading: _isLoading, // Renamed to indicate it's intentionally unused
  messages = []
}) => {
  return (
    <div className="form-container">
      <ChatInput onSendMessage={onSendMessage} disabled={!sessionActive} messages={messages} />
    </div>
  );
};

export default FormContainer;
