import { forwardRef } from 'react';
import ChatInput, { ChatInputRef } from './ChatInput.js';
import './FormContainer.css';

interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  systemType?: 'session' | 'debug' | 'error' | 'warning';
  timestamp?: string;
}

interface FormContainerProps {
  onSendMessage: (message: string) => void;
  sessionActive: boolean; // Now represents agent connection status
  isLoading: boolean;
  messages?: Message[];
}

const FormContainer = forwardRef<ChatInputRef, FormContainerProps>(({
  onSendMessage,
  sessionActive,
  isLoading: _isLoading, // Renamed to indicate it's intentionally unused
  messages = []
}, ref) => {
  return (
    <div className="form-container">
      <ChatInput ref={ref} onSendMessage={onSendMessage} disabled={!sessionActive} messages={messages} />
    </div>
  );
});

FormContainer.displayName = 'FormContainer';

export default FormContainer;
