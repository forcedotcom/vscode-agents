// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './Timeline.css';

export type TimelineItemStatus = 'success' | 'error' | 'pending' | 'incomplete';

// Icon names for tracer step types (VS Code icons)
export type TimelineIconName =
  | 'account'
  | 'rocket'
  | 'sign-in'
  | 'tools'
  | 'lightbulb'
  | 'symbol-variable'
  | 'arrow-right'
  | 'history'
  | 'eye'
  | 'comment'
  | 'tag'
  | 'run'
  | 'check'
  | 'error';

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
  /**
   * Optional icon name to display instead of status-based icon
   */
  icon?: TimelineIconName;
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
export const Timeline = React.forwardRef<HTMLDivElement, TimelineProps>(({ items, className, ...props }, ref) => {
  const timelineClass = ['vscode-timeline', className].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={timelineClass} {...props}>
      {items.map((item, index) => (
        <TimelineItem key={index} {...item} isLast={index === items.length - 1} />
      ))}
    </div>
  );
});

Timeline.displayName = 'Timeline';

interface TimelineItemInternalProps extends TimelineItemProps {
  isLast: boolean;
}

// SVG icon components for each icon name (VS Code icons from microsoft/vscode-icons)
const getIconByName = (name: TimelineIconName): React.ReactNode => {
  switch (name) {
    case 'account':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M16 7.99201C16 3.58042 12.416 0 8 0C3.584 0 0 3.58042 0 7.99201C0 10.4216 1.104 12.6114 2.832 14.0819C2.848 14.0979 2.864 14.0979 2.864 14.1139C3.008 14.2258 3.152 14.3377 3.312 14.4496C3.392 14.4975 3.456 14.5614 3.536 14.6254C4.816 15.4885 6.352 16 8.016 16C9.68 16 11.216 15.4885 12.496 14.6254C12.576 14.5774 12.64 14.5135 12.72 14.4655C12.864 14.3536 13.024 14.2418 13.168 14.1299C13.184 14.1139 13.2 14.1139 13.2 14.0979C14.896 12.6114 16 10.4216 16 7.99201ZM8 14.993C6.496 14.993 5.12 14.5135 3.984 13.7143C4 13.5864 4.032 13.4585 4.064 13.3307C4.16 12.979 4.304 12.6434 4.48 12.3397C4.656 12.036 4.864 11.7642 5.12 11.5245C5.36 11.2847 5.648 11.0609 5.936 10.8851C6.24 10.7093 6.56 10.5814 6.912 10.4855C7.264 10.3896 7.632 10.3417 8 10.3417C8.592 10.3417 9.136 10.4535 9.632 10.6613C10.128 10.8691 10.56 11.1568 10.928 11.5085C11.296 11.8761 11.584 12.3077 11.792 12.8032C11.904 13.0909 11.984 13.3946 12.032 13.7143C10.88 14.5135 9.504 14.993 8 14.993ZM5.552 7.59241C5.408 7.27273 5.344 6.92108 5.344 6.56943C5.344 6.21778 5.408 5.86613 5.552 5.54645C5.696 5.22677 5.888 4.93906 6.128 4.6993C6.368 4.45954 6.656 4.26773 6.976 4.12388C7.296 3.98002 7.648 3.91608 8 3.91608C8.368 3.91608 8.704 3.98002 9.024 4.12388C9.344 4.26773 9.632 4.45954 9.872 4.6993C10.112 4.93906 10.304 5.22677 10.448 5.54645C10.592 5.86613 10.656 6.21778 10.656 6.56943C10.656 6.93706 10.592 7.27273 10.448 7.59241C10.304 7.91209 10.112 8.1998 9.872 8.43956C9.632 8.67932 9.344 8.87113 9.024 9.01499C8.384 9.28671 7.6 9.28671 6.96 9.01499C6.64 8.87113 6.352 8.67932 6.112 8.43956C5.872 8.1998 5.68 7.91209 5.552 7.59241ZM12.976 12.8991C12.976 12.8671 12.96 12.8511 12.96 12.8192C12.8 12.3237 12.576 11.8442 12.272 11.4126C11.968 10.981 11.616 10.5974 11.184 10.2777C10.864 10.038 10.512 9.83017 10.144 9.67033C10.32 9.55844 10.48 9.41459 10.608 9.28671C10.848 9.04695 11.056 8.79121 11.232 8.5035C11.408 8.21578 11.536 7.91209 11.632 7.57642C11.728 7.24076 11.76 6.90509 11.76 6.56943C11.76 6.04196 11.664 5.54645 11.472 5.0989C11.28 4.65135 11.008 4.25175 10.656 3.9001C10.32 3.56444 9.904 3.29271 9.456 3.1009C9.008 2.90909 8.512 2.81319 7.984 2.81319C7.456 2.81319 6.96 2.90909 6.512 3.1009C6.064 3.29271 5.648 3.56444 5.312 3.91608C4.976 4.25175 4.704 4.66733 4.512 5.11489C4.32 5.56244 4.224 6.05794 4.224 6.58541C4.224 6.93706 4.272 7.27273 4.368 7.59241C4.464 7.92807 4.592 8.23177 4.768 8.51948C4.928 8.80719 5.152 9.06294 5.392 9.3027C5.536 9.44655 5.696 9.57443 5.872 9.68631C5.488 9.86214 5.136 10.0699 4.832 10.3097C4.416 10.6294 4.048 11.013 3.744 11.4286C3.44 11.8601 3.216 12.3237 3.056 12.8352C3.04 12.8671 3.04 12.8991 3.04 12.9151C1.776 11.6364 0.992 9.91009 0.992 7.99201C0.992 4.13986 4.144 0.991009 8 0.991009C11.856 0.991009 15.008 4.13986 15.008 7.99201C15.008 9.91009 14.224 11.6364 12.976 12.8991Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'rocket':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M14.491 1C10.8926 1.0045 7.83732 2.98269 5.65635 5H1.5L1 5.5V8.5L1.147 8.854L2.13796 9.84496L2.13899 9.854L6.13899 13.854L6.148 13.855L7.147 14.854L7.5 15H10.5L11 14.5V10.346C13.019 8.16839 14.996 5.11301 14.992 1.5L14.491 1ZM2 6H4.64307C3.59247 7.10401 2.8317 8.11996 2.41843 8.71094L2 8.293V6ZM7.7 14L7.28049 13.5766C7.87261 13.1655 8.88995 12.4085 9.995 11.3611V14H7.7ZM6.55699 12.856L3.13599 9.437C4.12799 8 8.37899 2.355 13.978 2.016C13.652 7.628 7.99099 11.869 6.55699 12.856ZM4 15V14H2V12H1V15H4ZM10.7475 7.33284C10.9122 7.08628 11 6.79647 11 6.50001C11 6.3026 10.961 6.10714 10.8853 5.92483C10.8096 5.74251 10.6987 5.57693 10.5589 5.43758C10.4191 5.29822 10.2531 5.18784 10.0706 5.11275C9.888 5.03766 9.6924 4.99935 9.495 5.00001C9.19854 5.001 8.90903 5.08981 8.66301 5.25523C8.417 5.42065 8.22552 5.65526 8.11275 5.92944C7.99999 6.20361 7.97099 6.50506 8.02943 6.7957C8.08788 7.08634 8.23113 7.35314 8.44111 7.56242C8.65108 7.7717 8.91837 7.91407 9.2092 7.97154C9.50003 8.02902 9.80138 7.99902 10.0752 7.88534C10.349 7.77167 10.5829 7.57941 10.7475 7.33284Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'sign-in':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M11.02 3.77V3H7.01001H4.03619L7.67 4.25003L8 4.71003V13H11.02V12.25L12.02 11.25V13.5L11.52 14H8V15L7.36 15.47L2.36 13.75L2 13.29V3.00003L2.01001 2.99301V2.5L2.52001 2H11.52L12.02 2.5V4.75L11.03 3.76L11.02 3.77ZM7 14.28V5.06003L3 3.72003V12.94L7 14.28ZM10.09 7.53005L8.53998 8.37005V7.66005L11.03 5.18005L11.73 5.88005L10.13 7.53005H15.06V8.53005H10.09L11.72 10.1301L11.01 10.8301L8.53998 8.37005L10.09 7.53005Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'tools':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M9.1 4.4L8.6 2H7.4L6.9 4.4L6.2 4.7L4.2 3.4L3.3 4.2L4.6 6.2L4.4 6.9L2 7.4V8.6L4.4 9.1L4.7 9.9L3.4 11.9L4.2 12.7L6.2 11.4L7 11.7L7.4 14H8.6L9.1 11.6L9.9 11.3L11.9 12.6L12.7 11.8L11.4 9.8L11.7 9L14 8.6V7.4L11.6 6.9L11.3 6.1L12.6 4.1L11.8 3.3L9.8 4.6L9.1 4.4ZM9.4 1L9.9 3.4L12 2.1L14 4.1L12.6 6.2L15 6.6V9.4L12.6 9.9L14 12L12 14L9.9 12.6L9.4 15H6.6L6.1 12.6L4 13.9L2 11.9L3.4 9.8L1 9.4V6.6L3.4 6.1L2.1 4L4.1 2L6.2 3.4L6.6 1H9.4ZM10 8C10 9.1 9.1 10 8 10C6.9 10 6 9.1 6 8C6 6.9 6.9 6 8 6C9.1 6 10 6.9 10 8ZM8 9C8.6 9 9 8.6 9 8C9 7.4 8.6 7 8 7C7.4 7 7 7.4 7 8C7 8.6 7.4 9 8 9Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'lightbulb':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M11.6708 8.65806C11.3319 8.9916 11.0716 9.36278 10.8886 9.77172C10.7105 10.1792 10.621 10.6219 10.621 11.1009V12.7012C10.621 12.8807 10.5872 13.0503 10.5189 13.2091C10.4513 13.3661 10.3586 13.5038 10.2407 13.6213C10.1228 13.7388 9.98464 13.8311 9.82723 13.8984C9.66806 13.9663 9.49806 14 9.31823 14H7.71205C7.53223 14 7.36223 13.9663 7.20306 13.8984C7.04564 13.8311 6.90753 13.7388 6.78961 13.6213C6.67168 13.5038 6.57895 13.3661 6.51141 13.2091C6.44311 13.0503 6.40927 12.8807 6.40927 12.7012V11.1009C6.40927 10.622 6.31772 10.1795 6.13553 9.77209C5.95683 9.36336 5.69832 8.99156 5.35953 8.65806C4.92468 8.22903 4.58896 7.75003 4.35361 7.22134C4.11756 6.69107 4 6.11672 4 5.49953C4 5.08664 4.05342 4.68802 4.16048 4.30397C4.26728 3.92089 4.41907 3.56286 4.61595 3.23018C4.81257 2.89377 5.04777 2.58911 5.32146 2.31641C5.59503 2.04383 5.89858 1.80953 6.23195 1.61364C6.56979 1.41764 6.93146 1.2662 7.31578 1.15983C7.70106 1.0532 8.10094 1 8.51514 1C8.92934 1 9.32923 1.0532 9.71451 1.15983C10.0988 1.2662 10.458 1.41739 10.7918 1.61351C11.1294 1.80938 11.4351 2.0437 11.7088 2.31641C11.9825 2.5891 12.2177 2.89376 12.4143 3.23016C12.6112 3.56285 12.763 3.92088 12.8698 4.30397C12.9769 4.68802 13.0303 5.08664 13.0303 5.49953C13.0303 6.11672 12.9127 6.69107 12.6767 7.22134C12.4413 7.75003 12.1056 8.22903 11.6708 8.65806ZM9.62162 10.5H7.40867V12.7012C7.40867 12.7823 7.4372 12.8512 7.49888 12.9127C7.56058 12.9741 7.63007 13.0028 7.71205 13.0028H9.31823C9.40022 13.0028 9.46971 12.9741 9.5314 12.9127C9.59309 12.8512 9.62162 12.7823 9.62162 12.7012V10.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'symbol-variable':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M2 5H4V4H1.5L1 4.5V12.5L1.5 13H4V12H2V5ZM14.5 4H12V5H14V12H12V13H14.5L15 12.5V4.5L14.5 4ZM11.76 6.56995L12 7V9.51001L11.7 9.95996L7.19995 11.96H6.73999L4.23999 10.46L4 10.03V7.53003L4.30005 7.06995L8.80005 5.06995H9.26001L11.76 6.56995ZM5 9.70996L6.5 10.61V9.28003L5 8.38V9.70996ZM5.57996 7.56006L7.03003 8.43005L10.42 6.93005L8.96997 6.06006L5.57996 7.56006ZM7.53003 10.73L11.03 9.17004V7.77002L7.53003 9.31995V10.73Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'arrow-right':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M9.00001 13.8871L14 8.8871V8.17999L9.00001 3.17999L8.2929 3.8871L12.4393 8.03354H2V9.03354H12.4393L8.2929 13.18L9.00001 13.8871Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'history':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M13.5072 12.3239C14.4749 11.0906 15.0006 9.56812 15 8.00045C15.0001 6.46996 14.4986 4.98161 13.5723 3.76328C12.6459 2.54495 11.3459 1.66378 9.87105 1.25469C8.39624 0.845604 6.828 0.931139 5.40643 1.4982C3.98487 2.06526 2.78832 3.0826 2 4.39445V2.00045H1V5.50045L1.5 6.00045H5V5.00045H2.811C3.47895 3.84546 4.51237 2.94567 5.74827 2.44298C6.98418 1.94028 8.35226 1.86329 9.63676 2.22413C10.9213 2.58498 12.0491 3.36313 12.8425 4.43587C13.6358 5.50862 14.0495 6.81493 14.0182 8.14879C13.987 9.48265 13.5127 10.7682 12.6701 11.8026C11.8274 12.8371 10.6644 13.5616 9.36443 13.862C8.06445 14.1624 6.70147 14.0215 5.49043 13.4615C4.27939 12.9016 3.2892 11.9544 2.676 10.7695L1.789 11.2315C2.51204 12.6224 3.68106 13.7304 5.10876 14.3779C6.53646 15.0254 8.14019 15.1749 9.66297 14.8025C11.1858 14.4301 12.5395 13.5573 13.5072 12.3239ZM10.146 11.3545L10.854 10.6465L8 7.79349V4.00049H7V8.00049L7.146 8.35449L10.146 11.3545Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'eye':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M1 10C1 6.1 4.1 3 8 3C11.9 3 15 6.1 15 10H14C14 6.7 11.3 4 8 4C4.7 4 2 6.7 2 10H1ZM5 10C5 8.3 6.3 7 8 7C9.7 7 11 8.3 11 10C11 11.7 9.7 13 8 13C6.3 13 5 11.7 5 10ZM6 10C6 11.1 6.9 12 8 12C9.1 12 10 11.1 10 10C10 8.9 9.1 8 8 8C6.9 8 6 8.9 6 10Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'comment':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M14.5 2H1.5L1 2.5V11.5L1.5 12H4V14.5L4.854 14.854L7.707 12H14.5L15 11.5V2.5L14.5 2ZM14 11H7.5L7.146 11.146L5 13.293V11.5L4.5 11H2V3H14V11Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'tag':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M13.2 2H8.017L7.664 2.146L1 8.81V9.517L6.183 14.7H6.89L9.10507 12.4853C9.65808 12.7768 10.2674 12.9502 10.8942 12.9923C11.6588 13.0437 12.4238 12.8981 13.116 12.5694C13.8082 12.2407 14.4046 11.74 14.8481 11.1151C15.2915 10.4902 15.5673 9.76192 15.649 9C15.6757 8.83446 15.6927 8.66751 15.7 8.5C15.6987 7.30693 15.2242 6.16311 14.3805 5.31948C14.1709 5.10988 13.9428 4.92307 13.7 4.76064V2.5L13.2 2ZM12.7 4.25881C12.2227 4.08965 11.716 4.00057 11.2 4C11.0674 4 10.9402 4.05268 10.8465 4.14645C10.7527 4.24021 10.7 4.36739 10.7 4.5C10.7 4.63261 10.7527 4.75979 10.8465 4.85355C10.9402 4.94732 11.0674 5 11.2 5C11.7238 5 12.2356 5.11743 12.7 5.33771V7.476L8.77481 11.4005C8.75743 11.4095 8.74054 11.4194 8.72425 11.4304C8.66826 11.468 8.62046 11.5166 8.58373 11.5731C8.5745 11.5874 8.56602 11.602 8.55831 11.617L6.536 13.639L2.061 9.163L8.224 3H12.7V4.25881ZM13.7 6.0505C14.3407 6.70435 14.7 7.58365 14.7 8.5C14.6952 8.66769 14.6782 8.8348 14.649 9C14.5673 9.58097 14.3404 10.1319 13.9892 10.6019C13.638 11.0719 13.174 11.4457 12.64 11.6888C12.1061 11.9319 11.5194 12.0363 10.9344 11.9925C10.562 11.9646 10.1979 11.8772 9.85564 11.7348L13.554 8.037L13.7 7.683V6.0505Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'run':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M4 2V14.4805L12.9146 8.24024L4 2ZM11.1809 8.24024L4.995 12.5684V3.91209L11.1809 8.24024Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'check':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6.5 11.5L3 8L4.06 6.94L6.5 9.38L11.94 3.94L13 5L6.5 11.5Z" fill="currentColor" />
        </svg>
      );
    case 'error':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12.32 11.26L9.06 8L12.32 4.74L11.26 3.68L8 6.94L4.74 3.68L3.68 4.74L6.94 8L3.68 11.26L4.74 12.32L8 9.06L11.26 12.32L12.32 11.26Z"
            fill="currentColor"
          />
        </svg>
      );
    default:
      return null;
  }
};

