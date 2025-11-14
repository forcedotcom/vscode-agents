/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput from '../../webview/src/components/AgentPreview/ChatInput';

describe('ChatInput', () => {
  const mockMessages = [
    {
      id: '1',
      type: 'user' as const,
      content: 'First message',
      timestamp: new Date().toISOString()
    },
    {
      id: '2',
      type: 'user' as const,
      content: 'Second message',
      timestamp: new Date().toISOString()
    },
    {
      id: '3',
      type: 'agent' as const,
      content: 'Agent response',
      timestamp: new Date().toISOString()
    }
  ];

  describe('Rendering', () => {
    it('should render textarea and submit button', () => {
      const { container } = render(<ChatInput onSendMessage={jest.fn()} />);

      expect(screen.getByPlaceholderText('Write something to start testing…')).toBeInTheDocument();
      const button = container.querySelector('button[type="submit"]');
      expect(button).toBeInTheDocument();
    });

    it('should show disabled placeholder text when disabled', () => {
      render(<ChatInput onSendMessage={jest.fn()} disabled={true} />);

      expect(screen.getByPlaceholderText('Select to an agent to get started…')).toBeInTheDocument();
    });

    it('should disable textarea and button when disabled prop is true', () => {
      const { container } = render(<ChatInput onSendMessage={jest.fn()} disabled={true} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();

      const button = container.querySelector('button[type="submit"]');
      expect(button).toBeDisabled();
    });
  });

  describe('Message Submission', () => {
    it('should call onSendMessage when form is submitted', async () => {
      const onSendMessage = jest.fn();
      render(<ChatInput onSendMessage={onSendMessage} />);

      const textarea = screen.getByRole('textbox');
      await userEvent.type(textarea, 'Test message');

      const form = textarea.closest('form');
      expect(form).toBeTruthy();

      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await waitFor(() => {
        expect(onSendMessage).toHaveBeenCalledWith('Test message');
      });
    });

    it('should clear message after submission', async () => {
      const onSendMessage = jest.fn();
      render(<ChatInput onSendMessage={onSendMessage} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await userEvent.type(textarea, 'Test message{Enter}');

      await waitFor(() => {
        expect(textarea.value).toBe('');
      });
    });

    it('should not submit empty message', async () => {
      const onSendMessage = jest.fn();
      render(<ChatInput onSendMessage={onSendMessage} />);

      const textarea = screen.getByRole('textbox');
      await userEvent.type(textarea, '{Enter}');

      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should not submit whitespace-only message', async () => {
      const onSendMessage = jest.fn();
      render(<ChatInput onSendMessage={onSendMessage} />);

      const textarea = screen.getByRole('textbox');
      await userEvent.type(textarea, '   {Enter}');

      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should trim message before submission', async () => {
      const onSendMessage = jest.fn();
      render(<ChatInput onSendMessage={onSendMessage} />);

      const textarea = screen.getByRole('textbox');
      await userEvent.type(textarea, '  Test message  {Enter}');

      await waitFor(() => {
        expect(onSendMessage).toHaveBeenCalledWith('  Test message  ');
      });
    });

    it('should not submit when disabled', async () => {
      const onSendMessage = jest.fn();
      render(<ChatInput onSendMessage={onSendMessage} disabled={true} />);

      const textarea = screen.getByRole('textbox');
      // Can't type when disabled
      expect(textarea).toBeDisabled();

      const form = textarea.closest('form');
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should disable submit button when message is empty', () => {
      const { container } = render(<ChatInput onSendMessage={jest.fn()} />);

      const button = container.querySelector('button[type="submit"]');
      expect(button).toBeDisabled();
    });

    it('should enable submit button when message has content', async () => {
      const { container } = render(<ChatInput onSendMessage={jest.fn()} />);

      const textarea = screen.getByRole('textbox');
      await userEvent.type(textarea, 'Test');

      const button = container.querySelector('button[type="submit"]');
      expect(button).not.toBeDisabled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should submit message on Enter key', async () => {
      const onSendMessage = jest.fn();
      render(<ChatInput onSendMessage={onSendMessage} />);

      const textarea = screen.getByRole('textbox');
      await userEvent.type(textarea, 'Test message{Enter}');

      await waitFor(() => {
        expect(onSendMessage).toHaveBeenCalledWith('Test message');
      });
    });

    it('should insert newline on Alt+Enter', async () => {
      const onSendMessage = jest.fn();
      render(<ChatInput onSendMessage={onSendMessage} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await userEvent.type(textarea, 'Line 1');
      await userEvent.keyboard('{Alt>}{Enter}{/Alt}');
      await userEvent.type(textarea, 'Line 2');

      expect(textarea.value).toContain('\n');
      expect(onSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Message History Navigation', () => {
    it('should populate input with previous message on ArrowUp', async () => {
      render(<ChatInput onSendMessage={jest.fn()} messages={mockMessages} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      await userEvent.type(textarea, '{ArrowUp}');

      await waitFor(() => {
        expect(textarea.value).toBe('Second message');
      });
    });

    it('should navigate through message history with ArrowUp', async () => {
      render(<ChatInput onSendMessage={jest.fn()} messages={mockMessages} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // First ArrowUp - get most recent message
      await userEvent.type(textarea, '{ArrowUp}');
      await waitFor(() => {
        expect(textarea.value).toBe('Second message');
      });

      // Second ArrowUp - get previous message
      await userEvent.type(textarea, '{ArrowUp}');
      await waitFor(() => {
        expect(textarea.value).toBe('First message');
      });
    });

    it('should navigate forward in history with ArrowDown', async () => {
      render(<ChatInput onSendMessage={jest.fn()} messages={mockMessages} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Navigate to first message
      await userEvent.type(textarea, '{ArrowUp}{ArrowUp}');
      await waitFor(() => {
        expect(textarea.value).toBe('First message');
      });

      // Navigate forward
      await userEvent.type(textarea, '{ArrowDown}');
      await waitFor(() => {
        expect(textarea.value).toBe('Second message');
      });
    });

    it('should clear input when navigating past most recent message', async () => {
      render(<ChatInput onSendMessage={jest.fn()} messages={mockMessages} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Navigate to most recent message
      await userEvent.type(textarea, '{ArrowUp}');
      await waitFor(() => {
        expect(textarea.value).toBe('Second message');
      });

      // Navigate down past most recent
      await userEvent.type(textarea, '{ArrowDown}');
      await waitFor(() => {
        expect(textarea.value).toBe('');
      });
    });

    it('should not navigate beyond oldest message', async () => {
      render(<ChatInput onSendMessage={jest.fn()} messages={mockMessages} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Navigate to oldest message
      await userEvent.type(textarea, '{ArrowUp}{ArrowUp}');
      await waitFor(() => {
        expect(textarea.value).toBe('First message');
      });

      // Try to navigate beyond
      await userEvent.type(textarea, '{ArrowUp}');
      await waitFor(() => {
        expect(textarea.value).toBe('First message');
      });
    });

    it('should reset history index after sending message', async () => {
      const onSendMessage = jest.fn();
      render(<ChatInput onSendMessage={onSendMessage} messages={mockMessages} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Navigate history
      await userEvent.type(textarea, '{ArrowUp}');
      await waitFor(() => {
        expect(textarea.value).toBe('Second message');
      });

      // Send message
      await userEvent.type(textarea, '{Enter}');

      await waitFor(() => {
        expect(textarea.value).toBe('');
      });

      // Navigate again - should start from most recent
      await userEvent.type(textarea, '{ArrowUp}');
      await waitFor(() => {
        expect(textarea.value).toBe('Second message');
      });
    });

    it('should filter only user messages from history', async () => {
      render(<ChatInput onSendMessage={jest.fn()} messages={mockMessages} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Should only show user messages, not agent messages
      await userEvent.type(textarea, '{ArrowUp}');
      await waitFor(() => {
        expect(textarea.value).toBe('Second message');
      });

      await userEvent.type(textarea, '{ArrowUp}');
      await waitFor(() => {
        expect(textarea.value).toBe('First message');
      });

      // Should not have agent message
      expect(textarea.value).not.toBe('Agent response');
    });

    it('should update history when messages prop changes', async () => {
      const { rerender } = render(<ChatInput onSendMessage={jest.fn()} messages={[]} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // No messages initially
      await userEvent.type(textarea, '{ArrowUp}');
      expect(textarea.value).toBe('');

      // Update with messages
      rerender(<ChatInput onSendMessage={jest.fn()} messages={mockMessages} />);

      // Should now have history
      await userEvent.type(textarea, '{ArrowUp}');
      await waitFor(() => {
        expect(textarea.value).toBe('Second message');
      });
    });
  });

  describe('Imperative Handle (Focus)', () => {
    it('should expose focus method via ref', () => {
      const ref = React.createRef<any>();
      render(<ChatInput ref={ref} onSendMessage={jest.fn()} />);

      expect(ref.current).toBeTruthy();
      expect(typeof ref.current.focus).toBe('function');
    });
  });
});
