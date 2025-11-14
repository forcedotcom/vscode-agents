import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput, { ChatInputRef } from '../../webview/src/components/AgentPreview/ChatInput';

describe('ChatInput', () => {
  it('submits message on Enter and clears the field', async () => {
    const user = userEvent.setup();
    const onSendMessage = jest.fn();
    render(<ChatInput onSendMessage={onSendMessage} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello world');
    await user.type(textarea, '{Enter}');

    expect(onSendMessage).toHaveBeenCalledWith('Hello world');
    expect(textarea).toHaveValue('');
  });

  it('inserts newline on Alt+Enter without sending', async () => {
    const onSendMessage = jest.fn();
    render(<ChatInput onSendMessage={onSendMessage} disabled={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await userEvent.type(textarea, 'Line 1');

    fireEvent.keyDown(textarea, {
      key: 'Enter',
      altKey: true,
      currentTarget: textarea
    });

    expect(textarea.value).toBe('Line 1\n');
    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it('navigates user message history with arrow keys', () => {
    const messages = [
      { id: '1', type: 'user', content: 'First message' },
      { id: '2', type: 'agent', content: 'Agent reply' },
      { id: '3', type: 'user', content: 'Second message' }
    ];

    render(<ChatInput onSendMessage={jest.fn()} disabled={false} messages={messages as any} />);

    const textarea = screen.getByRole('textbox');
    textarea.focus();

    fireEvent.keyDown(textarea, { key: 'ArrowUp', currentTarget: textarea });
    expect(textarea).toHaveValue('Second message');

    fireEvent.keyDown(textarea, { key: 'ArrowUp', currentTarget: textarea });
    expect(textarea).toHaveValue('First message');

    fireEvent.keyDown(textarea, { key: 'ArrowDown', currentTarget: textarea });
    expect(textarea).toHaveValue('Second message');

    fireEvent.keyDown(textarea, { key: 'ArrowDown', currentTarget: textarea });
    expect(textarea).toHaveValue('');
  });

  it('exposes focus method through ref', () => {
    const ref = React.createRef<ChatInputRef>();
    render(<ChatInput ref={ref} onSendMessage={jest.fn()} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    expect(document.activeElement).not.toBe(textarea);

    ref.current?.focus();

    expect(document.activeElement).toBe(textarea);
  });

  it('shows disabled placeholder when input is disabled', () => {
    render(<ChatInput onSendMessage={jest.fn()} disabled={true} />);
    expect(screen.getByPlaceholderText('Select to an agent to get started…')).toBeDisabled();
  });

  it('shows default placeholder when enabled', () => {
    render(<ChatInput onSendMessage={jest.fn()} disabled={false} />);
    expect(screen.getByPlaceholderText('Write something to start testing…')).toBeInTheDocument();
  });
});
