import React, { useState, useEffect } from 'react';
import './ChatInput.css';

interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  systemType?: 'session' | 'debug' | 'error';
  timestamp?: string;
}

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  messages?: Message[];
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled = false, messages = [] }) => {
  const [message, setMessage] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [userMessageHistory, setUserMessageHistory] = useState<string[]>([]);

  // Update user message history when messages change
  useEffect(() => {
    const userMessages = messages
      .filter(msg => msg.type === 'user')
      .map(msg => msg.content)
      .reverse(); // Most recent first
    setUserMessageHistory(userMessages);
    setHistoryIndex(-1); // Reset history index when messages update
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage('');
      setHistoryIndex(-1); // Reset history index after sending
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (userMessageHistory.length > 0) {
        const nextIndex = historyIndex + 1;
        if (nextIndex < userMessageHistory.length) {
          setMessage(userMessageHistory[nextIndex]);
          setHistoryIndex(nextIndex);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setMessage(userMessageHistory[nextIndex]);
        setHistoryIndex(nextIndex);
      } else if (historyIndex === 0) {
        setMessage('');
        setHistoryIndex(-1);
      }
    }
  };

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <input
        type="text"
        value={message}
        onChange={e => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Select to an agent to get started…' : 'Write something to start testing…'}
        className="chat-input-field"
        disabled={disabled}
      />
      <button type="submit" className="chat-input-button" disabled={disabled || !message.trim()}>
        <span className="send-icon"></span>
      </button>
    </form>
  );
};

export default ChatInput;
