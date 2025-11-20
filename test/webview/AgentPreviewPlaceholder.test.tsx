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
import userEvent from '@testing-library/user-event';
import AgentPreviewPlaceholder from '../../webview/src/components/AgentPreview/AgentPreviewPlaceholder';

describe('AgentPreviewPlaceholder', () => {
  describe('Rendering', () => {
    it('should render placeholder with icon and description text', () => {
      render(<AgentPreviewPlaceholder />);

      expect(screen.getByText(/Agent Preview lets you test an agent by having a conversation/)).toBeInTheDocument();
    });

    it('should render start session button when onStartSession is provided', () => {
      const mockStartSession = jest.fn();
      render(<AgentPreviewPlaceholder onStartSession={mockStartSession} />);

      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });

    it('should not render start session button when onStartSession is not provided', () => {
      render(<AgentPreviewPlaceholder />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should render regular button for published agents', () => {
      const mockStartSession = jest.fn();
      const publishedAgent = { id: '1', name: 'Test Agent', type: 'published' as const };
      render(<AgentPreviewPlaceholder onStartSession={mockStartSession} selectedAgentInfo={publishedAgent} />);

      expect(screen.getByText('Start Live Test')).toBeInTheDocument();
      // Published agents should have only one button
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('should render split button for script agents', () => {
      const mockStartSession = jest.fn();
      const scriptAgent = { id: '1', name: 'Test Agent', type: 'script' as const };
      render(<AgentPreviewPlaceholder onStartSession={mockStartSession} selectedAgentInfo={scriptAgent} />);

      // Split button has 2 buttons (main + dropdown)
      expect(screen.getAllByRole('button').length).toBeGreaterThan(1);
    });
  });

  describe('Button Text', () => {
    it('should show "Start Simulation" button when not in live mode for script agents', () => {
      const mockStartSession = jest.fn();
      const scriptAgent = { id: '1', name: 'Test Agent', type: 'script' as const };
      render(
        <AgentPreviewPlaceholder onStartSession={mockStartSession} isLiveMode={false} selectedAgentInfo={scriptAgent} />
      );

      expect(screen.getByText('Start Simulation')).toBeInTheDocument();
    });

    it('should show "Start Live Test" button when in live mode for script agents', () => {
      const mockStartSession = jest.fn();
      const scriptAgent = { id: '1', name: 'Test Agent', type: 'script' as const };
      render(
        <AgentPreviewPlaceholder onStartSession={mockStartSession} isLiveMode={true} selectedAgentInfo={scriptAgent} />
      );

      expect(screen.getByText('Start Live Test')).toBeInTheDocument();
    });

    it('should default to simulation mode when isLiveMode is not provided for script agents', () => {
      const mockStartSession = jest.fn();
      const scriptAgent = { id: '1', name: 'Test Agent', type: 'script' as const };
      render(<AgentPreviewPlaceholder onStartSession={mockStartSession} selectedAgentInfo={scriptAgent} />);

      expect(screen.getByText('Start Simulation')).toBeInTheDocument();
    });

    it('should always show "Start Live Test" for published agents', () => {
      const mockStartSession = jest.fn();
      const publishedAgent = { id: '1', name: 'Test Agent', type: 'published' as const };
      render(
        <AgentPreviewPlaceholder
          onStartSession={mockStartSession}
          isLiveMode={false}
          selectedAgentInfo={publishedAgent}
        />
      );

      expect(screen.getByText('Start Live Test')).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should call onStartSession when button is clicked for script agents', async () => {
      const user = userEvent.setup();
      const mockStartSession = jest.fn();
      const scriptAgent = { id: '1', name: 'Test Agent', type: 'script' as const };
      render(<AgentPreviewPlaceholder onStartSession={mockStartSession} selectedAgentInfo={scriptAgent} />);

      const button = screen.getByText('Start Simulation');
      await user.click(button);

      expect(mockStartSession).toHaveBeenCalledTimes(1);
    });

    it('should call onStartSession when button is clicked for published agents', async () => {
      const user = userEvent.setup();
      const mockStartSession = jest.fn();
      const publishedAgent = { id: '1', name: 'Test Agent', type: 'published' as const };
      render(<AgentPreviewPlaceholder onStartSession={mockStartSession} selectedAgentInfo={publishedAgent} />);

      const button = screen.getByText('Start Live Test');
      await user.click(button);

      expect(mockStartSession).toHaveBeenCalledTimes(1);
    });
  });
});
