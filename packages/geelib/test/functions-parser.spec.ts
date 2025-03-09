import { expect } from 'aegir/chai';
import { parseGrammarText, parseGrammar, parseText, parseStream, matchesText, matchesStream } from '../src/functions.js';
import { StringStream } from '../src/string-stream.js';
import { OptimizedGrammar } from '../src/optimize/optimizer.js';
import { buildGrammar } from '../src/grammar-builder.js';
import { item } from '../src/ast/ast.js';
import { optimize } from '../src/optimize/optimizer.js';
import { isNode, isText, isList } from '../src/ast/ast.js';
import type { Item, Node, Text } from '../src/ast/ast.js';

describe('Parser Functions', () => {
  // Create a simple grammar programmatically
  let simpleGrammar: OptimizedGrammar;

  // Create a more complex grammar with whitespace handling
  let complexGrammar: OptimizedGrammar;

  before(() => {
    // Build a simple grammar that matches digits
    const simpleAst = item({
      Definitions: item([
        item({
          Name: item('Start'),
          Type: item(':='),
          Sequence: item([
            item({
              Repeat: item({
                Expression: item({ Reference: item({ Name: item('Digit') }) })
              })
            })
          ])
        }),
        item({
          Name: item('Digit'),
          Type: item(':='),
          Sequence: item([
            item({
              CharSet: item({
                Entries: item([
                  item({ Range: item({
                    From: item({ Literal: item('0') }),
                    To: item({ Literal: item('9') })
                  }) })
                ])
              })
            })
          ])
        })
      ]),
      Root: item('Start')
    });

    const simpleGrammarRaw = buildGrammar(simpleAst);
    simpleGrammar = optimize(simpleGrammarRaw);

    // Build a more complex grammar with whitespace handling and nested structures
    const complexAst = item({
      Definitions: item([
        item({
          Name: item('Expression'),
          Type: item(':='),
          Sequence: item([
            item({ Reference: item({ Name: item('Term') }) }),
            item({
              Repeat: item({
                Expression: item({
                  Sequence: item([
                    item({
                      CharSet: item({
                        Entries: item([
                          item({ Char: item({ Literal: item('+') }) }),
                          item({ Char: item({ Literal: item('-') }) })
                        ])
                      })
                    }),
                    item({ Reference: item({ Name: item('Term') }) })
                  ])
                })
              })
            })
          ])
        }),
        item({
          Name: item('Term'),
          Type: item(':='),
          Sequence: item([
            item({ Reference: item({ Name: item('Factor') }) }),
            item({
              Repeat: item({
                Expression: item({
                  Sequence: item([
                    item({
                      CharSet: item({
                        Entries: item([
                          item({ Char: item({ Literal: item('*') }) }),
                          item({ Char: item({ Literal: item('/') }) })
                        ])
                      })
                    }),
                    item({ Reference: item({ Name: item('Factor') }) })
                  ])
                })
              })
            })
          ])
        }),
        item({
          Name: item('Factor'),
          Type: item(':='),
          Sequence: item([
            item({
              Or: item({
                Expressions: item([
                  item({ Reference: item({ Name: item('Number') }) }),
                  item({
                    Sequence: item([
                      item({ Char: item({ Literal: item('(') }) }),
                      item({ Reference: item({ Name: item('Expression') }) }),
                      item({ Char: item({ Literal: item(')') }) })
                    ])
                  })
                ])
              })
            })
          ])
        }),
        item({
          Name: item('Number'),
          Type: item(':='),
          Sequence: item([
            item({
              Repeat: item({
                Expression: item({ Reference: item({ Name: item('Digit') }) }),
                Count: item('1')
              })
            })
          ])
        }),
        item({
          Name: item('Digit'),
          Type: item(':='),
          Sequence: item([
            item({
              CharSet: item({
                Entries: item([
                  item({ Range: item({
                    From: item({ Literal: item('0') }),
                    To: item({ Literal: item('9') })
                  }) })
                ])
              })
            })
          ])
        }),
        item({
          Name: item('_'),
          Type: item(':='),
          Sequence: item([
            item({
              Repeat: item({
                Expression: item({
                  CharSet: item({
                    Entries: item([
                      item({ Char: item({ Literal: item(' ') }) }),
                      item({ Char: item({ Literal: item('\t') }) }),
                      item({ Char: item({ Literal: item('\n') }) }),
                      item({ Char: item({ Literal: item('\r') }) })
                    ])
                  })
                })
              })
            })
          ])
        })
      ]),
      Root: item('Expression'),
      Whitespace: item('_')
    });

    const complexGrammarRaw = buildGrammar(complexAst);
    complexGrammar = optimize(complexGrammarRaw);
  });

  describe('parseText', () => {
    it('should parse text using a simple grammar', () => {
      const result = parseText(simpleGrammar, '123');
      expect(result).to.not.be.null;
      if (result && isNode(result)) {
        const start = result.value['Start'];
        expect(start).to.exist;
        expect(isText(start)).to.be.true;
        if (isText(start)) {
          expect(start.value).to.equal('123');
        }
      }
    });

    it('should return null for non-matching text', () => {
      const result = parseText(simpleGrammar, 'abc');
      expect(result).to.be.null;
    });

    it('should parse complex expressions with nested structures', () => {
      const result = parseText(complexGrammar, '1+2*3');
      expect(result).to.not.be.null;
      if (result) {
        expect(isNode(result)).to.be.true;
      }
    });

    it('should handle whitespace in complex expressions', () => {
      const result = parseText(complexGrammar, '1 + 2 * 3');
      expect(result).to.not.be.null;
      if (result) {
        expect(isNode(result)).to.be.true;
      }
    });

    it('should handle parentheses in complex expressions', () => {
      const result = parseText(complexGrammar, '(1+2)*3');
      expect(result).to.not.be.null;
      if (result) {
        expect(isNode(result)).to.be.true;
      }
    });

    it('should handle empty input', () => {
      const result = parseText(simpleGrammar, '');
      // Empty input should match if the grammar allows it (e.g., if it accepts zero repetitions)
      expect(result).to.not.be.null;
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

    it('should parse complex expressions from a stream', () => {
      const stream = new StringStream('1+2*3');
      const result = parseStream(complexGrammar, stream);
      expect(result).to.not.be.null;
    });

    it('should handle whitespace in streams', () => {
      const stream = new StringStream('1 + 2 * 3');
      const result = parseStream(complexGrammar, stream);
      expect(result).to.not.be.null;
    });

    it('should handle empty streams', () => {
      const stream = new StringStream('');
      const result = parseStream(simpleGrammar, stream);
      // Empty input should match if the grammar allows it
      expect(result).to.not.be.null;
    });
  });

  describe('matchesText', () => {
    it('should return true for matching text', () => {
      expect(matchesText(simpleGrammar, '123')).to.be.true;
    });

    it('should return false for non-matching text', () => {
      expect(matchesText(simpleGrammar, 'abc')).to.be.false;
    });

    it('should match complex expressions', () => {
      expect(matchesText(complexGrammar, '1+2*3')).to.be.true;
    });

    it('should handle whitespace in matching', () => {
      expect(matchesText(complexGrammar, '1 + 2 * 3')).to.be.true;
    });

    it('should handle parentheses in matching', () => {
      expect(matchesText(complexGrammar, '(1+2)*3')).to.be.true;
    });

    it('should handle empty input', () => {
      // Empty input should match if the grammar allows it
      expect(matchesText(simpleGrammar, '')).to.be.true;
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

    it('should match complex expressions from a stream', () => {
      const stream = new StringStream('1+2*3');
      expect(matchesStream(complexGrammar, stream)).to.be.true;
    });

    it('should handle whitespace in stream matching', () => {
      const stream = new StringStream('1 + 2 * 3');
      expect(matchesStream(complexGrammar, stream)).to.be.true;
    });

    it('should handle empty streams', () => {
      const stream = new StringStream('');
      // Empty input should match if the grammar allows it
      expect(matchesStream(simpleGrammar, stream)).to.be.true;
    });
  });

  describe('Error handling', () => {
    it('should handle null grammar gracefully', () => {
      // @ts-ignore - Testing invalid input
      expect(() => parseText(null, '123')).to.throw();
    });

    it('should handle undefined grammar gracefully', () => {
      // @ts-ignore - Testing invalid input
      expect(() => parseText(undefined, '123')).to.throw();
    });

    it('should handle null text gracefully', () => {
      // @ts-ignore - Testing invalid input
      expect(() => parseText(simpleGrammar, null)).to.throw();
    });

    it('should handle undefined text gracefully', () => {
      // @ts-ignore - Testing invalid input
      expect(() => parseText(simpleGrammar, undefined)).to.throw();
    });

    it('should handle null stream gracefully', () => {
      // @ts-ignore - Testing invalid input
      expect(() => parseStream(simpleGrammar, null)).to.throw();
    });

    it('should handle undefined stream gracefully', () => {
      // @ts-ignore - Testing invalid input
      expect(() => parseStream(simpleGrammar, undefined)).to.throw();
    });
  });
});
