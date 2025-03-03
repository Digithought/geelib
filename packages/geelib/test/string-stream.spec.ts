import { expect } from 'aegir/chai';
import { StringStream } from '../src/string-stream.js';

describe('StringStream', () => {
  describe('constructor', () => {
    it('should create a new StringStream with the provided text', () => {
      const stream = new StringStream('test');
      expect(stream.size).to.equal(4);
      expect(stream.position).to.equal(0);
      expect(stream.eof).to.be.false;
    });

    it('should handle empty strings', () => {
      const stream = new StringStream('');
      expect(stream.size).to.equal(0);
      expect(stream.position).to.equal(0);
      expect(stream.eof).to.be.true;
    });
  });

  describe('read()', () => {
    it('should return the character at the current position without advancing', () => {
      const stream = new StringStream('test');
      expect(stream.read()).to.equal('t');
      expect(stream.position).to.equal(0);
    });

    it('should throw an error when attempting to read past the end', () => {
      const stream = new StringStream('');
      expect(() => stream.read()).to.throw('Attempt to read past end of document');
    });
  });

  describe('next()', () => {
    it('should advance the position and return whether EOF is reached', () => {
      const stream = new StringStream('ab');
      expect(stream.position).to.equal(0);

      const result1 = stream.next();
      expect(stream.position).to.equal(1);
      expect(result1).to.be.false;

      const result2 = stream.next();
      expect(stream.position).to.equal(2);
      expect(result2).to.be.true;

      // Position should not advance beyond the end
      const result3 = stream.next();
      expect(stream.position).to.equal(2);
      expect(result3).to.be.true;
    });
  });

  describe('readThenNext()', () => {
    it('should read the current character and advance the position', () => {
      const stream = new StringStream('test');
      expect(stream.readThenNext()).to.equal('t');
      expect(stream.position).to.equal(1);
      expect(stream.readThenNext()).to.equal('e');
      expect(stream.position).to.equal(2);
    });

    it('should throw an error when attempting to read past the end', () => {
      const stream = new StringStream('a');
      stream.readThenNext(); // Read 'a' and advance
      expect(() => stream.readThenNext()).to.throw('Attempt to read past end of document');
    });
  });

  describe('position property', () => {
    it('should allow getting and setting the position', () => {
      const stream = new StringStream('test');
      expect(stream.position).to.equal(0);

      stream.position = 2;
      expect(stream.position).to.equal(2);
      expect(stream.read()).to.equal('s');
    });

    it('should clamp position to valid range when setting', () => {
      const stream = new StringStream('test');

      stream.position = -5;
      expect(stream.position).to.equal(0);

      stream.position = 10;
      expect(stream.position).to.equal(4);
    });
  });

  describe('eof property', () => {
    it('should return true when at the end of the stream', () => {
      const stream = new StringStream('a');
      expect(stream.eof).to.be.false;

      stream.position = 1;
      expect(stream.eof).to.be.true;
    });

    it('should return true for empty streams', () => {
      const stream = new StringStream('');
      expect(stream.eof).to.be.true;
    });
  });

  describe('size property', () => {
    it('should return the length of the input string', () => {
      expect(new StringStream('').size).to.equal(0);
      expect(new StringStream('a').size).to.equal(1);
      expect(new StringStream('test').size).to.equal(4);
      expect(new StringStream('hello world').size).to.equal(11);
    });
  });

  describe('getSegment()', () => {
    it('should return the specified segment of the input string', () => {
      const stream = new StringStream('hello world');
      expect(stream.getSegment(0, 5)).to.equal('hello');
      expect(stream.getSegment(6, 5)).to.equal('world');
      expect(stream.getSegment(0, 11)).to.equal('hello world');
    });

    it('should handle edge cases', () => {
      const stream = new StringStream('test');
      expect(stream.getSegment(0, 0)).to.equal('');
      expect(stream.getSegment(4, 1)).to.equal('');
      expect(stream.getSegment(2, 10)).to.equal('st');
    });
  });
});
