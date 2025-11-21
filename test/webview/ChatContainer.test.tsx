import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import ChatContainer from '../../webview/src/components/AgentPreview/ChatContainer';

describe('ChatContainer', () => {
  it('shows the default loading message when loading and none provided', () => {
    render(<ChatContainer messages={[]} isLoading={true} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
