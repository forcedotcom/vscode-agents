import React from 'react';
import DebugToggle from './DebugToggle';
import ChatInput from './ChatInput';
import './FormContainer.css';

interface FormContainerProps {
  debugMode: boolean;
  onDebugModeChange: (enabled: boolean) => void;
  onSendMessage: (message: string) => void;
  sendDisabled: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
}

const FormContainer: React.FC<FormContainerProps> = ({
  debugMode,
  onDebugModeChange,
  onSendMessage,
  sendDisabled,
  inputRef
}) => {
  return (
    <div className="form-container">
      <div className="form-controls">
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