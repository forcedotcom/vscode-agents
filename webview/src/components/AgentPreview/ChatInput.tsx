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
  isLiveMode?: boolean;
}

export interface ChatInputRef {
  focus: () => void;
}

const HISTORY_STORAGE_KEY = 'chatInputHistory';
const MAX_HISTORY_SIZE = 100;

// Helper functions for localStorage
const loadHistory = (): string[] => {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load chat history:', error);
    return [];
  }
};

const saveHistory = (history: string[]) => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to save chat history:', error);
  }
};

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  ({ onSendMessage, disabled = false, isLiveMode = false }, ref) => {
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

    // Load persistent message history on mount
    useEffect(() => {
      const history = loadHistory();
      setUserMessageHistory(history);
    }, []);

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

    // Refocus input when it transitions from disabled to enabled
    const prevDisabledRef = useRef(disabled);
    useEffect(() => {
      if (prevDisabledRef.current && !disabled) {
        // Was disabled, now enabled - refocus
        textareaRef.current?.focus();
      }
      prevDisabledRef.current = disabled;
    }, [disabled]);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (message.trim() && !disabled) {
        // Add message to persistent history
        const trimmedMessage = message.trim();
        const updatedHistory = [trimmedMessage, ...userMessageHistory].slice(0, MAX_HISTORY_SIZE);
        setUserMessageHistory(updatedHistory);
        saveHistory(updatedHistory);

        onSendMessage(message);
        setMessage('');
        setHistoryIndex(-1); // Reset history index after sending
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle Enter key: submit on Enter, newline on Alt+Enter or Shift+Enter
      if (e.key === 'Enter') {
        if (e.altKey || e.shiftKey) {
          // Alt+Enter or Shift+Enter: insert newline at cursor position
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
          placeholder={
            disabled
              ? isLiveMode
                ? 'Start the live test to chat…'
                : 'Start the simulation to chat…'
              : 'Write something to start testing…'
          }
          className="chat-input-field"
          disabled={disabled}
          rows={1}
        />
        <button type="submit" className="chat-input-button" disabled={disabled || !message.trim()}>
          <span className="send-icon"></span>
        </button>
      </form>
    );
  }
);

ChatInput.displayName = 'ChatInput';

export default ChatInput;
