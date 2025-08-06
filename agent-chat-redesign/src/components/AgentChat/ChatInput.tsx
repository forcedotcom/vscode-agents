import React, { useState } from 'react';
import './ChatInput.css';
import sendIcon from '../../assets/send.svg';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Write something to start testing your agent..."
        className="chat-input-field"
      />
      <button type="submit" className="chat-input-button">
        <img src={sendIcon} alt="Send" className="send-icon" />
      </button>
    </form>
  );
};

export default ChatInput;