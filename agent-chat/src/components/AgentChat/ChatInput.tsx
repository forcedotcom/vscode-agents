import React, { useState } from 'react';
import './ChatInput.css';
import sendIcon from '../../assets/send.svg';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  disabled = false,
  inputRef 
}) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Write something to start testing your agent..."
        className="chat-input-field"
        disabled={disabled}
      />
      <button 
        type="submit" 
        className="chat-input-button"
        disabled={disabled || !message.trim()}
      >
        <img src={sendIcon} alt="Send" className="send-icon" />
      </button>
    </form>
  );
};

export default ChatInput;