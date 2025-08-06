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
  const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

  const handleSelectAgent = (e: React.MouseEvent) => {
    e.preventDefault();
    if (vscode) {
      vscode.postMessage({ command: 'triggerAgentSelection' });
    }
  };

  return (
    <div className="form-container">
      <div className="form-controls">
        <a href="#" className="select-agent-link" onClick={handleSelectAgent}>Select an Agent</a>
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