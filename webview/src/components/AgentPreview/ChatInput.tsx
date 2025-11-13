import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import './ChatInput.css';

interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  systemType?: 'session' | 'debug' | 'error' | 'warning';
  timestamp?: string;
}

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  messages?: Message[];
}

export interface ChatInputRef {
  focus: () => void;
}

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(({ onSendMessage, disabled = false, messages = [] }, ref) => {
  const [message, setMessage] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [userMessageHistory, setUserMessageHistory] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Expose focus method to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    }
  }));

  // Update user message history when messages change
  useEffect(() => {
    const userMessages = messages
      .filter(msg => msg.type === 'user')
      .map(msg => msg.content)
      .reverse(); // Most recent first
    setUserMessageHistory(userMessages);
    setHistoryIndex(-1); // Reset history index when messages update
  }, [messages]);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight (content height)
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage('');
      setHistoryIndex(-1); // Reset history index after sending
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Enter key: submit on Enter, newline on Alt+Enter
    if (e.key === 'Enter') {
      if (e.altKey) {
        // Alt+Enter: insert newline at cursor position
        e.preventDefault();
        const target = e.currentTarget;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newMessage = message.substring(0, start) + '\n' + message.substring(end);
        setMessage(newMessage);
        // Set cursor position after the inserted newline
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 1;
        }, 0);
        return;
      } else {
        // Regular Enter: submit message
        e.preventDefault();
        handleSubmit(e);
        return;
      }
    }

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
      <textarea
        ref={textareaRef}
        value={message}
        onChange={e => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Select to an agent to get started…' : 'Write something to start testing…'}
        className="chat-input-field"
        disabled={disabled}
        rows={1}
      />
      <button type="submit" className="chat-input-button" disabled={disabled || !message.trim()}>
        <span className="send-icon"></span>
      </button>
    </form>
  );
});

ChatInput.displayName = 'ChatInput';

export default ChatInput;
