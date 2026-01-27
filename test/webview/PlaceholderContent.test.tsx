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
import PlaceholderContent from '../../webview/src/components/AgentPreview/PlaceholderContent';

// Mock vscodeApi
jest.mock('../../webview/src/services/vscodeApi', () => ({
  vscodeApi: {
    executeCommand: jest.fn(),
    sendConversationExport: jest.fn()
  }
}));

import { vscodeApi } from '../../webview/src/services/vscodeApi';

describe('PlaceholderContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render placeholder content', () => {
      render(<PlaceholderContent hasAgents={true} isLoadingAgents={false} />);

      expect(screen.getByText(/Agentforce DX provides a suite of tools/i)).toBeInTheDocument();
    });

    it('should render select agent button', () => {
      render(<PlaceholderContent hasAgents={true} isLoadingAgents={false} />);

      expect(screen.getByText('Select Agent')).toBeInTheDocument();
    });

    it('should render placeholder icon', () => {
      const { container } = render(<PlaceholderContent hasAgents={true} isLoadingAgents={false} />);

      const icon = container.querySelector('.placeholder-icon');
      expect(icon).toBeInTheDocument();
    });

    it('should have correct CSS class structure', () => {
      const { container } = render(<PlaceholderContent hasAgents={true} isLoadingAgents={false} />);

      const placeholderContent = container.querySelector('.placeholder-content');
      expect(placeholderContent).toBeInTheDocument();

      const icon = placeholderContent?.querySelector('.placeholder-icon');
      expect(icon).toBeInTheDocument();

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Button Interaction', () => {
    it('should call executeCommand when button is clicked', async () => {
      const user = userEvent.setup();
      render(<PlaceholderContent hasAgents={true} isLoadingAgents={false} />);

      const button = screen.getByText('Select Agent');
      await user.click(button);

      expect(vscodeApi.executeCommand).toHaveBeenCalledWith('sf.agent.selectAndRun');
    });

    it('should call executeCommand only once per click', async () => {
      const user = userEvent.setup();
      render(<PlaceholderContent hasAgents={true} isLoadingAgents={false} />);

      const button = screen.getByText('Select Agent');
      await user.click(button);

      expect(vscodeApi.executeCommand).toHaveBeenCalledTimes(1);
    });

    it('should be clickable multiple times', async () => {
      const user = userEvent.setup();
      render(<PlaceholderContent hasAgents={true} isLoadingAgents={false} />);

      const button = screen.getByText('Select Agent');

      await user.click(button);
      expect(vscodeApi.executeCommand).toHaveBeenCalledTimes(1);

      await user.click(button);
      expect(vscodeApi.executeCommand).toHaveBeenCalledTimes(2);

      await user.click(button);
      expect(vscodeApi.executeCommand).toHaveBeenCalledTimes(3);
    });
  });

  describe('Accessibility', () => {
    it('should render button as accessible element', () => {
      render(<PlaceholderContent hasAgents={true} isLoadingAgents={false} />);

      const button = screen.getByRole('button', { name: /Select Agent/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('should disable button when no agents are available', () => {
      render(<PlaceholderContent hasAgents={false} isLoadingAgents={false} />);

      const button = screen.getByRole('button', { name: /Select Agent/i });
      expect(button).toBeDisabled();
    });

    it('should disable button when agents are loading', () => {
      render(<PlaceholderContent hasAgents={true} isLoadingAgents={true} />);

      const button = screen.getByRole('button', { name: /Select Agent/i });
      expect(button).toBeDisabled();
    });

    it('should disable button with default props (no agents, loading)', () => {
      render(<PlaceholderContent />);

      const button = screen.getByRole('button', { name: /Select Agent/i });
      expect(button).toBeDisabled();
    });

    it('should enable button when agents are available and not loading', () => {
      render(<PlaceholderContent hasAgents={true} isLoadingAgents={false} />);

      const button = screen.getByRole('button', { name: /Select Agent/i });
      expect(button).not.toBeDisabled();
    });

    it('should not call executeCommand when button is disabled and clicked', async () => {
      const user = userEvent.setup();
      render(<PlaceholderContent hasAgents={false} isLoadingAgents={false} />);

      const button = screen.getByRole('button', { name: /Select Agent/i });
      await user.click(button);

      expect(vscodeApi.executeCommand).not.toHaveBeenCalled();
    });
  });
});
