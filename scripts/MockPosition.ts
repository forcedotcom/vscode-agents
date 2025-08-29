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
export class MockPosition {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}

  public isBefore(other: MockPosition): boolean {
    if (this.line < other.line) {
      return true;
    }
    if (other.line < this.line) {
      return false;
    }
    return this.character < other.character;
  }

  public isBeforeOrEqual(other: MockPosition): boolean {
    if (this.line < other.line) {
      return true;
    }
    if (other.line < this.line) {
      return false;
    }
    return this.character <= other.character;
  }

  public isAfter(other: MockPosition): boolean {
    if (this.line > other.line) {
      return true;
    }
    if (other.line > this.line) {
      return false;
    }
    return this.character > other.character;
  }

  public isAfterOrEqual(other: MockPosition): boolean {
    if (this.line > other.line) {
      return true;
    }
    if (other.line > this.line) {
      return false;
    }
    return this.character >= other.character;
  }

  public isEqual(other: MockPosition): boolean {
    return this.line === other.line && this.character === other.character;
  }

  public compareTo(other: MockPosition): number {
    if (this.line < other.line) {
      return -1;
    }
    if (this.line > other.line) {
      return 1;
    }
    if (this.character < other.character) {
      return -1;
    }
    if (this.character > other.character) {
      return 1;
    }
    return 0;
  }

  public translate(delta: { lineDelta?: number; characterDelta?: number }): MockPosition {
    return new MockPosition(this.line + (delta.lineDelta || 0), this.character + (delta.characterDelta || 0));
  }

  public with(line?: number, character?: number): MockPosition {
    return new MockPosition(
      line !== undefined ? line : this.line,
      character !== undefined ? character : this.character
    );
  }
}