const TimelineItem: React.FC<TimelineItemInternalProps> = ({
  status,
  label,
  description,
  href,
  onClick,
  isLast,
  icon
}) => {
  const getIconContent = () => {
    // If a custom icon is provided, use it
    if (icon) {
      return getIconByName(icon);
    }

    // Fall back to status-based icons
    switch (status) {
      case 'success':
        return getIconByName('check');
      case 'error':
        return getIconByName('error');
      case 'pending':
      case 'incomplete':
      default:
        return <div className="vscode-timeline-item__dot" />;
    }
  };

  const itemClass = [
    'vscode-timeline-item',
    `vscode-timeline-item--${status}`,
    isLast && 'vscode-timeline-item--last',
    onClick && 'vscode-timeline-item--clickable'
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div className={itemClass} onClick={handleClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="vscode-timeline-item__indicator">
        <div className="vscode-timeline-item__icon">{getIconContent()}</div>
        {!isLast && <div className="vscode-timeline-item__line" />}
      </div>
      <div className="vscode-timeline-item__content">
        {href ? (
          <a href={href} className="vscode-timeline-item__link">
            <div className="vscode-timeline-item__label">{label}</div>
            {description && <div className="vscode-timeline-item__description">{description}</div>}
          </a>
        ) : (
          <>
            <div className="vscode-timeline-item__label">{label}</div>
            {description && <div className="vscode-timeline-item__description">{description}</div>}
          </>
        )}
      </div>
    </div>
  );
};
