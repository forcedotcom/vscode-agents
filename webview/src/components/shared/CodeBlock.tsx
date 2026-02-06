// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import './CodeBlock.css';

export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The code content to display
   */
  code: string;
  /**
   * Optional language label
   */
  language?: string;
  /**
   * Whether to show the copy button
   */
  showCopy?: boolean;
}

/**
 * Applies syntax highlighting to a JSON string by wrapping tokens in styled spans.
 * Uses regex to identify keys, strings, numbers, booleans, and null values.
 */
function highlightJson(json: string): string {
  const escaped = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return escaped.replace(
    /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (match.startsWith('"')) {
        cls = match.endsWith(':') ? 'json-key' : 'json-string';
      } else if (/^(true|false)$/.test(match)) {
        cls = 'json-boolean';
      } else if (match === 'null') {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

/**
 * The Visual Studio Code code block component.
 *
 * @remarks
 * A standalone React code block component with copy functionality that inherits from VSCode theme colors.
 *
 * @public
 */
export const CodeBlock = React.forwardRef<HTMLDivElement, CodeBlockProps>(
  ({ code, language, showCopy = true, className, ...props }, ref) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy code:', err);
      }
    };

    const showHeader = language || showCopy;
    const useJsonHighlighting = language === 'json';

    const codeBlockClass = [
      'vscode-code-block',
      !showHeader && 'vscode-code-block--no-header',
      !language && showCopy && 'vscode-code-block--no-language',
      language && 'vscode-code-block--has-language',
      className
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div ref={ref} className={codeBlockClass} {...props}>
        {showHeader && (
          <div className="vscode-code-block__header">
            {language && <span className="vscode-code-block__language">{language}</span>}
            {showCopy && (
              <button
                className="vscode-code-block__copy"
                onClick={handleCopy}
                aria-label="Copy code"
                title={copied ? 'Copied!' : 'Copy code'}
              >
                {copied ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6.5 11.5L3 8L4.06 6.94L6.5 9.38L11.94 3.94L13 5L6.5 11.5Z" fill="currentColor" />
                    </svg>
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 4V2H12V10H10V12H2V4H4ZM4 4H10V10" stroke="currentColor" strokeWidth="1" fill="none" />
                    </svg>
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
        <pre className="vscode-code-block__content">
          {useJsonHighlighting ? (
            <code dangerouslySetInnerHTML={{ __html: highlightJson(code) }} />
          ) : (
            <code>{code}</code>
          )}
        </pre>
      </div>
    );
  }
);

CodeBlock.displayName = 'CodeBlock';
