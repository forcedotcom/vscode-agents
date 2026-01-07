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

// Setup window.AgentSource BEFORE importing anything
(window as any).AgentSource = {
  SCRIPT: 'script',
  PUBLISHED: 'published'
};

jest.mock('../../webview/src/services/vscodeApi', () => ({
  vscodeApi: {
    postMessage: jest.fn(),
    onMessage: jest.fn(),
    startSession: jest.fn(),
    endSession: jest.fn(),
    sendChatMessage: jest.fn(),
    clearMessages: jest.fn(),
    executeCommand: jest.fn(),
    sendConversationExport: jest.fn()
  },
  AgentSource: {
    SCRIPT: 'script',
    PUBLISHED: 'published'
  }
}));

import { vscodeApi } from '../../webview/src/services/vscodeApi';
import AgentPreview from '../../webview/src/components/AgentPreview/AgentPreview';

describe('AgentPreview - Message Handlers', () => {
  let handlers: Map<string, Function>;

  beforeEach(() => {
    handlers = new Map();
    jest.clearAllMocks();

    (vscodeApi.onMessage as jest.Mock).mockImplementation((cmd: string, handler: Function) => {
      handlers.set(cmd, handler);
      return () => handlers.delete(cmd);
    });

  });

  const renderComponent = () =>
    render(
      <AgentPreview
        selectedAgentId="test-agent"
        pendingAgentId={null}
        isSessionTransitioning={false}
        onSessionTransitionSettled={jest.fn()}
        isLiveMode={false}
      />
    );

  describe('Compilation Messages', () => {
    it('should handle compilationStarting with custom message', async () => {
      renderComponent();
      handlers.get('compilationStarting')?.({ message: 'Compiling code...' });
      await waitFor(() => expect(screen.getByText('Compiling code...')).toBeInTheDocument());
    });

    it('should handle compilationStarting with default message', async () => {
      renderComponent();
      handlers.get('compilationStarting')?.({});
      await waitFor(() => expect(screen.getByText('Compiling agent...')).toBeInTheDocument());
    });

    it('should handle compilationError with custom message', async () => {
      renderComponent();
      handlers.get('compilationError')?.({ message: 'Syntax error' });
      await waitFor(() => expect(screen.getByText('Syntax error')).toBeInTheDocument());
    });

    it('should handle compilationError with default message', async () => {
      renderComponent();
      handlers.get('compilationError')?.({});
      await waitFor(() => expect(screen.getByText('Failed to compile the agent.')).toBeInTheDocument());
    });
  });

  describe('Simulation Messages', () => {
    it('should handle simulationStarting with custom message', async () => {
      renderComponent();
      handlers.get('simulationStarting')?.({ message: 'Starting sim...' });
      await waitFor(() => expect(screen.getByText('Starting sim...')).toBeInTheDocument());
    });

    it('should handle simulationStarting with default message', async () => {
      renderComponent();
      handlers.get('simulationStarting')?.({});
      await waitFor(() => expect(screen.getByText('Starting simulation...')).toBeInTheDocument());
    });
  });

  describe('Debug Messages', () => {
    it('should handle debugLogProcessed', async () => {
      renderComponent();
      handlers.get('debugLogProcessed')?.({ message: 'Log processed' });
      await waitFor(() => expect(screen.getByText('Log processed')).toBeInTheDocument());
    });

    it('should handle debugLogError', async () => {
      renderComponent();
      handlers.get('debugLogError')?.({ message: 'Debug error' });
      await waitFor(() => expect(screen.getByText('Debug error')).toBeInTheDocument());
    });
  });

  describe('Message Flow', () => {
    it('should handle messageStarting', async () => {
      renderComponent();
      handlers.get('messageStarting')?.();
      await waitFor(() => expect(screen.getByText('Agent is thinking...')).toBeInTheDocument());
    });

    it('should handle messageSent with content', async () => {
      renderComponent();
      handlers.get('messageSent')?.({ content: 'Agent reply' });
      await waitFor(() => expect(screen.getByText('Agent reply')).toBeInTheDocument());
    });

    it('should handle messageSent without content', async () => {
      renderComponent();
      handlers.get('messageStarting')?.();
      await waitFor(() => expect(screen.getByText('Agent is thinking...')).toBeInTheDocument());
      handlers.get('messageSent')?.({});
      await waitFor(() => expect(screen.queryByText('Agent is thinking...')).not.toBeInTheDocument());
    });
  });

  describe('Session Messages', () => {
    it('should handle sessionStarted with content', async () => {
      renderComponent();
      handlers.get('sessionStarted')?.({ content: 'Hello!' });
      await waitFor(() => expect(screen.getByText('Hello!')).toBeInTheDocument());
    });

    it('should handle sessionEnded', async () => {
      const onSettled = jest.fn();
      render(
        <AgentPreview
          selectedAgentId="test-agent"
          pendingAgentId={null}
          isSessionTransitioning={false}
          onSessionTransitionSettled={onSettled}
          isLiveMode={false}
        />
      );
      handlers.get('sessionEnded')?.();
      await waitFor(() => expect(onSettled).toHaveBeenCalled());
    });

    it('should handle error message', async () => {
      renderComponent();
      handlers.get('error')?.({ message: 'Connection failed' });
      await waitFor(() => expect(screen.getByText('Connection failed')).toBeInTheDocument());
    });

    it('should handle error without message', async () => {
      renderComponent();
      handlers.get('error')?.({});
      await waitFor(() => expect(screen.getByText('Something went wrong.')).toBeInTheDocument());
    });
  });

  describe('Conversation History', () => {
    it('should handle empty conversation history', async () => {
      renderComponent();
      handlers.get('conversationHistory')?.({ messages: [] });
      await waitFor(() => {
        expect(screen.queryByText(/Agent preview does not provide/)).not.toBeInTheDocument();
      });
    });

    it('should handle conversation history with messages', async () => {
      renderComponent();
      handlers.get('conversationHistory')?.({
        messages: [{ id: '1', type: 'user', content: 'Hello', timestamp: new Date().toISOString() }]
      });
      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
      });
    });
  });

  describe('Conversation Export', () => {
    it('should respond to export requests with markdown content', async () => {
      renderComponent();
      const now = new Date().toISOString();
      handlers.get('conversationHistory')?.({
        messages: [{ id: '1', type: 'user', content: 'Hello from history', timestamp: now }]
      });
      (vscodeApi.sendConversationExport as jest.Mock).mockClear();

      await waitFor(() => {
        expect(screen.getByText('Hello from history')).toBeInTheDocument();
      });

      handlers.get('requestConversationExport')?.({ agentName: 'Test Agent' });

      expect(vscodeApi.sendConversationExport).toHaveBeenCalled();
      const [content, fileName] = (vscodeApi.sendConversationExport as jest.Mock).mock.calls[0];
      expect(content).toContain('# Agentforce DX (AFDX) Log');
      expect(content).toContain('## Details');
      expect(content).toContain('## Conversation');
      expect(content).toContain('###');
      expect(content).toContain('Hello from history');
      expect(fileName).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-test-agent\.md$/);
    });
  });


  // Client App Ready tests removed - functionality was removed

  describe('No History Found', () => {
    it('should show placeholder on noHistoryFound', async () => {
      renderComponent();
      handlers.get('noHistoryFound')?.({ agentId: 'test-agent' });
      await waitFor(() => {
        expect(screen.getByText(/Agent Preview lets you test/)).toBeInTheDocument();
      });
    });

    it('should ignore noHistoryFound without agent id', async () => {
      renderComponent();
      handlers.get('noHistoryFound')?.({});
      await waitFor(() => {
        expect(screen.queryByText(/Agent Preview lets you test/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Conversation History', () => {
    it('fills missing id and timestamp when mapping history messages', async () => {
      renderComponent();
      handlers.get('conversationHistory')?.({
        messages: [{ type: 'user', content: 'History fallback' }]
      });

      await waitFor(() => {
        expect(screen.getByText('History fallback')).toBeInTheDocument();
      });
    });
  });

  describe('Session Started defaults', () => {
    it('uses default welcome when content missing', async () => {
      renderComponent();
      handlers.get('sessionStarted')?.({});
      await waitFor(() => {
        expect(screen.getByText(/I'm ready to help/)).toBeInTheDocument();
      });
    });
  });

  describe('Error handling', () => {
    it('removes transient starting session messages', async () => {
      renderComponent();
      handlers.get('compilationError')?.({ message: 'Starting session...' });
      await waitFor(() => expect(screen.getByText('Starting session...')).toBeInTheDocument());

      handlers.get('error')?.({ message: 'Something failed' });

      await waitFor(() => {
        expect(screen.queryByText('Starting session...')).not.toBeInTheDocument();
        expect(screen.getByText('Something failed')).toBeInTheDocument();
      });
    });
  });

  describe('Clear Messages', () => {
    it('should clear messages and reset state', async () => {
      renderComponent();
      handlers.get('sessionStarted')?.({ content: 'Hello' });
      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
      });

      handlers.get('clearMessages')?.();
      await waitFor(() => {
        expect(screen.queryByText('Hello')).not.toBeInTheDocument();
      });
    });
  });
});
