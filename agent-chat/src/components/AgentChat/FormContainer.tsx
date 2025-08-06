import React from 'react';
import DebugToggle from './DebugToggle';
import ChatInput from './ChatInput';
import './FormContainer.css';
import chevronIcon from '../../assets/chevron.svg';

interface FormContainerProps {
  debugMode: boolean;
  onDebugModeChange: (enabled: boolean) => void;
  onSendMessage: (message: string) => void;
  sendDisabled: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  vscode: any;
}

const FormContainer: React.FC<FormContainerProps> = ({
  debugMode,
  onDebugModeChange,
  onSendMessage,
  sendDisabled,
  inputRef,
  vscode
}) => {
  const handleSelectAgent = () => {
    if (vscode) {
      vscode.postMessage({ command: 'triggerAgentSelection' });
    }
  };

  return (
    <div className="form-container">
      <div className="form-controls">
        <div className="agent-select-button" onClick={handleSelectAgent}>
          <span className="agent-select-text">Select an Agent</span>
          <img src={chevronIcon} alt="Chevron" className="chevron-icon" />
        </div>
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