import { expect } from 'aegir/chai';
import { parseGrammarText, parseGrammar, parseText, parseStream, matchesText, matchesStream } from '../src/functions.js';
import { StringStream } from '../src/string-stream.js';
import { OptimizedGrammar } from '../src/optimize/optimizer.js';
import { buildGrammar } from '../src/grammar-builder.js';
import { item } from '../src/ast/ast.js';
import { optimize } from '../src/optimize/optimizer.js';
import { isNode, isText, isList } from '../src/ast/ast.js';
import type { Item, Node, Text } from '../src/ast/ast.js';

describe('Grammar Functions', () => {
  // Simple Gee grammar text for testing parseGrammarText and parseGrammar
  const simpleGeeGrammarText = `
grammar Simple
  whitespace: _

Number :=
  _ digit*+ _

digit =
  '0'..'9'

_ :=
  { ' ', #9..#13 }*`;

  before(() => {
  });

  describe('parseGrammarText', () => {
    it('should parse a grammar from text', () => {
			const grammar = parseGrammarText(simpleGeeGrammarText);
      expect(grammar).to.be.an('object');
      expect(grammar.definitions).to.be.an('object');
      expect(grammar.root).to.equal('Number');

      // Verify the grammar works by parsing a simple input
      const result = parseText(grammar, ' 123 ');
      expect(result).to.not.be.null;
    });

    it('should throw an error for invalid grammar text', () => {
      expect(() => parseGrammarText('invalid grammar')).to.throw();
    });

    it('should throw an error for null grammar text', () => {
      // @ts-ignore - Testing invalid input
      expect(() => parseGrammarText(null)).to.throw('Grammar text cannot be null or undefined');
    });

    it('should throw an error for undefined grammar text', () => {
      // @ts-ignore - Testing invalid input
      expect(() => parseGrammarText(undefined)).to.throw('Grammar text cannot be null or undefined');
    });
  });

  describe('parseGrammar', () => {
    it('should parse a grammar from a TokenStream', () => {
      const stream = new StringStream(simpleGeeGrammarText);
      const grammar = parseGrammar(stream);
      expect(grammar).to.be.an('object');
      expect(grammar.definitions).to.be.an('object');
      expect(grammar.root).to.equal('Number');

      // Verify the grammar works by parsing a simple input
      const result = parseText(grammar, ' 123 ');
      expect(result).to.not.be.null;
    });

    it('should throw an error for invalid grammar stream', () => {
      const stream = new StringStream('invalid grammar');
      expect(() => parseGrammar(stream)).to.throw();
    });

    it('should throw an error for null grammar stream', () => {
      // @ts-ignore - Testing invalid input
      expect(() => parseGrammar(null)).to.throw('Grammar stream cannot be null or undefined');
    });

    it('should throw an error for undefined grammar stream', () => {
      // @ts-ignore - Testing invalid input
      expect(() => parseGrammar(undefined)).to.throw('Grammar stream cannot be null or undefined');
    });
  });
});
