import { expect } from 'aegir/chai';
import { Parser } from '../src/parser.js';
import { StringStream } from '../src/string-stream.js';
import { buildGrammar } from '../src/grammar-builder.js';
import { node, text, list } from '../src/ast/ast.js';
import { optimize } from '../src/optimize/optimizer.js';
import type { Node, Text, List } from '../src/ast/ast.js';

describe('Parser - Terminal Tests', () => {
  describe('Char rule', () => {
    it('should parse a character by index', () => {
      // Create a grammar with a Char rule using index
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('char', { Index: text('65') }) // ASCII 'A'
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with the character 'A'
      const input = 'A';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');
    });

    it('should parse a character by literal', () => {
      // Create a grammar with a Char rule using literal
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('char', { Literal: text('A') })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with the character 'A'
      const input = 'A';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');
    });
  });

  describe('String rule', () => {
    it('should parse a simple string', () => {
      // Create a grammar with a String rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('string', { Text: text('hello') })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with the string 'hello'
      const input = 'hello';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');
    });

    it('should capture string content', () => {
      // Create a grammar with a String rule that captures content
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('declaration', {
                Name: text('Content'),
                Expression: node('string', { Text: text('hello') })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with the string 'hello'
      const input = 'hello';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');
      const contentAttr = result.attributes['Content'] as Text;
      expect(contentAttr.type).to.equal('text');
      expect(contentAttr.value).to.equal('hello');
    });
  });

  describe('Quote rule', () => {
    it('should parse a quoted string', () => {
      // Create a grammar with a Quote rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('quote', { Text: text('hello world') })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with a quoted string
      const input = '"hello world"';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');
    });

    it('should handle escaped quotes in quoted strings', () => {
      // Create a grammar with a Quote rule that handles escaped quotes
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('declaration', {
                Name: text('Content'),
                Expression: node('quote', {})
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with a quoted string containing escaped quotes
      const input = '"hello ""world"""';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');
      const contentAttr = result.attributes['Content'] as Text;
      expect(contentAttr.type).to.equal('text');
      expect(contentAttr.value).to.equal('hello "world"');
    });
  });

  describe('CharSet rule', () => {
    it('should parse a character from a character set', () => {
      // Create a grammar with a CharSet rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('charSet', {
                Entries: list([
                  node('char', { Literal: text('A') }),
                  node('char', { Literal: text('B') }),
                  node('char', { Literal: text('C') })
                ])
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with a character from the set
      const input = 'B';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');

      // Test with a character not in the set
      const inputNotInSet = 'D';
      const resultNotInSet = parser.parse(new StringStream(inputNotInSet));

      expect(resultNotInSet).to.be.null;
    });

    it('should parse a character from a negated character set', () => {
      // Create a grammar with a negated CharSet rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('charSet', {
                Not: text('!'),
                Entries: list([
                  node('char', { Literal: text('A') }),
                  node('char', { Literal: text('B') }),
                  node('char', { Literal: text('C') })
                ])
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with a character not in the set (should match due to negation)
      const input = 'D';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');

      // Test with a character in the set (should not match due to negation)
      const inputInSet = 'B';
      const resultInSet = parser.parse(new StringStream(inputInSet));

      expect(resultInSet).to.be.null;
    });

    it('should parse a character from a character set with ranges', () => {
      // Create a grammar with a CharSet rule containing ranges
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('charSet', {
                Entries: list([
                  node('range', {
                    From: node('char', { Literal: text('A') }),
                    To: node('char', { Literal: text('Z') })
                  })
                ])
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with a character in the range
      const input = 'M';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');

      // Test with a character not in the range
      const inputNotInRange = 'a';
      const resultNotInRange = parser.parse(new StringStream(inputNotInRange));

      expect(resultNotInRange).to.be.null;
    });

    it('should parse a character from a wildcard character set', () => {
      // Create a grammar with a wildcard CharSet rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('charSet', {
                All: text('?')
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with any character
      const input = 'X';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');

      // Test with another character
      const input2 = '5';
      const result2 = parser.parse(new StringStream(input2)) as Node;

      expect(result2).to.not.be.null;
      expect(result2.type).to.equal('Test');
    });
  });

  describe('Range rule', () => {
    it('should parse a character in a range', () => {
      // Create a grammar with a Range rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('range', {
                From: node('char', { Literal: text('0') }),
                To: node('char', { Literal: text('9') })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with a character in the range
      const input = '5';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');

      // Test with a character not in the range
      const inputNotInRange = 'A';
      const resultNotInRange = parser.parse(new StringStream(inputNotInRange));

      expect(resultNotInRange).to.be.null;
    });

    it('should parse a character at the boundaries of a range', () => {
      // Create a grammar with a Range rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('range', {
                From: node('char', { Literal: text('A') }),
                To: node('char', { Literal: text('Z') })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with the lower boundary
      const inputLower = 'A';
      const resultLower = parser.parse(new StringStream(inputLower)) as Node;

      expect(resultLower).to.not.be.null;
      expect(resultLower.type).to.equal('Test');

      // Test with the upper boundary
      const inputUpper = 'Z';
      const resultUpper = parser.parse(new StringStream(inputUpper)) as Node;

      expect(resultUpper).to.not.be.null;
      expect(resultUpper.type).to.equal('Test');
    });
  });
});
