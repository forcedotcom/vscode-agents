import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput, { ChatInputRef } from '../../webview/src/components/AgentPreview/ChatInput';

describe('ChatInput', () => {
  let localStorageMock: { [key: string]: string } = {};

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    Storage.prototype.getItem = jest.fn((key: string) => localStorageMock[key] || null);
    Storage.prototype.setItem = jest.fn((key: string, value: string) => {
      localStorageMock[key] = value;
    });
    Storage.prototype.clear = jest.fn(() => {
      localStorageMock = {};
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
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

  it('inserts newline on Shift+Enter without sending', async () => {
    const onSendMessage = jest.fn();
    render(<ChatInput onSendMessage={onSendMessage} disabled={false} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await userEvent.type(textarea, 'Line 1');

    fireEvent.keyDown(textarea, {
      key: 'Enter',
      shiftKey: true,
      currentTarget: textarea
    });

    expect(textarea.value).toBe('Line 1\n');
    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it('navigates user message history with arrow keys', () => {
    // Pre-populate localStorage with message history
    localStorageMock['chatInputHistory'] = JSON.stringify(['Second message', 'First message']);

    render(<ChatInput onSendMessage={jest.fn()} disabled={false} />);

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

  it('persists message history across sessions', async () => {
    const user = userEvent.setup();
    const onSendMessage = jest.fn();

    // First session: send a message
    const { unmount } = render(<ChatInput onSendMessage={onSendMessage} disabled={false} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'First message');
    await user.type(textarea, '{Enter}');

    // Verify message was saved to localStorage
    expect(localStorageMock['chatInputHistory']).toBe(JSON.stringify(['First message']));

    unmount();

    // Second session: verify history is loaded
    render(<ChatInput onSendMessage={onSendMessage} disabled={false} />);
    const textarea2 = screen.getByRole('textbox');
    textarea2.focus();

    fireEvent.keyDown(textarea2, { key: 'ArrowUp', currentTarget: textarea2 });
    expect(textarea2).toHaveValue('First message');
  });

  it('maintains history across multiple messages', async () => {
    const user = userEvent.setup();
    const onSendMessage = jest.fn();

    render(<ChatInput onSendMessage={onSendMessage} disabled={false} />);
    const textarea = screen.getByRole('textbox');

    // Send first message
    await user.type(textarea, 'First message');
    await user.type(textarea, '{Enter}');

    // Send second message
    await user.type(textarea, 'Second message');
    await user.type(textarea, '{Enter}');

    // Send third message
    await user.type(textarea, 'Third message');
    await user.type(textarea, '{Enter}');

    // Verify all messages are in localStorage in correct order (most recent first)
    const storedHistory = JSON.parse(localStorageMock['chatInputHistory']);
    expect(storedHistory).toEqual(['Third message', 'Second message', 'First message']);

    // Navigate through history
    fireEvent.keyDown(textarea, { key: 'ArrowUp', currentTarget: textarea });
    expect(textarea).toHaveValue('Third message');

    fireEvent.keyDown(textarea, { key: 'ArrowUp', currentTarget: textarea });
    expect(textarea).toHaveValue('Second message');

    fireEvent.keyDown(textarea, { key: 'ArrowUp', currentTarget: textarea });
    expect(textarea).toHaveValue('First message');
  });

  it('exposes focus method through ref', () => {
    const ref = React.createRef<ChatInputRef>();
    render(<ChatInput ref={ref} onSendMessage={jest.fn()} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    expect(document.activeElement).not.toBe(textarea);

    ref.current?.focus();

    expect(document.activeElement).toBe(textarea);
  });

  it('shows simulation placeholder when input is disabled and not in live mode', () => {
    render(<ChatInput onSendMessage={jest.fn()} disabled={true} isLiveMode={false} />);
    expect(screen.getByPlaceholderText('Type something to start the simulation...')).toBeDisabled();
  });

  it('shows live test placeholder when input is disabled and in live mode', () => {
    render(<ChatInput onSendMessage={jest.fn()} disabled={true} isLiveMode={true} />);
    expect(screen.getByPlaceholderText('Type something to start the live test...')).toBeDisabled();
  });

  it('shows default placeholder when enabled', () => {
    render(<ChatInput onSendMessage={jest.fn()} disabled={false} />);
    expect(screen.getByPlaceholderText('Type something to start testing...')).toBeInTheDocument();
  });
});
