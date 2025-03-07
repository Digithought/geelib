import { expect } from 'aegir/chai';
import { Parser } from '../src/parser.js';
import { StringStream } from '../src/string-stream.js';
import { buildGrammar } from '../src/grammar-builder.js';
import { item } from '../src/ast/ast.js';
import { optimize } from '../src/optimize/optimizer.js';
import type { Item, Node, Text } from '../src/ast/ast.js';
import { isText } from "../src/ast/ast.js";

describe('Parser - Terminal Tests', () => {
  describe('Character terminals', () => {
    it('should parse a character by index', () => {
      // Create a simple grammar
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({ Index: item('65') }) // ASCII 'A'
            ])
          })
        ]),
        Root: item('Test')
      });

      const grammar = buildGrammar(ast);
      const optimized = optimize(grammar);
      const parser = new Parser(optimized);

      const input = 'A';
      const stream = new StringStream(input);
      const result = parser.parse(stream);

      expect(result).to.not.be.null;
      if (result) {
        // Use type assertion to tell TypeScript that result.value is a Record<string, Item>
        const testNode = (result.value as Record<string, Item>)['Test'];
        expect(testNode).to.exist;
        if (testNode) {
          expect((testNode.value as string)).to.equal('A');
        }
      }
    });

    it('should parse a character literal', () => {
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({ Literal: item('B') })
            ])
          })
        ]),
        Root: item('Test')
      });

      const grammar = buildGrammar(ast);
      const optimized = optimize(grammar);
      const parser = new Parser(optimized);

      const input = 'B';
      const stream = new StringStream(input);
      const result = parser.parse(stream);

      expect(result).to.not.be.null;
      if (result) {
        // Use type assertion to tell TypeScript that result.value is a Record<string, Item>
        const testNode = (result.value as Record<string, Item>)['Test'];
        expect(testNode).to.exist;
        if (testNode) {
          expect((testNode.value as string)).to.equal('B');
        }
      }
    });

    it('should parse a string literal', () => {
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                string: item({
                  Value: item('hello')
                })
              })
            ])
          })
        ]),
        Root: item('Test')
      });

      const grammar = buildGrammar(ast);
      const optimized = optimize(grammar);
      const parser = new Parser(optimized);

      const input = 'hello';
      const stream = new StringStream(input);
      const result = parser.parse(stream);

      expect(result).to.not.be.null;
      if (result) {
        // Use type assertion to tell TypeScript that result.value is a Record<string, Item>
        const testNode = (result.value as Record<string, Item>)['Test'];
        expect(testNode).to.exist;
        if (testNode && isText(testNode)) {
          expect(testNode.value).to.equal('hello');
        } else if (testNode) {
          const contentNode = (testNode.value as Record<string, Item>)['Content'];
          expect(contentNode).to.exist;
          if (contentNode) {
            expect((contentNode as Text).value).to.equal('hello');
          }
        }
      }
    });

    it('should parse a quoted string', () => {
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                quoted: item({
                  Value: item('hello')
                })
              })
            ])
          })
        ]),
        Root: item('Test')
      });

      const grammar = buildGrammar(ast);
      const optimized = optimize(grammar);
      const parser = new Parser(optimized);

      const input = '"hello"';
      const stream = new StringStream(input);
      const result = parser.parse(stream);

      expect(result).to.not.be.null;
      if (result) {
        // Use type assertion
        const nodeValue = result.value as Record<string, Item>;
        expect(nodeValue).to.have.property('Test');
        const testNode = nodeValue['Test']!;
        const contentAttr = (testNode.value as Record<string, Item>)['Content'] as Text;
        expect(contentAttr.value).to.equal('hello');
      }
    });

    it('should handle escaped quotes in quoted strings', () => {
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                quoted: item({
                  Value: item('hello "world"')
                })
              })
            ])
          })
        ]),
        Root: item('Test')
      });

      const grammar = buildGrammar(ast);
      const optimized = optimize(grammar);
      const parser = new Parser(optimized);

      const input = '"hello \\"world\\""';
      const stream = new StringStream(input);
      const result = parser.parse(stream);

      expect(result).to.not.be.null;
      if (result) {
        // Use type assertion
        const nodeValue = result.value as Record<string, Item>;
        expect(nodeValue).to.have.property('Test');
        const testNode = nodeValue['Test']!;
        const contentAttr = (testNode.value as Record<string, Item>)['Content'] as Text;
        expect(contentAttr.value).to.equal('hello "world"');
      }
    });
  });

  describe('Character set terminals', () => {
    it('should parse a character from a set', () => {
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                charSet: item({
                  Entries: item([
                    item({ Literal: item('A') }),
                    item({ Literal: item('B') }),
                    item({ Literal: item('C') })
                  ])
                })
              })
            ])
          })
        ]),
        Root: item('Test')
      });

      const grammar = buildGrammar(ast);
      const optimized = optimize(grammar);
      const parser = new Parser(optimized);

      const input = 'B';
      const stream = new StringStream(input);
      const result = parser.parse(stream);

      expect(result).to.not.be.null;
      if (result) {
        // Use type assertion
        const nodeValue = result.value as Record<string, Item>;
        expect(nodeValue).to.have.property('Test');
        const testNode = nodeValue['Test']!;
        expect((testNode.value as string)).to.equal('B');
      }

      // Test with a character not in the set
      const inputNotInSet = 'D';
      const streamNotInSet = new StringStream(inputNotInSet);
      const resultNotInSet = parser.parse(streamNotInSet);

      expect(resultNotInSet).to.be.null;
    });

    it('should parse a character not in a negated set', () => {
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                charSet: item({
                  Not: item('true'),
                  Entries: item([
                    item({ Literal: item('A') }),
                    item({ Literal: item('B') }),
                    item({ Literal: item('C') })
                  ])
                })
              })
            ])
          })
        ]),
        Root: item('Test')
      });

      const grammar = buildGrammar(ast);
      const optimized = optimize(grammar);
      const parser = new Parser(optimized);

      const input = 'D';
      const stream = new StringStream(input);
      const result = parser.parse(stream);

      expect(result).to.not.be.null;
      if (result) {
        // Use type assertion
        const nodeValue = result.value as Record<string, Item>;
        expect(nodeValue).to.have.property('Test');
        const testNode = nodeValue['Test']!;
        expect((testNode.value as string)).to.equal('D');
      }

      // Test with a character in the set (should not match due to negation)
      const inputInSet = 'B';
      const streamInSet = new StringStream(inputInSet);
      const resultInSet = parser.parse(streamInSet);

      expect(resultInSet).to.be.null;
    });

    it('should parse a character in a range', () => {
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                range: item({
                  From: item({ Literal: item('0') }),
                  To: item({ Literal: item('9') })
                })
              })
            ])
          })
        ]),
        Root: item('Test')
      });

      const grammar = buildGrammar(ast);
      const optimized = optimize(grammar);
      const parser = new Parser(optimized);

      const input = '5';
      const stream = new StringStream(input);
      const result = parser.parse(stream);

      expect(result).to.not.be.null;
      if (result) {
        // Use type assertion
        const nodeValue = result.value as Record<string, Item>;
        expect(nodeValue).to.have.property('Test');
        const testNode = nodeValue['Test']!;
        expect((testNode.value as string)).to.equal('5');
      }

      // Test with a character not in the range
      const inputNotInRange = 'a';
      const streamNotInRange = new StringStream(inputNotInRange);
      const resultNotInRange = parser.parse(streamNotInRange);

      expect(resultNotInRange).to.be.null;
    });

    it('should parse any character', () => {
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({ Any: item('true') })
            ])
          })
        ]),
        Root: item('Test')
      });

      const grammar = buildGrammar(ast);
      const optimized = optimize(grammar);
      const parser = new Parser(optimized);

      const input = 'X';
      const stream = new StringStream(input);
      const result = parser.parse(stream);

      expect(result).to.not.be.null;
      if (result) {
        // Use type assertion
        const nodeValue = result.value as Record<string, Item>;
        expect(nodeValue).to.have.property('Test');
        const testNode = nodeValue['Test']!;
        expect((testNode.value as string)).to.equal('X');
      }

      // Test with another character
      const input2 = '5';
      const stream2 = new StringStream(input2);
      const result2 = parser.parse(stream2);

      expect(result2).to.not.be.null;
      if (result2) {
        // Use type assertion
        const nodeValue = result2.value as Record<string, Item>;
        expect(nodeValue).to.have.property('Test');
        const testNode = nodeValue['Test']!;
        expect((testNode.value as string)).to.equal('5');
      }
    });
  });

  describe('Character class terminals', () => {
    it('should parse a digit character', () => {
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({ Digit: item('true') })
            ])
          })
        ]),
        Root: item('Test')
      });

      const grammar = buildGrammar(ast);
      const optimized = optimize(grammar);
      const parser = new Parser(optimized);

      const input = '5';
      const stream = new StringStream(input);
      const result = parser.parse(stream);

      expect(result).to.not.be.null;
      if (result) {
        // Use type assertion
        const nodeValue = result.value as Record<string, Item>;
        expect(nodeValue).to.have.property('Test');
        const testNode = nodeValue['Test']!;
        expect((testNode.value as string)).to.equal('5');
      }

      // Test with a character not in the range
      const inputNotInRange = 'A';
      const streamNotInRange = new StringStream(inputNotInRange);
      const resultNotInRange = parser.parse(streamNotInRange);

      expect(resultNotInRange).to.be.null;
    });

    it('should parse an alpha character', () => {
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({ Alpha: item('true') })
            ])
          })
        ]),
        Root: item('Test')
      });

      const grammar = buildGrammar(ast);
      const optimized = optimize(grammar);
      const parser = new Parser(optimized);

      const inputLower = 'a';
      const streamLower = new StringStream(inputLower);
      const resultLower = parser.parse(streamLower);

      expect(resultLower).to.not.be.null;
      if (resultLower) {
        // Use type assertion
        const nodeValue = resultLower.value as Record<string, Item>;
        expect(nodeValue).to.have.property('Test');
        const testNode = nodeValue['Test']!;
        expect((testNode.value as string)).to.equal('a');
      }

      // Test with the upper boundary
      const inputUpper = 'Z';
      const streamUpper = new StringStream(inputUpper);
      const resultUpper = parser.parse(streamUpper);

      expect(resultUpper).to.not.be.null;
      if (resultUpper) {
        // Use type assertion
        const nodeValue = resultUpper.value as Record<string, Item>;
        expect(nodeValue).to.have.property('Test');
        const testNode = nodeValue['Test']!;
        expect((testNode.value as string)).to.equal('Z');
      }
    });
  });
});
