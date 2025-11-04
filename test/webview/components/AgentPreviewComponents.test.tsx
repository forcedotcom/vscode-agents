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
import { render, screen, fireEvent } from '@testing-library/react';

// Mock vscodeApi before any imports
jest.mock('../../../webview/src/services/vscodeApi', () => ({
  vscodeApi: {
    executeCommand: jest.fn()
  }
}));

import ChatMessage from '../../../webview/src/components/AgentPreview/ChatMessage';
import SystemMessage from '../../../webview/src/components/AgentPreview/SystemMessage';
import PlaceholderContent from '../../../webview/src/components/AgentPreview/PlaceholderContent';
import ChatContainer from '../../../webview/src/components/AgentPreview/ChatContainer';
import ChatInput from '../../../webview/src/components/AgentPreview/ChatInput';
import FormContainer from '../../../webview/src/components/AgentPreview/FormContainer';
import TabNavigation from '../../../webview/src/components/shared/TabNavigation';

import { vscodeApi } from '../../../webview/src/services/vscodeApi';

describe('AgentPreview Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ChatMessage', () => {
    it('should render user message', () => {
      render(<ChatMessage type="user" content="Hello" />);
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });

    it('should render agent message', () => {
      render(<ChatMessage type="agent" content="Hi there!" />);
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });

    it('should apply correct CSS class for user message', () => {
      const { container } = render(<ChatMessage type="user" content="Test" />);
      expect(container.querySelector('.chat-message.user')).toBeInTheDocument();
    });

    it('should apply correct CSS class for agent message', () => {
      const { container } = render(<ChatMessage type="agent" content="Test" />);
      expect(container.querySelector('.chat-message.agent')).toBeInTheDocument();
    });

    it('should render user icon alt text', () => {
      render(<ChatMessage type="user" content="Test" />);
      expect(screen.getByAltText('User')).toBeInTheDocument();
    });

    it('should render agent icon alt text', () => {
      render(<ChatMessage type="agent" content="Test" />);
      expect(screen.getByAltText('Agent')).toBeInTheDocument();
    });
  });

  describe('SystemMessage', () => {
    it('should render system message content', () => {
      render(<SystemMessage content="System notice" />);
      expect(screen.getByText('System notice')).toBeInTheDocument();
    });

    it('should apply session type class by default', () => {
      const { container } = render(<SystemMessage content="Test" />);
      expect(container.querySelector('.system-message.session')).toBeInTheDocument();
    });

    it('should apply debug type class', () => {
      const { container } = render(<SystemMessage content="Debug" type="debug" />);
      expect(container.querySelector('.system-message.debug')).toBeInTheDocument();
    });

    it('should apply error type class', () => {
      const { container } = render(<SystemMessage content="Error" type="error" />);
      expect(container.querySelector('.system-message.error')).toBeInTheDocument();
    });

    it('should render HTML content using dangerouslySetInnerHTML', () => {
      const { container } = render(<SystemMessage content="<strong>Bold</strong> text" />);
      const strong = container.querySelector('strong');
      expect(strong).toBeInTheDocument();
      expect(strong?.textContent).toBe('Bold');
    });

    it('should handle complex HTML', () => {
      const html = '<div><span class="test">Formatted</span> message</div>';
      const { container } = render(<SystemMessage content={html} />);
      expect(container.querySelector('.test')).toBeInTheDocument();
    });
  });

  describe('PlaceholderContent', () => {
    it('should render placeholder message', () => {
      render(<PlaceholderContent />);
      expect(screen.getByText(/Agent Preview lets you see what an agent can do/)).toBeInTheDocument();
    });

    it('should render select agent button', () => {
      render(<PlaceholderContent />);
      const button = screen.getByText('Select an Agent to Get Started');
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
    });

    it('should execute command when button is clicked', () => {
      render(<PlaceholderContent />);
      const button = screen.getByText('Select an Agent to Get Started');
      fireEvent.click(button);
      expect(vscodeApi.executeCommand).toHaveBeenCalledWith('sf.agent.combined.view.run');
    });

    it('should render placeholder icon div', () => {
      const { container } = render(<PlaceholderContent />);
      expect(container.querySelector('.placeholder-icon')).toBeInTheDocument();
    });

    it('should have correct CSS class', () => {
      const { container } = render(<PlaceholderContent />);
      expect(container.querySelector('.placeholder-content')).toBeInTheDocument();
    });
  });

  describe('ChatContainer', () => {
    const messages = [
      { id: '1', type: 'user' as const, content: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
      { id: '2', type: 'agent' as const, content: 'Hi!', timestamp: '2024-01-01T00:00:01Z' },
      { id: '3', type: 'system' as const, content: 'Debug info', systemType: 'debug' as const, timestamp: '2024-01-01T00:00:02Z' }
    ];

    it('should render all messages', () => {
      render(<ChatContainer messages={messages} />);
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi!')).toBeInTheDocument();
      expect(screen.getByText('Debug info')).toBeInTheDocument();
    });

    it('should render user and agent messages as ChatMessage components', () => {
      render(<ChatContainer messages={messages} />);
      expect(screen.getByAltText('User')).toBeInTheDocument();
      expect(screen.getByAltText('Agent')).toBeInTheDocument();
    });

    it('should render system messages as SystemMessage components', () => {
      const { container } = render(<ChatContainer messages={messages} />);
      expect(container.querySelector('.system-message')).toBeInTheDocument();
    });

    it('should show loading indicator when isLoading is true', () => {
      render(<ChatContainer messages={[]} isLoading={true} />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should show custom loading message', () => {
      render(<ChatContainer messages={[]} isLoading={true} loadingMessage="Processing..." />);
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('should not show loading indicator when isLoading is false', () => {
      render(<ChatContainer messages={[]} isLoading={false} />);
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('should render empty container when no messages', () => {
      const { container } = render(<ChatContainer messages={[]} />);
      expect(container.querySelector('.chat-container')).toBeInTheDocument();
      expect(container.querySelector('.chat-message')).not.toBeInTheDocument();
    });

    it('should render loading spinner', () => {
      const { container } = render(<ChatContainer messages={[]} isLoading={true} />);
      expect(container.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    it('should apply system message types correctly', () => {
      const sysMessages = [
        { id: '1', type: 'system' as const, content: 'Session msg', systemType: 'session' as const },
        { id: '2', type: 'system' as const, content: 'Error msg', systemType: 'error' as const }
      ];
      const { container } = render(<ChatContainer messages={sysMessages} />);
      expect(container.querySelector('.system-message.session')).toBeInTheDocument();
      expect(container.querySelector('.system-message.error')).toBeInTheDocument();
    });
  });

  describe('ChatInput', () => {
    it('should render input field', () => {
      render(<ChatInput onSendMessage={jest.fn()} />);
      const input = screen.getByPlaceholderText(/Write something to start testing/);
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });

    it('should render submit button', () => {
      const { container } = render(<ChatInput onSendMessage={jest.fn()} />);
      const button = container.querySelector('button[type="submit"]');
      expect(button).toBeInTheDocument();
    });

    it('should call onSendMessage when form is submitted', () => {
      const onSendMessage = jest.fn();
      render(<ChatInput onSendMessage={onSendMessage} />);

      const input = screen.getByPlaceholderText(/Write something to start testing/);
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.submit(input.closest('form')!);

      expect(onSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('should clear input after submission', () => {
      render(<ChatInput onSendMessage={jest.fn()} />);

      const input = screen.getByPlaceholderText(/Write something to start testing/) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.submit(input.closest('form')!);

      expect(input.value).toBe('');
    });

    it('should not submit empty message', () => {
      const onSendMessage = jest.fn();
      render(<ChatInput onSendMessage={onSendMessage} />);

      const input = screen.getByPlaceholderText(/Write something to start testing/);
      fireEvent.submit(input.closest('form')!);

      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should not submit whitespace-only message', () => {
      const onSendMessage = jest.fn();
      render(<ChatInput onSendMessage={onSendMessage} />);

      const input = screen.getByPlaceholderText(/Write something to start testing/);
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.submit(input.closest('form')!);

      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should disable input when disabled prop is true', () => {
      render(<ChatInput onSendMessage={jest.fn()} disabled={true} />);
      const input = screen.getByPlaceholderText(/Select to an agent to get started/);
      expect(input).toBeDisabled();
    });

    it('should show different placeholder when disabled', () => {
      render(<ChatInput onSendMessage={jest.fn()} disabled={true} />);
      expect(screen.getByPlaceholderText(/Select to an agent to get started/)).toBeInTheDocument();
    });

    it('should disable submit button when disabled', () => {
      const { container } = render(<ChatInput onSendMessage={jest.fn()} disabled={true} />);
      const button = container.querySelector('button[type="submit"]');
      expect(button).toBeDisabled();
    });

    it('should disable submit button when input is empty', () => {
      const { container } = render(<ChatInput onSendMessage={jest.fn()} />);
      const button = container.querySelector('button[type="submit"]');
      expect(button).toBeDisabled();
    });

    it('should enable submit button when input has text', () => {
      const { container } = render(<ChatInput onSendMessage={jest.fn()} />);
      const input = screen.getByPlaceholderText(/Write something to start testing/);
      fireEvent.change(input, { target: { value: 'Test' } });

      const button = container.querySelector('button[type="submit"]');
      expect(button).not.toBeDisabled();
    });

    it('should navigate history with arrow up', () => {
      const messages = [
        { id: '1', type: 'user' as const, content: 'First message', timestamp: '2024-01-01T00:00:00Z' },
        { id: '2', type: 'user' as const, content: 'Second message', timestamp: '2024-01-01T00:00:01Z' }
      ];

      render(<ChatInput onSendMessage={jest.fn()} messages={messages} />);
      const input = screen.getByPlaceholderText(/Write something to start testing/) as HTMLInputElement;

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.value).toBe('Second message');

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.value).toBe('First message');
    });

    it('should navigate history with arrow down', () => {
      const messages = [
        { id: '1', type: 'user' as const, content: 'First', timestamp: '2024-01-01T00:00:00Z' },
        { id: '2', type: 'user' as const, content: 'Second', timestamp: '2024-01-01T00:00:01Z' }
      ];

      render(<ChatInput onSendMessage={jest.fn()} messages={messages} />);
      const input = screen.getByPlaceholderText(/Write something to start testing/) as HTMLInputElement;

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.value).toBe('First');

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(input.value).toBe('Second');
    });

    it('should clear input when going down past most recent', () => {
      const messages = [
        { id: '1', type: 'user' as const, content: 'Message', timestamp: '2024-01-01T00:00:00Z' }
      ];

      render(<ChatInput onSendMessage={jest.fn()} messages={messages} />);
      const input = screen.getByPlaceholderText(/Write something to start testing/) as HTMLInputElement;

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.value).toBe('Message');

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(input.value).toBe('');
    });

    it('should not navigate beyond history bounds', () => {
      const messages = [
        { id: '1', type: 'user' as const, content: 'Only message', timestamp: '2024-01-01T00:00:00Z' }
      ];

      render(<ChatInput onSendMessage={jest.fn()} messages={messages} />);
      const input = screen.getByPlaceholderText(/Write something to start testing/) as HTMLInputElement;

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.value).toBe('Only message');

      // Try to go up again - should stay at the same message
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.value).toBe('Only message');
    });

    it('should reset history index after sending message', () => {
      const messages = [
        { id: '1', type: 'user' as const, content: 'Previous', timestamp: '2024-01-01T00:00:00Z' }
      ];

      render(<ChatInput onSendMessage={jest.fn()} messages={messages} />);
      const input = screen.getByPlaceholderText(/Write something to start testing/) as HTMLInputElement;

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.value).toBe('Previous');

      fireEvent.change(input, { target: { value: 'New message' } });
      fireEvent.submit(input.closest('form')!);

      expect(input.value).toBe('');
    });

    it('should filter only user messages from history', () => {
      const messages = [
        { id: '1', type: 'user' as const, content: 'User 1', timestamp: '2024-01-01T00:00:00Z' },
        { id: '2', type: 'agent' as const, content: 'Agent response', timestamp: '2024-01-01T00:00:01Z' },
        { id: '3', type: 'user' as const, content: 'User 2', timestamp: '2024-01-01T00:00:02Z' }
      ];

      render(<ChatInput onSendMessage={jest.fn()} messages={messages} />);
      const input = screen.getByPlaceholderText(/Write something to start testing/) as HTMLInputElement;

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.value).toBe('User 2');

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input.value).toBe('User 1');
    });
  });

  describe('FormContainer', () => {
    const defaultProps = {
      debugMode: false,
      onDebugModeChange: jest.fn(),
      onSendMessage: jest.fn(),
      sessionActive: false,
      isLoading: false
    };

    it('should render ChatInput inside container', () => {
      const { container } = render(<FormContainer {...defaultProps} />);
      expect(container.querySelector('.form-container')).toBeInTheDocument();
      expect(container.querySelector('input')).toBeInTheDocument();
    });

    it('should pass disabled prop to ChatInput when session not active', () => {
      render(<FormContainer {...defaultProps} sessionActive={false} />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('should not disable ChatInput when session is active', () => {
      render(<FormContainer {...defaultProps} sessionActive={true} />);
      const input = screen.getByRole('textbox');
      expect(input).not.toBeDisabled();
    });

    it('should pass onSendMessage to ChatInput', () => {
      const onSendMessage = jest.fn();
      render(<FormContainer {...defaultProps} onSendMessage={onSendMessage} sessionActive={true} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.submit(input.closest('form')!);

      expect(onSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('should pass messages prop to ChatInput for history', () => {
      const messages = [
        { id: '1', type: 'user' as const, content: 'Previous message' }
      ];
      render(<FormContainer {...defaultProps} messages={messages} sessionActive={true} />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      expect(input.value).toBe('Previous message');
    });
  });

  describe('TabNavigation', () => {
    it('should render preview tab', () => {
      render(<TabNavigation activeTab="preview" onTabChange={jest.fn()} />);
      expect(screen.getByText('Agent Preview')).toBeInTheDocument();
    });

    it('should not render tracer tab when showTracerTab is false', () => {
      render(<TabNavigation activeTab="preview" onTabChange={jest.fn()} showTracerTab={false} />);
      expect(screen.queryByText('Agent Tracer')).not.toBeInTheDocument();
    });

    it('should render tracer tab when showTracerTab is true', () => {
      render(<TabNavigation activeTab="preview" onTabChange={jest.fn()} showTracerTab={true} />);
      expect(screen.getByText('Agent Tracer')).toBeInTheDocument();
    });

    it('should apply active class to preview tab', () => {
      render(<TabNavigation activeTab="preview" onTabChange={jest.fn()} />);
      const previewTab = screen.getByText('Agent Preview').closest('button');
      expect(previewTab).toHaveClass('active');
    });

    it('should apply active class to tracer tab', () => {
      render(<TabNavigation activeTab="tracer" onTabChange={jest.fn()} showTracerTab={true} />);
      const tracerTab = screen.getByText('Agent Tracer').closest('button');
      expect(tracerTab).toHaveClass('active');
    });

    it('should call onTabChange when preview tab is clicked', () => {
      const onTabChange = jest.fn();
      render(<TabNavigation activeTab="tracer" onTabChange={onTabChange} showTracerTab={true} />);

      const previewTab = screen.getByText('Agent Preview');
      fireEvent.click(previewTab);

      expect(onTabChange).toHaveBeenCalledWith('preview');
    });

    it('should call onTabChange when tracer tab is clicked', () => {
      const onTabChange = jest.fn();
      render(<TabNavigation activeTab="preview" onTabChange={onTabChange} showTracerTab={true} />);

      const tracerTab = screen.getByText('Agent Tracer');
      fireEvent.click(tracerTab);

      expect(onTabChange).toHaveBeenCalledWith('tracer');
    });

    it('should render tab indicator', () => {
      const { container } = render(<TabNavigation activeTab="preview" onTabChange={jest.fn()} />);
      const indicator = container.querySelector('.tab-navigation-indicator');
      expect(indicator).toBeInTheDocument();
    });
  });
});
