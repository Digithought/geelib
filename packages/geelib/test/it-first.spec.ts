import { expect } from 'aegir/chai';
import { first } from '../src/it-first.js';

describe('first', () => {
  it('should return the first item of an array', () => {
    expect(first([1, 2, 3])).to.equal(1);
    expect(first(['a', 'b', 'c'])).to.equal('a');
    expect(first([{ id: 1 }, { id: 2 }])).to.deep.equal({ id: 1 });
  });

  it('should return the first item of a Set', () => {
    expect(first(new Set([1, 2, 3]))).to.equal(1);
    expect(first(new Set(['a', 'b', 'c']))).to.equal('a');
  });

  it('should return the first item of a Map', () => {
    const map = new Map([
      ['a', 1],
      ['b', 2]
    ]);
    expect(first(map)).to.deep.equal(['a', 1]);
  });

  it('should return the first item of a generator function', () => {
    function* generator() {
      yield 1;
      yield 2;
      yield 3;
    }
    expect(first(generator())).to.equal(1);
  });

  it('should return undefined for an empty iterable', () => {
    expect(first([])).to.be.undefined;
    expect(first(new Set())).to.be.undefined;
    expect(first(new Map())).to.be.undefined;
    function* emptyGenerator() {
      if (false) {
        yield 1; // This will never be reached
      }
    }
    expect(first(emptyGenerator())).to.be.undefined;
  });

  it('should work with custom iterables', () => {
    const customIterable = {
      *[Symbol.iterator]() {
        yield 'custom';
        yield 'values';
      }
    };
    expect(first(customIterable)).to.equal('custom');
  });
});
