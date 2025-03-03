import { expect } from 'aegir/chai';
import { ParserContext, CacheStatus } from '../src/parser-context.js';
import { StringStream } from '../src/string-stream.js';
import type { Item, Text, List } from '../src/ast/ast.js';

describe('ParserContext', () => {
  describe('constructor', () => {
    it('should create a new ParserContext with default options', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      expect(context.reader).to.equal(stream);
      expect(context.whitespaceRule).to.be.undefined;
      expect(context.caseSensitive).to.be.true;
    });

    it('should create a new ParserContext with custom options', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream, false, {
        whitespaceRule: 'ws',
        caseSensitive: false
      });

      expect(context.reader).to.equal(stream);
      expect(context.whitespaceRule).to.equal('ws');
      expect(context.caseSensitive).to.be.false;
    });
  });

  describe('transaction methods', () => {
    it('should handle begin/commit transaction', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      // Initial state
      expect(stream.position).to.equal(0);

      // Begin transaction
      context.beginTransaction();

      // Move position
      stream.position = 2;
      expect(stream.position).to.equal(2);

      // Commit transaction
      context.commitTransaction();

      // Position should remain at 2
      expect(stream.position).to.equal(2);
    });

    it('should handle begin/rollback transaction', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      // Initial state
      expect(stream.position).to.equal(0);

      // Begin transaction
      context.beginTransaction();

      // Move position
      stream.position = 2;
      expect(stream.position).to.equal(2);

      // Rollback transaction
      context.rollbackTransaction();

      // Position should be back to 0
      expect(stream.position).to.equal(0);
    });

    it('should throw error when committing with no active transaction', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      expect(() => context.commitTransaction()).to.throw('No active transaction to commit');
    });

    it('should throw error when rolling back with no active transaction', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      expect(() => context.rollbackTransaction()).to.throw('No active transaction to rollback');
    });

    it('should handle nested transactions', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      // Initial state
      expect(stream.position).to.equal(0);

      // Begin outer transaction
      context.beginTransaction();

      // Move position
      stream.position = 1;
      expect(stream.position).to.equal(1);

      // Begin inner transaction
      context.beginTransaction();

      // Move position again
      stream.position = 2;
      expect(stream.position).to.equal(2);

      // Rollback inner transaction
      context.rollbackTransaction();

      // Position should be back to 1
      expect(stream.position).to.equal(1);

      // Commit outer transaction
      context.commitTransaction();

      // Position should remain at 1
      expect(stream.position).to.equal(1);
    });
  });

  describe('result handling', () => {
    it('should push and access results', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      const testResult: Text = {
        type: 'text',
        value: 'test',
        start: 0,
        end: 0
      };

      context.pushResult(testResult);

      expect(context.result).to.deep.equal({
        type: 'text',
        value: 'test',
        start: 0,
        end: 0
      });
    });

    it('should throw error when accessing result with empty stack', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      expect(() => context.result).to.throw('No result on stack');
    });

    it('should append items to result', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      // Push initial result
      context.pushResult({
        type: 'text',
        value: 'hello',
        start: 0,
        end: 5
      } as Text);

      // Append another result
      context.append({
        type: 'text',
        value: ' world',
        start: 5,
        end: 11
      } as Text);

      // Check combined result
      expect(context.result).to.deep.equal({
        type: 'text',
        value: 'hello world',
        start: 0,
        end: 11
      });
    });

    it('should handle list items when appending', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      // Push initial list result
      context.pushResult({
        type: 'list',
        items: [{ type: 'text', value: 'a', start: 0, end: 1 } as Text],
        start: 0,
        end: 1
      } as List);

      // Append another item
      context.append({
        type: 'text',
        value: 'b',
        start: 1,
        end: 2
      } as Text);

      // Check combined result
      expect(context.result).to.deep.equal({
        type: 'list',
        items: [
          { type: 'text', value: 'a', start: 0, end: 1 },
          { type: 'text', value: 'b', start: 1, end: 2 }
        ],
        start: 0,
        end: 2
      });
    });
  });

  describe('caching', () => {
    it('should handle cache operations', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);
      const defName = 'testDef';

      // Start caching
      context.cacheStart(defName);

      // Move position
      stream.position = 2;

      // Create a result
      const result: Text = { type: 'text', value: 'te', start: 0, end: 2 };

      // Cache success
      context.cacheSucceed(defName, 0, 2, result);

      // Reset position
      stream.position = 0;

      // Check if cache hit works
      const cacheHit = context.cacheSeek(defName);
      expect(cacheHit).to.be.true;
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
      expect(cacheHit).to.be.false;
      expect(stream.position).to.equal(0);
    });

    it('should return null for non-existent cache entries', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);

      const cacheHit = context.cacheSeek('nonExistentDef');
      expect(cacheHit).to.be.null;
    });

    it('should reset cache entries', () => {
      const stream = new StringStream('test');
      const context = new ParserContext(stream);
      const defName = 'testDef';

      // Start caching
      context.cacheStart(defName);

      // Cache failure
      context.cacheFail(defName, 0);

      // Reset cache
      context.cacheReset();

      // Should be null now
      const cacheHit = context.cacheSeek(defName);
      expect(cacheHit).to.be.null;
    });
  });
});
