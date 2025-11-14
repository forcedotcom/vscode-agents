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
    executeCommand: jest.fn()
  }
}));

import { vscodeApi } from '../../webview/src/services/vscodeApi';

describe('PlaceholderContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render placeholder content', () => {
      render(<PlaceholderContent />);

      expect(screen.getByText(/Agentforce DX lets you build and test agents/i)).toBeInTheDocument();
    });

    it('should render select agent button', () => {
      render(<PlaceholderContent />);

      expect(screen.getByText('Select an Agent to Get Started')).toBeInTheDocument();
    });

    it('should render placeholder icon', () => {
      const { container } = render(<PlaceholderContent />);

      const icon = container.querySelector('.placeholder-icon');
      expect(icon).toBeInTheDocument();
    });

    it('should have correct CSS class structure', () => {
      const { container } = render(<PlaceholderContent />);

      const placeholderContent = container.querySelector('.placeholder-content');
      expect(placeholderContent).toBeInTheDocument();

      const icon = placeholderContent?.querySelector('.placeholder-icon');
      expect(icon).toBeInTheDocument();

      const button = placeholderContent?.querySelector('.select-agent-button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Button Interaction', () => {
    it('should call executeCommand when button is clicked', async () => {
      const user = userEvent.setup();
      render(<PlaceholderContent />);

      const button = screen.getByText('Select an Agent to Get Started');
      await user.click(button);

      expect(vscodeApi.executeCommand).toHaveBeenCalledWith('sf.agent.selectAndRun');
    });

    it('should call executeCommand only once per click', async () => {
      const user = userEvent.setup();
      render(<PlaceholderContent />);

      const button = screen.getByText('Select an Agent to Get Started');
      await user.click(button);

      expect(vscodeApi.executeCommand).toHaveBeenCalledTimes(1);
    });

    it('should be clickable multiple times', async () => {
      const user = userEvent.setup();
      render(<PlaceholderContent />);

      const button = screen.getByText('Select an Agent to Get Started');

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
      render(<PlaceholderContent />);

      const button = screen.getByRole('button', { name: /Select an Agent to Get Started/i });
      expect(button).toBeInTheDocument();
    });
  });
});
