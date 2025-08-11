/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Simplified JSON formatter extracted from oclif's colorizeJson functionality.
 * This version focuses only on prettifying JSON without colors.
 * Always formats with pretty printing (2-space indentation).
 */

function stringify(value: unknown, replacer?: unknown, spaces?: number): string {
  return JSON.stringify(value, serializer(replacer, replacer), spaces);
}

// Inspired by https://github.com/moll/json-stringify-safe
function serializer(replacer: unknown, cycleReplacer?: unknown) {
  const stack: unknown[] = [];
  const keys: string[] = [];
  
  if (!cycleReplacer) {
    cycleReplacer = function (_key: string, value: unknown) {
      if (stack[0] === value) return '[Circular ~]';
      return '[Circular ~.' + keys.slice(0, stack.indexOf(value)).join('.') + ']';
    };
  }

  return function (key: string, value: unknown) {
    if (stack.length > 0) {
      // @ts-expect-error because `this` is not typed
      const thisPos = stack.indexOf(this);
      // @ts-expect-error because `this` is not typed
      // eslint-disable-next-line no-bitwise, @typescript-eslint/no-unused-expressions
      ~thisPos ? stack.splice(thisPos + 1) : stack.push(this);
      // eslint-disable-next-line no-bitwise, @typescript-eslint/no-unused-expressions
      ~thisPos ? keys.splice(thisPos, Number.POSITIVE_INFINITY, key) : keys.push(key);
      // @ts-expect-error because `this` is not typed
      if (stack.includes(value)) value = (cycleReplacer as any).call(this, key, value);
    } else {
      stack.push(value);
    }
    
    // @ts-expect-error because `this` is not typed
    return replacer ? (replacer as any).call(this, key, value) : value;
  };
}

/**
 * Formats JSON input into a pretty-printed string with 2-space indentation.
 * 
 * @param json - The JSON object or string to format
 * @returns Pretty-formatted JSON string
 */
export function formatJson(json: unknown): string {
  return stringify(typeof json === 'string' ? JSON.parse(json) : json, undefined, 2);
}