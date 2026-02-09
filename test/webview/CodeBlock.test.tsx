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
import { CodeBlock } from '../../webview/src/components/shared/CodeBlock';

describe('CodeBlock', () => {
  describe('rendering', () => {
    it('renders code as plain text by default', () => {
      const { container } = render(<CodeBlock code="hello world" showCopy={false} />);
      const codeEl = container.querySelector('code');
      expect(codeEl).toHaveTextContent('hello world');
      expect(codeEl?.innerHTML).toBe('hello world');
    });

    it('renders with copy button by default', () => {
      render(<CodeBlock code="test" />);
      expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
    });

    it('hides copy button when showCopy is false', () => {
      render(<CodeBlock code="test" showCopy={false} />);
      expect(screen.queryByRole('button', { name: 'Copy code' })).not.toBeInTheDocument();
    });

    it('shows language label when language prop is provided', () => {
      render(<CodeBlock code="test" language="typescript" />);
      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('does not show header when showCopy is false and no language', () => {
      const { container } = render(<CodeBlock code="test" showCopy={false} />);
      expect(container.querySelector('.vscode-code-block__header')).not.toBeInTheDocument();
    });
  });

  describe('JSON syntax highlighting', () => {
    it('highlights JSON when highlight="json" is set', () => {
      const json = '{\n  "name": "test"\n}';
      const { container } = render(<CodeBlock code={json} highlight="json" showCopy={false} />);
      const codeEl = container.querySelector('code');

      expect(codeEl?.querySelectorAll('.json-key')).toHaveLength(1);
      expect(codeEl?.querySelectorAll('.json-string')).toHaveLength(1);
    });

    it('does not highlight when highlight prop is absent', () => {
      const json = '{\n  "name": "test"\n}';
      const { container } = render(<CodeBlock code={json} showCopy={false} />);
      const codeEl = container.querySelector('code');

      expect(codeEl?.querySelectorAll('.json-key')).toHaveLength(0);
      expect(codeEl?.querySelectorAll('.json-string')).toHaveLength(0);
    });

    it('does not show header when only highlight is set (no language)', () => {
      const { container } = render(<CodeBlock code="{}" highlight="json" showCopy={false} />);
      expect(container.querySelector('.vscode-code-block__header')).not.toBeInTheDocument();
    });

    it('highlights string values', () => {
      const json = '{\n  "key": "value"\n}';
      const { container } = render(<CodeBlock code={json} highlight="json" showCopy={false} />);
      const strings = container.querySelectorAll('.json-string');

      expect(strings).toHaveLength(1);
      expect(strings[0].textContent).toBe('"value"');
    });

    it('highlights property keys', () => {
      const json = '{\n  "myKey": "value"\n}';
      const { container } = render(<CodeBlock code={json} highlight="json" showCopy={false} />);
      const keys = container.querySelectorAll('.json-key');

      expect(keys).toHaveLength(1);
      expect(keys[0].textContent).toContain('"myKey"');
    });

    it('highlights numbers', () => {
      const json = '{\n  "count": 42\n}';
      const { container } = render(<CodeBlock code={json} highlight="json" showCopy={false} />);
      const numbers = container.querySelectorAll('.json-number');

      expect(numbers).toHaveLength(1);
      expect(numbers[0].textContent).toBe('42');
    });

    it('highlights booleans', () => {
      const json = '{\n  "enabled": true,\n  "disabled": false\n}';
      const { container } = render(<CodeBlock code={json} highlight="json" showCopy={false} />);
      const booleans = container.querySelectorAll('.json-boolean');

      expect(booleans).toHaveLength(2);
      expect(booleans[0].textContent).toBe('true');
      expect(booleans[1].textContent).toBe('false');
    });

    it('highlights null values', () => {
      const json = '{\n  "data": null\n}';
      const { container } = render(<CodeBlock code={json} highlight="json" showCopy={false} />);
      const nulls = container.querySelectorAll('.json-null');

      expect(nulls).toHaveLength(1);
      expect(nulls[0].textContent).toBe('null');
    });

    it('highlights negative and decimal numbers', () => {
      const json = '{\n  "a": -1,\n  "b": 3.14\n}';
      const { container } = render(<CodeBlock code={json} highlight="json" showCopy={false} />);
      const numbers = container.querySelectorAll('.json-number');

      expect(numbers).toHaveLength(2);
      expect(numbers[0].textContent).toBe('-1');
      expect(numbers[1].textContent).toBe('3.14');
    });

    it('escapes HTML entities in JSON content', () => {
      const json = '{\n  "html": "<script>alert(1)</script>"\n}';
      const { container } = render(<CodeBlock code={json} highlight="json" showCopy={false} />);
      const codeEl = container.querySelector('code');

      // Should not contain raw HTML tags
      expect(codeEl?.querySelector('script')).toBeNull();
      // But the text content should show the original characters
      expect(codeEl?.textContent).toContain('<script>alert(1)</script>');
    });

    it('handles complex nested JSON', () => {
      const json = JSON.stringify(
        {
          name: 'test',
          count: 5,
          active: true,
          data: null,
          items: ['a', 'b'],
          nested: { x: 1 }
        },
        null,
        2
      );
      const { container } = render(<CodeBlock code={json} highlight="json" showCopy={false} />);

      expect(container.querySelectorAll('.json-key').length).toBeGreaterThan(0);
      expect(container.querySelectorAll('.json-string').length).toBeGreaterThan(0);
      expect(container.querySelectorAll('.json-number').length).toBeGreaterThan(0);
      expect(container.querySelectorAll('.json-boolean').length).toBeGreaterThan(0);
      expect(container.querySelectorAll('.json-null').length).toBeGreaterThan(0);
    });
  });

  describe('copy functionality', () => {
    it('copies code to clipboard when copy button is clicked', async () => {
      const user = userEvent.setup();
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: jest.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true
      });

      render(<CodeBlock code="copy me" />);
      await user.click(screen.getByRole('button', { name: 'Copy code' }));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('copy me');
    });

    it('copies raw code (not highlighted HTML) when highlight is set', async () => {
      const user = userEvent.setup();
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: jest.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true
      });

      const json = '{"key": "value"}';
      render(<CodeBlock code={json} highlight="json" />);
      await user.click(screen.getByRole('button', { name: 'Copy code' }));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(json);
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to the container div', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<CodeBlock ref={ref} code="test" showCopy={false} />);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.classList.contains('vscode-code-block')).toBe(true);
    });
  });
});
