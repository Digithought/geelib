import { expect } from 'aegir/chai';
import { ParserContext } from '../src/parser-context.js';
import { StringStream } from '../src/string-stream.js';
import { item } from '../src/ast/ast.js';
import type { Text } from '../src/ast/ast.js';

describe('ParserContext', () => {
  describe('position tracking', () => {
    it('should track position correctly', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      // Save position
      const startPos = context.pushPosition();
      expect(startPos).to.equal(0);

      // Move position
      stream.position = 2;

      // Pop position without restoring
      context.popPosition();

      // Position should remain at 2
      expect(stream.position).to.equal(2);
    });

    it('should restore position in parseTransact when operation returns undefined', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      const result = context.parseTransact(() => {
        // Move position
        stream.position = 2;

        // Return undefined to trigger position restore
        return undefined;
      });

      // Position should be back to 0
      expect(stream.position).to.equal(0);
      expect(result).to.be.undefined;
    });

    it('should maintain position in parseTransact when operation returns a value', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      const result = context.parseTransact(() => {
        // Move position
        stream.position = 2;

        // Return a value to keep the position
        return item('test');
      });

      // Position should remain at 2
      expect(stream.position).to.equal(2);
      expect(result).to.not.be.undefined;
    });

    it('should handle nested parseTransact calls', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      const result = context.parseTransact(() => {
        // Move position
        stream.position = 1;

        // Inner transaction that fails
        const innerResult = context.parseTransact(() => {
          // Move position again
          stream.position = 2;

          // Return undefined to trigger position restore
          return undefined;
        });

        // Position should be back to 1
        expect(stream.position).to.equal(1);
        expect(innerResult).to.be.undefined;

        // Return a value from outer transaction
        return item('t');
      });

      // Position should remain at 1
      expect(stream.position).to.equal(1);
      expect(result).to.not.be.undefined;
    });
  });

  describe('caching', () => {
    it('should cache successful parses', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);
      const defName = 'testDef';

      // Start caching
      context.cacheStart(defName);

      // Move position
      stream.position = 2;

      // Create a result
      const result = item('te');

      // Cache success
      context.cacheSucceed(defName, 0, 2, result);

      // Reset position
      stream.position = 0;

      // Check if cache hit works
      const cacheHit = context.cacheSeek(defName);
      expect(cacheHit).to.not.equal(false);
      expect(stream.position).to.equal(2);
    });

    it('should handle cache misses', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);
      const defName = 'testDef';

      // Start caching
      context.cacheStart(defName);

      // Cache failure
      context.cacheFail(defName, 0);

      // Check if cache miss works
      const cacheHit = context.cacheSeek(defName);
      expect(cacheHit).to.equal(false);
      expect(stream.position).to.equal(0);
    });

    it('should use parseCache for caching parse operations', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);
      const defName = 'testDef';

      // First call should execute the operation
      let operationCalled = false;
      const result1 = context.parseCache(defName, () => {
        operationCalled = true;
        stream.position = 2;
        return item('te');
      });

      expect(operationCalled).to.be.true;
      expect(result1).to.not.be.undefined;
      expect(stream.position).to.equal(2);

      // Reset position
      stream.position = 0;

      // Second call should use the cache
      operationCalled = false;
      const result2 = context.parseCache(defName, () => {
        operationCalled = false;
        return undefined;
      });

      expect(operationCalled).to.be.false;
      expect(result2).to.not.be.undefined;
      expect(stream.position).to.equal(2);
    });
  });

  describe('string comparison', () => {
    it('should compare strings case-sensitively by default', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      expect(context.compareStrings('a', 'a')).to.be.true;
      expect(context.compareStrings('a', 'A')).to.be.false;
    });

    it('should compare strings case-insensitively when configured', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream, false, { caseSensitive: false });

      expect(context.compareStrings('a', 'a')).to.be.true;
      expect(context.compareStrings('a', 'A')).to.be.true;
    });

    it('should handle undefined values', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      expect(context.compareStrings('a', undefined)).to.be.false;
      expect(context.compareStrings(undefined, 'a')).to.be.false;
      expect(context.compareStrings(undefined, undefined)).to.be.false;
    });
  });

  describe('item combination', () => {
    it('should combine text items', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      const text1 = item('hello');
      const text2 = item(' world');

      const combined = context.combineItems(text1, text2);
      expect(combined.value).to.equal('hello world');
    });

    it('should combine list items', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      const list1 = item([item('a')]);
      const list2 = item([item('b')]);

      const combined = context.combineItems(list1, list2);
      expect(Array.isArray(combined.value)).to.be.true;
      expect((combined.value as Array<any>).length).to.equal(2);
    });

    it('should convert non-list items to lists when combining with different types', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      const text = item('hello');
      const list = item([item('world')]);

      const combined = context.combineItems(text, list);
      expect(Array.isArray(combined.value)).to.be.true;
      expect((combined.value as Array<any>).length).to.equal(2);
    });
  });
});
