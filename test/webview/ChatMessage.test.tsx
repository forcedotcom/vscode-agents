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
import { render, screen } from '@testing-library/react';
import ChatMessage from '../../webview/src/components/AgentPreview/ChatMessage';

describe('ChatMessage', () => {
  describe('Rendering', () => {
    it('should render user message', () => {
      render(<ChatMessage type="user" content="Hello" />);

      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByAltText('User')).toBeInTheDocument();
    });

    it('should render agent message', () => {
      render(<ChatMessage type="agent" content="Hi there" />);

      expect(screen.getByText('Hi there')).toBeInTheDocument();
      expect(screen.getByAltText('Agent')).toBeInTheDocument();
    });

    it('should apply user class for user messages', () => {
      const { container } = render(<ChatMessage type="user" content="Test" />);
      const messageDiv = container.querySelector('.chat-message');
      expect(messageDiv).toHaveClass('user');
    });

    it('should apply agent class for agent messages', () => {
      const { container } = render(<ChatMessage type="agent" content="Test" />);
      const messageDiv = container.querySelector('.chat-message');
      expect(messageDiv).toHaveClass('agent');
    });
  });

  describe('Multiline Content', () => {
    it('should preserve newlines in single-line messages', () => {
      const { container } = render(<ChatMessage type="user" content="Single line" />);
      const messageContent = container.querySelector('.message-content');

      expect(messageContent).toHaveTextContent('Single line');
    });

    it('should preserve newlines in multiline messages', () => {
      const multilineContent = 'Line 1\nLine 2\nLine 3';
      const { container } = render(<ChatMessage type="user" content={multilineContent} />);
      const messageContent = container.querySelector('.message-content');

      // Check that content includes newlines
      expect(messageContent?.textContent).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should apply pre-wrap style to preserve formatting', () => {
      const { container } = render(<ChatMessage type="user" content="Test\nContent" />);
      const messageContent = container.querySelector('.message-content');

      // Verify the CSS class is applied (which has white-space: pre-wrap)
      expect(messageContent).toHaveClass('message-content');
    });

    it('should handle messages with multiple consecutive newlines', () => {
      const content = 'Line 1\n\n\nLine 2';
      const { container } = render(<ChatMessage type="user" content={content} />);
      const messageContent = container.querySelector('.message-content');

      expect(messageContent?.textContent).toBe('Line 1\n\n\nLine 2');
    });

    it('should handle messages with leading newlines', () => {
      const content = '\n\nLeading newlines';
      const { container } = render(<ChatMessage type="user" content={content} />);
      const messageContent = container.querySelector('.message-content');

      expect(messageContent?.textContent).toBe('\n\nLeading newlines');
    });

    it('should handle messages with trailing newlines', () => {
      const content = 'Trailing newlines\n\n';
      const { container } = render(<ChatMessage type="user" content={content} />);
      const messageContent = container.querySelector('.message-content');

      expect(messageContent?.textContent).toBe('Trailing newlines\n\n');
    });

    it('should handle empty messages', () => {
      const { container } = render(<ChatMessage type="user" content="" />);
      const messageContent = container.querySelector('.message-content');

      expect(messageContent?.textContent).toBe('');
    });

    it('should preserve spaces in messages', () => {
      const content = 'Text  with   multiple    spaces';
      const { container } = render(<ChatMessage type="user" content={content} />);
      const messageContent = container.querySelector('.message-content');

      expect(messageContent?.textContent).toBe('Text  with   multiple    spaces');
    });
  });

  describe('Icon Display', () => {
    it('should render user icon for user messages', () => {
      render(<ChatMessage type="user" content="Test" />);

      const icon = screen.getByAltText('User');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('icon-svg');
    });

    it('should render agent icon for agent messages', () => {
      render(<ChatMessage type="agent" content="Test" />);

      const icon = screen.getByAltText('Agent');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('icon-svg');
    });

    it('should wrap icon in message-icon container', () => {
      const { container } = render(<ChatMessage type="user" content="Test" />);

      const iconContainer = container.querySelector('.message-icon');
      expect(iconContainer).toBeInTheDocument();

      const icon = iconContainer?.querySelector('.icon-svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Message Structure', () => {
    it('should have correct DOM structure', () => {
      const { container } = render(<ChatMessage type="user" content="Test message" />);

      const message = container.querySelector('.chat-message');
      expect(message).toBeInTheDocument();

      const iconContainer = message?.querySelector('.message-icon');
      expect(iconContainer).toBeInTheDocument();

      const contentWrapper = message?.querySelector('.message-content-wrapper');
      expect(contentWrapper).toBeInTheDocument();

      const content = contentWrapper?.querySelector('.message-content');
      expect(content).toBeInTheDocument();
      expect(content?.textContent).toBe('Test message');
    });
  });
});
