import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TraceHistoryRow } from '../../webview/src/components/AgentTracer/TraceHistoryRow';

const createMockEntry = (overrides = {}) => ({
  storageKey: 'agent',
  agentId: 'agent',
  sessionId: 'session-123',
  planId: 'plan-123',
  messageId: 'msg-123',
  userMessage: 'Test message',
  timestamp: '2024-01-01T12:00:00.000Z',
  trace: {
    type: 'PlanSuccessResponse',
    planId: 'plan-123',
    sessionId: 'session-123',
    plan: [{ type: 'UserInputStep', data: { content: 'test' } }]
  },
  ...overrides
});

const createMockTimelineItems = () => [
  {
    status: 'success' as const,
    label: 'User Input',
    description: 'Test description',
    onClick: jest.fn()
  }
];

describe('TraceHistoryRow', () => {
  const defaultProps = {
    entry: createMockEntry(),
    index: 0,
    isExpanded: false,
    onExpandedChange: jest.fn(),
    onOpenJson: jest.fn(),
    timelineItems: createMockTimelineItems(),
    message: 'Test message'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the header with message', () => {
    render(<TraceHistoryRow {...defaultProps} />);

    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders the header button with correct aria attributes when collapsed', () => {
    render(<TraceHistoryRow {...defaultProps} isExpanded={false} />);

    const button = screen.getByRole('button', { expanded: false });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'trace-history-content-0');
  });

  it('renders the header button with correct aria attributes when expanded', () => {
    render(<TraceHistoryRow {...defaultProps} isExpanded={true} />);

    const button = screen.getByRole('button', { expanded: true });
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('calls onExpandedChange when header is clicked', () => {
    const onExpandedChange = jest.fn();
    render(<TraceHistoryRow {...defaultProps} onExpandedChange={onExpandedChange} isExpanded={false} />);

    const button = screen.getByRole('button', { expanded: false });
    fireEvent.click(button);

    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('calls onExpandedChange with false when collapsing', () => {
    const onExpandedChange = jest.fn();
    render(<TraceHistoryRow {...defaultProps} onExpandedChange={onExpandedChange} isExpanded={true} />);

    const button = screen.getByRole('button', { expanded: true });
    fireEvent.click(button);

    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });

  it('expands on Enter key press', () => {
    const onExpandedChange = jest.fn();
    render(<TraceHistoryRow {...defaultProps} onExpandedChange={onExpandedChange} isExpanded={false} />);

    const button = screen.getByRole('button', { expanded: false });
    fireEvent.keyDown(button, { key: 'Enter' });

    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('expands on Space key press', () => {
    const onExpandedChange = jest.fn();
    render(<TraceHistoryRow {...defaultProps} onExpandedChange={onExpandedChange} isExpanded={false} />);

    const button = screen.getByRole('button', { expanded: false });
    fireEvent.keyDown(button, { key: ' ' });

    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('does not expand on other key presses', () => {
    const onExpandedChange = jest.fn();
    render(<TraceHistoryRow {...defaultProps} onExpandedChange={onExpandedChange} isExpanded={false} />);

    const button = screen.getByRole('button', { expanded: false });
    fireEvent.keyDown(button, { key: 'Tab' });

    expect(onExpandedChange).not.toHaveBeenCalled();
  });

  it('does not show content when collapsed', () => {
    render(<TraceHistoryRow {...defaultProps} isExpanded={false} />);

    expect(screen.queryByText('session-123')).not.toBeInTheDocument();
    expect(screen.queryByText('plan-123')).not.toBeInTheDocument();
  });

  it('shows content when expanded', () => {
    render(<TraceHistoryRow {...defaultProps} isExpanded={true} />);

    expect(screen.getByText('session-123')).toBeInTheDocument();
    expect(screen.getByText('plan-123')).toBeInTheDocument();
  });

  it('shows timestamp when entry has timestamp and is expanded', () => {
    render(<TraceHistoryRow {...defaultProps} isExpanded={true} />);

    expect(screen.getByText('Timestamp')).toBeInTheDocument();
  });

  it('does not show timestamp when entry has no timestamp', () => {
    const entryWithoutTimestamp = createMockEntry({ timestamp: undefined });
    render(<TraceHistoryRow {...defaultProps} entry={entryWithoutTimestamp} isExpanded={true} />);

    expect(screen.queryByText('Timestamp')).not.toBeInTheDocument();
  });

  it('renders timeline when expanded', () => {
    render(<TraceHistoryRow {...defaultProps} isExpanded={true} />);

    expect(screen.getByText('User Input')).toBeInTheDocument();
  });

  it('renders Open JSON icon button in header', () => {
    render(<TraceHistoryRow {...defaultProps} isExpanded={false} />);

    expect(screen.getByRole('button', { name: /open json/i })).toBeInTheDocument();
  });

  it('calls onOpenJson when Open JSON icon is clicked', () => {
    const onOpenJson = jest.fn();
    render(<TraceHistoryRow {...defaultProps} isExpanded={false} onOpenJson={onOpenJson} />);

    const jsonButton = screen.getByRole('button', { name: /open json/i });
    fireEvent.click(jsonButton);

    expect(onOpenJson).toHaveBeenCalled();
  });

  it('applies expanded class when isExpanded is true', () => {
    const { container } = render(<TraceHistoryRow {...defaultProps} isExpanded={true} />);

    expect(container.querySelector('.trace-history-row--expanded')).toBeInTheDocument();
  });

  it('does not apply expanded class when isExpanded is false', () => {
    const { container } = render(<TraceHistoryRow {...defaultProps} isExpanded={false} />);

    expect(container.querySelector('.trace-history-row--expanded')).not.toBeInTheDocument();
  });

  it('applies chevron expanded class when expanded', () => {
    const { container } = render(<TraceHistoryRow {...defaultProps} isExpanded={true} />);

    expect(container.querySelector('.trace-history-row__chevron--expanded')).toBeInTheDocument();
  });

  it('uses correct content id for accessibility', () => {
    render(<TraceHistoryRow {...defaultProps} index={5} isExpanded={true} />);

    // Get the header button by finding the one with aria-controls
    const headerButton = screen.getByRole('button', { expanded: true });
    expect(headerButton).toHaveAttribute('aria-controls', 'trace-history-content-5');

    const content = document.getElementById('trace-history-content-5');
    expect(content).toBeInTheDocument();
  });
});
