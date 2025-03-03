import { expect } from 'aegir/chai';
import { CharSet } from '../src/types.js';

describe('CharSet', () => {
  describe('constructor', () => {
    it('should create an empty CharSet when no range is provided', () => {
      const charset = new CharSet();
      expect(charset.matches('a')).to.be.false;
      expect(charset.matches('z')).to.be.false;
      expect(charset.matches('0')).to.be.false;
    });

    it('should create a CharSet with the provided range', () => {
      const charset = new CharSet({ low: 97, high: 122 }); // a-z
      expect(charset.matches('a')).to.be.true;
      expect(charset.matches('m')).to.be.true;
      expect(charset.matches('z')).to.be.true;
      expect(charset.matches('A')).to.be.false;
      expect(charset.matches('0')).to.be.false;
    });
  });

  describe('union()', () => {
    it('should union with another CharRange', () => {
      const charset = new CharSet({ low: 97, high: 122 }); // a-z
      charset.union({ low: 65, high: 90 }); // A-Z

      expect(charset.matches('a')).to.be.true;
      expect(charset.matches('z')).to.be.true;
      expect(charset.matches('A')).to.be.true;
      expect(charset.matches('Z')).to.be.true;
      expect(charset.matches('0')).to.be.false;
    });

    it('should union with another CharSet', () => {
      const charset1 = new CharSet({ low: 97, high: 122 }); // a-z
      const charset2 = new CharSet({ low: 65, high: 90 }); // A-Z

      charset1.union(charset2);

      expect(charset1.matches('a')).to.be.true;
      expect(charset1.matches('z')).to.be.true;
      expect(charset1.matches('A')).to.be.true;
      expect(charset1.matches('Z')).to.be.true;
      expect(charset1.matches('0')).to.be.false;
    });

    it('should merge overlapping ranges', () => {
      const charset = new CharSet({ low: 97, high: 110 }); // a-n
      charset.union({ low: 105, high: 122 }); // i-z

      // Should now have a single range a-z (97-122)
      expect(charset.matches('a')).to.be.true;
      expect(charset.matches('i')).to.be.true;
      expect(charset.matches('n')).to.be.true;
      expect(charset.matches('o')).to.be.true;
      expect(charset.matches('z')).to.be.true;
    });

    it('should merge adjacent ranges', () => {
      const charset = new CharSet({ low: 97, high: 109 }); // a-m
      charset.union({ low: 110, high: 122 }); // n-z

      // Should now have a single range a-z (97-122)
      expect(charset.matches('a')).to.be.true;
      expect(charset.matches('m')).to.be.true;
      expect(charset.matches('n')).to.be.true;
      expect(charset.matches('z')).to.be.true;
    });
  });

  describe('matches()', () => {
    it('should return true for characters in the set', () => {
      const charset = new CharSet({ low: 97, high: 122 }); // a-z

      expect(charset.matches('a')).to.be.true;
      expect(charset.matches('m')).to.be.true;
      expect(charset.matches('z')).to.be.true;
    });

    it('should return false for characters not in the set', () => {
      const charset = new CharSet({ low: 97, high: 122 }); // a-z

      expect(charset.matches('A')).to.be.false;
      expect(charset.matches('0')).to.be.false;
      expect(charset.matches(' ')).to.be.false;
    });

    it('should handle multiple ranges correctly', () => {
      const charset = new CharSet({ low: 97, high: 122 }); // a-z
      charset.union({ low: 48, high: 57 }); // 0-9

      expect(charset.matches('a')).to.be.true;
      expect(charset.matches('z')).to.be.true;
      expect(charset.matches('0')).to.be.true;
      expect(charset.matches('9')).to.be.true;
      expect(charset.matches('A')).to.be.false;
      expect(charset.matches(' ')).to.be.false;
    });
  });

  describe('invert()', () => {
    it('should invert an empty charset to include all characters', () => {
      const charset = new CharSet();
      charset.invert();

      expect(charset.matches('a')).to.be.true;
      expect(charset.matches('A')).to.be.true;
      expect(charset.matches('0')).to.be.true;
      expect(charset.matches(' ')).to.be.true;
    });

    it('should invert a single range correctly', () => {
      const charset = new CharSet({ low: 97, high: 122 }); // a-z
      charset.invert();

      expect(charset.matches('a')).to.be.false;
      expect(charset.matches('z')).to.be.false;
      expect(charset.matches('A')).to.be.true;
      expect(charset.matches('0')).to.be.true;
      expect(charset.matches(' ')).to.be.true;
    });

    it('should invert multiple ranges correctly', () => {
      const charset = new CharSet({ low: 97, high: 122 }); // a-z
      charset.union({ low: 48, high: 57 }); // 0-9
      charset.invert();

      expect(charset.matches('a')).to.be.false;
      expect(charset.matches('z')).to.be.false;
      expect(charset.matches('0')).to.be.false;
      expect(charset.matches('9')).to.be.false;
      expect(charset.matches('A')).to.be.true;
      expect(charset.matches(' ')).to.be.true;
    });

    it('should handle inverting twice', () => {
      const charset = new CharSet({ low: 97, high: 122 }); // a-z
      charset.invert();
      charset.invert();

      expect(charset.matches('a')).to.be.true;
      expect(charset.matches('z')).to.be.true;
      expect(charset.matches('A')).to.be.false;
      expect(charset.matches('0')).to.be.false;
    });
  });
});
