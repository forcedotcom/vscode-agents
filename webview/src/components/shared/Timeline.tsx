// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Timeline.css';

export type TimelineItemStatus = 'success' | 'error' | 'pending' | 'incomplete';

export interface TimelineItemProps {
	/**
	 * Status of the timeline item
	 */
	status: TimelineItemStatus;
	/**
	 * Primary text label for the timeline item
	 */
	label: string;
	/**
	 * Secondary text for additional description
	 */
	description?: string;
	/**
	 * Optional URL to make the label a clickable link
	 */
	href?: string;
	/**
	 * Optional click handler for the timeline item
	 */
	onClick?: () => void;
}

export interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * Timeline items to display
	 */
	items: TimelineItemProps[];
}

/**
 * The Visual Studio Code timeline component.
 *
 * @remarks
 * A standalone React timeline component that displays a vertical timeline
 * with dots/icons on the left and text labels on the right.
 *
 * @public
 */
export const Timeline = React.forwardRef<HTMLDivElement, TimelineProps>(
	({ items, className, ...props }, ref) => {
		const timelineClass = [
			'vscode-timeline',
			className
		].filter(Boolean).join(' ');

		return (
			<div ref={ref} className={timelineClass} {...props}>
				{items.map((item, index) => (
					<TimelineItem
						key={index}
						{...item}
						isLast={index === items.length - 1}
					/>
				))}
			</div>
		);
	}
);

Timeline.displayName = 'Timeline';

interface TimelineItemInternalProps extends TimelineItemProps {
	isLast: boolean;
}

const TimelineItem: React.FC<TimelineItemInternalProps> = ({
	status,
	label,
	description,
	href,
	onClick,
	isLast
}) => {
	const getIconContent = () => {
		switch (status) {
			case 'success':
				return (
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M6.5 11.5L3 8L4.06 6.94L6.5 9.38L11.94 3.94L13 5L6.5 11.5Z" fill="currentColor"/>
					</svg>
				);
			case 'error':
				return (
					<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M12.32 11.26L9.06 8L12.32 4.74L11.26 3.68L8 6.94L4.74 3.68L3.68 4.74L6.94 8L3.68 11.26L4.74 12.32L8 9.06L11.26 12.32L12.32 11.26Z" fill="currentColor"/>
					</svg>
				);
			case 'pending':
			case 'incomplete':
			default:
				return (
					<div className="vscode-timeline-item__dot" />
				);
		}
	};

	const itemClass = [
		'vscode-timeline-item',
		`vscode-timeline-item--${status}`,
		isLast && 'vscode-timeline-item--last',
		onClick && 'vscode-timeline-item--clickable'
	].filter(Boolean).join(' ');

	const handleClick = () => {
		if (onClick) {
			onClick();
		}
	};

	return (
		<div className={itemClass} onClick={handleClick} style={onClick ? { cursor: 'pointer' } : undefined}>
			<div className="vscode-timeline-item__indicator">
				<div className="vscode-timeline-item__icon">
					{getIconContent()}
				</div>
				{!isLast && <div className="vscode-timeline-item__line" />}
			</div>
			<div className="vscode-timeline-item__content">
				{href ? (
					<a href={href} className="vscode-timeline-item__link">
						<div className="vscode-timeline-item__label">{label}</div>
						{description && (
							<div className="vscode-timeline-item__description">{description}</div>
						)}
					</a>
				) : (
					<>
						<div className="vscode-timeline-item__label">{label}</div>
						{description && (
							<div className="vscode-timeline-item__description">{description}</div>
						)}
					</>
				)}
			</div>
		</div>
	);
};
