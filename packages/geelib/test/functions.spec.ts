import { expect } from 'aegir/chai';
import { parseGrammarText, parseGrammar, parseText, parseStream, matchesText, matchesStream } from '../src/functions.js';
import { StringStream } from '../src/string-stream.js';
import { OptimizedGrammar } from '../src/grammar.js';

describe('Functions', () => {
  // Simple grammar for testing
  const simpleGrammarText = `
    grammar Simple;

    start = digit+;
    digit = [0-9];
  `;

  let simpleGrammar: OptimizedGrammar;

  before(() => {
    // Parse the grammar once for all tests
    simpleGrammar = parseGrammarText(simpleGrammarText);
  });

  describe('parseGrammarText', () => {
    it('should parse a grammar from text', () => {
      const grammar = parseGrammarText(simpleGrammarText);
      expect(grammar).to.be.an('object');
      expect(grammar.definitions).to.be.an('object');
      expect(grammar.root).to.equal('start');
    });

    it('should throw an error for invalid grammar text', () => {
      expect(() => parseGrammarText('invalid grammar')).to.throw();
    });
  });

  describe('parseGrammar', () => {
    it('should parse a grammar from a TokenStream', () => {
      const stream = new StringStream(simpleGrammarText);
      const grammar = parseGrammar(stream);
      expect(grammar).to.be.an('object');
      expect(grammar.definitions).to.be.an('object');
      expect(grammar.root).to.equal('start');
    });
  });

  describe('parseText', () => {
    it('should parse text using a grammar', () => {
      const result = parseText(simpleGrammar, '123');
      expect(result).to.not.be.null;
    });

    it('should return null for non-matching text', () => {
      const result = parseText(simpleGrammar, 'abc');
      expect(result).to.be.null;
    });
  });

  describe('parseStream', () => {
    it('should parse a stream using a grammar', () => {
      const stream = new StringStream('123');
      const result = parseStream(simpleGrammar, stream);
      expect(result).to.not.be.null;
    });

    it('should return null for non-matching stream', () => {
      const stream = new StringStream('abc');
      const result = parseStream(simpleGrammar, stream);
      expect(result).to.be.null;
    });
  });

  describe('matchesText', () => {
    it('should return true for matching text', () => {
      expect(matchesText(simpleGrammar, '123')).to.be.true;
    });

    it('should return false for non-matching text', () => {
      expect(matchesText(simpleGrammar, 'abc')).to.be.false;
    });
  });

  describe('matchesStream', () => {
    it('should return true for matching stream', () => {
      const stream = new StringStream('123');
      expect(matchesStream(simpleGrammar, stream)).to.be.true;
    });

    it('should return false for non-matching stream', () => {
      const stream = new StringStream('abc');
      expect(matchesStream(simpleGrammar, stream)).to.be.false;
    });
  });
});
