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
import { MockPosition } from '../../scripts/MockPosition';

describe('MockPosition', () => {
  describe('constructor', () => {
    it('should create a position with line and character', () => {
      const pos = new MockPosition(5, 10);
      expect(pos.line).toBe(5);
      expect(pos.character).toBe(10);
    });
  });

  describe('isBefore', () => {
    it('should return true when line is before other line', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(10, 5);
      expect(pos1.isBefore(pos2)).toBe(true);
    });

    it('should return false when line is after other line', () => {
      const pos1 = new MockPosition(10, 5);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.isBefore(pos2)).toBe(false);
    });

    it('should return true when line is same and character is before', () => {
      const pos1 = new MockPosition(5, 5);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.isBefore(pos2)).toBe(true);
    });

    it('should return false when line is same and character is after', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(5, 5);
      expect(pos1.isBefore(pos2)).toBe(false);
    });

    it('should return false when positions are equal', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.isBefore(pos2)).toBe(false);
    });
  });

  describe('isBeforeOrEqual', () => {
    it('should return true when line is before other line', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(10, 5);
      expect(pos1.isBeforeOrEqual(pos2)).toBe(true);
    });

    it('should return false when line is after other line', () => {
      const pos1 = new MockPosition(10, 5);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.isBeforeOrEqual(pos2)).toBe(false);
    });

    it('should return true when line is same and character is before', () => {
      const pos1 = new MockPosition(5, 5);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.isBeforeOrEqual(pos2)).toBe(true);
    });

    it('should return false when line is same and character is after', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(5, 5);
      expect(pos1.isBeforeOrEqual(pos2)).toBe(false);
    });

    it('should return true when positions are equal', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.isBeforeOrEqual(pos2)).toBe(true);
    });
  });

  describe('isAfter', () => {
    it('should return false when line is before other line', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(10, 5);
      expect(pos1.isAfter(pos2)).toBe(false);
    });

    it('should return true when line is after other line', () => {
      const pos1 = new MockPosition(10, 5);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.isAfter(pos2)).toBe(true);
    });

    it('should return false when line is same and character is before', () => {
      const pos1 = new MockPosition(5, 5);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.isAfter(pos2)).toBe(false);
    });

    it('should return true when line is same and character is after', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(5, 5);
      expect(pos1.isAfter(pos2)).toBe(true);
    });

    it('should return false when positions are equal', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.isAfter(pos2)).toBe(false);
    });
  });

  describe('isAfterOrEqual', () => {
    it('should return false when line is before other line', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(10, 5);
      expect(pos1.isAfterOrEqual(pos2)).toBe(false);
    });

    it('should return true when line is after other line', () => {
      const pos1 = new MockPosition(10, 5);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.isAfterOrEqual(pos2)).toBe(true);
    });

    it('should return false when line is same and character is before', () => {
      const pos1 = new MockPosition(5, 5);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.isAfterOrEqual(pos2)).toBe(false);
    });

    it('should return true when line is same and character is after', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(5, 5);
      expect(pos1.isAfterOrEqual(pos2)).toBe(true);
    });

    it('should return true when positions are equal', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.isAfterOrEqual(pos2)).toBe(true);
    });
  });

  describe('isEqual', () => {
    it('should return true when positions are equal', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.isEqual(pos2)).toBe(true);
    });

    it('should return false when lines differ', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(6, 10);
      expect(pos1.isEqual(pos2)).toBe(false);
    });

    it('should return false when characters differ', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(5, 11);
      expect(pos1.isEqual(pos2)).toBe(false);
    });
  });

  describe('compareTo', () => {
    it('should return -1 when line is before other line', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(10, 5);
      expect(pos1.compareTo(pos2)).toBe(-1);
    });

    it('should return 1 when line is after other line', () => {
      const pos1 = new MockPosition(10, 5);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.compareTo(pos2)).toBe(1);
    });

    it('should return -1 when line is same and character is before', () => {
      const pos1 = new MockPosition(5, 5);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.compareTo(pos2)).toBe(-1);
    });

    it('should return 1 when line is same and character is after', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(5, 5);
      expect(pos1.compareTo(pos2)).toBe(1);
    });

    it('should return 0 when positions are equal', () => {
      const pos1 = new MockPosition(5, 10);
      const pos2 = new MockPosition(5, 10);
      expect(pos1.compareTo(pos2)).toBe(0);
    });
  });

  describe('translate', () => {
    it('should translate both line and character with positive deltas', () => {
      const pos = new MockPosition(5, 10);
      const translated = pos.translate({ lineDelta: 3, characterDelta: 5 });
      expect(translated.line).toBe(8);
      expect(translated.character).toBe(15);
    });

    it('should translate both line and character with negative deltas', () => {
      const pos = new MockPosition(5, 10);
      const translated = pos.translate({ lineDelta: -2, characterDelta: -3 });
      expect(translated.line).toBe(3);
      expect(translated.character).toBe(7);
    });

    it('should translate only line when characterDelta is not provided', () => {
      const pos = new MockPosition(5, 10);
      const translated = pos.translate({ lineDelta: 2 });
      expect(translated.line).toBe(7);
      expect(translated.character).toBe(10);
    });

    it('should translate only character when lineDelta is not provided', () => {
      const pos = new MockPosition(5, 10);
      const translated = pos.translate({ characterDelta: 5 });
      expect(translated.line).toBe(5);
      expect(translated.character).toBe(15);
    });

    it('should return same position when no deltas provided', () => {
      const pos = new MockPosition(5, 10);
      const translated = pos.translate({});
      expect(translated.line).toBe(5);
      expect(translated.character).toBe(10);
    });
  });

  describe('with', () => {
    it('should create new position with updated line', () => {
      const pos = new MockPosition(5, 10);
      const updated = pos.with(8);
      expect(updated.line).toBe(8);
      expect(updated.character).toBe(10);
    });

    it('should create new position with updated character', () => {
      const pos = new MockPosition(5, 10);
      const updated = pos.with(undefined, 15);
      expect(updated.line).toBe(5);
      expect(updated.character).toBe(15);
    });

    it('should create new position with both line and character updated', () => {
      const pos = new MockPosition(5, 10);
      const updated = pos.with(8, 15);
      expect(updated.line).toBe(8);
      expect(updated.character).toBe(15);
    });

    it('should return new position with same values when no parameters provided', () => {
      const pos = new MockPosition(5, 10);
      const updated = pos.with();
      expect(updated.line).toBe(5);
      expect(updated.character).toBe(10);
    });
  });
});
