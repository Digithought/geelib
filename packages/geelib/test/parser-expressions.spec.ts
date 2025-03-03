import { expect } from 'aegir/chai';
import { Parser } from '../src/parser.js';
import { StringStream } from '../src/string-stream.js';
import { buildGrammar } from '../src/grammar-builder.js';
import { node, text, list } from '../src/ast/ast.js';
import { optimize } from '../src/optimize/optimizer.js';
import type { Node, Text, List } from '../src/ast/ast.js';

describe('Parser - Expression Tests', () => {
  describe('Or rule', () => {
    it('should parse alternatives in an Or expression', () => {
      // Create a grammar with an Or rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('or', {
                Expressions: list([
                  node('string', { Text: text('hello') }),
                  node('string', { Text: text('world') }),
                  node('string', { Text: text('test') })
                ])
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with the first alternative
      const input1 = 'hello';
      const result1 = parser.parse(new StringStream(input1)) as Node;
      expect(result1).to.not.be.null;
      expect(result1.type).to.equal('Test');

      // Test with the second alternative
      const input2 = 'world';
      const result2 = parser.parse(new StringStream(input2)) as Node;
      expect(result2).to.not.be.null;
      expect(result2.type).to.equal('Test');

      // Test with the third alternative
      const input3 = 'test';
      const result3 = parser.parse(new StringStream(input3)) as Node;
      expect(result3).to.not.be.null;
      expect(result3.type).to.equal('Test');

      // Test with a non-matching input
      const inputNonMatching = 'other';
      const resultNonMatching = parser.parse(new StringStream(inputNonMatching));
      expect(resultNonMatching).to.be.null;
    });
  });

  describe('Group rule', () => {
    it('should parse a sequence in a group', () => {
      // Create a grammar with a Group rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('group', {
                Sequence: list([
                  node('string', { Text: text('hello') }),
                  node('string', { Text: text('world') })
                ])
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with a matching sequence
      const input = 'helloworld';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');

      // Test with a non-matching sequence
      const inputNonMatching = 'hello';
      const resultNonMatching = parser.parse(new StringStream(inputNonMatching));

      expect(resultNonMatching).to.be.null;
    });
  });

  describe('OptionalGroup rule', () => {
    it('should parse an optional sequence', () => {
      // Create a grammar with an OptionalGroup rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('string', { Text: text('hello') }),
              node('optional', {
                Sequence: list([
                  node('string', { Text: text('world') })
                ])
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with the optional part present
      const inputWithOptional = 'helloworld';
      const resultWithOptional = parser.parse(new StringStream(inputWithOptional)) as Node;

      expect(resultWithOptional).to.not.be.null;
      expect(resultWithOptional.type).to.equal('Test');

      // Test without the optional part
      const inputWithoutOptional = 'hello';
      const resultWithoutOptional = parser.parse(new StringStream(inputWithoutOptional)) as Node;

      expect(resultWithoutOptional).to.not.be.null;
      expect(resultWithoutOptional.type).to.equal('Test');
    });
  });

  describe('Reference rule', () => {
    it('should parse a reference to another rule', () => {
      // Create a grammar with a Reference rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('reference', { Name: text('Word') })
            ])
          }),
          node('definition', {
            Name: text('Word'),
            Type: text('='),
            Sequence: list([
              node('string', { Text: text('hello') })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with a matching reference
      const input = 'hello';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');
    });
  });

  describe('Repeat rule', () => {
    it('should parse zero or more repetitions', () => {
      // Create a grammar with a Repeat rule (zero or more)
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('repeat', {
                Expression: node('string', { Text: text('a') })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with multiple repetitions
      const inputMultiple = 'aaaaa';
      const resultMultiple = parser.parse(new StringStream(inputMultiple)) as Node;

      expect(resultMultiple).to.not.be.null;
      expect(resultMultiple.type).to.equal('Test');

      // Test with a single repetition
      const inputSingle = 'a';
      const resultSingle = parser.parse(new StringStream(inputSingle)) as Node;

      expect(resultSingle).to.not.be.null;
      expect(resultSingle.type).to.equal('Test');

      // Test with zero repetitions
      const inputZero = '';
      const resultZero = parser.parse(new StringStream(inputZero)) as Node;

      expect(resultZero).to.not.be.null;
      expect(resultZero.type).to.equal('Test');
    });

    it('should parse a specific number of repetitions', () => {
      // Create a grammar with a Repeat rule (exact count)
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('repeat', {
                Expression: node('string', { Text: text('a') }),
                Count: text('3')
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with the exact number of repetitions
      const inputExact = 'aaa';
      const resultExact = parser.parse(new StringStream(inputExact)) as Node;

      expect(resultExact).to.not.be.null;
      expect(resultExact.type).to.equal('Test');

      // Test with too few repetitions
      const inputTooFew = 'aa';
      const resultTooFew = parser.parse(new StringStream(inputTooFew));

      expect(resultTooFew).to.be.null;

      // Test with too many repetitions
      const inputTooMany = 'aaaa';
      const resultTooMany = parser.parse(new StringStream(inputTooMany));

      // Should fail because it expects exactly 3 repetitions
      expect(resultTooMany).to.be.null;
    });

    it('should parse a range of repetitions', () => {
      // Create a grammar with a Repeat rule (range)
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('repeat', {
                Expression: node('string', { Text: text('a') }),
                From: text('2'),
                To: text('4')
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with the minimum number of repetitions
      const inputMin = 'aa';
      const resultMin = parser.parse(new StringStream(inputMin)) as Node;

      expect(resultMin).to.not.be.null;
      expect(resultMin.type).to.equal('Test');

      // Test with the maximum number of repetitions
      const inputMax = 'aaaa';
      const resultMax = parser.parse(new StringStream(inputMax)) as Node;

      expect(resultMax).to.not.be.null;
      expect(resultMax.type).to.equal('Test');

      // Test with a number in between
      const inputMid = 'aaa';
      const resultMid = parser.parse(new StringStream(inputMid)) as Node;

      expect(resultMid).to.not.be.null;
      expect(resultMid.type).to.equal('Test');

      // Test with too few repetitions
      const inputTooFew = 'a';
      const resultTooFew = parser.parse(new StringStream(inputTooFew));

      expect(resultTooFew).to.be.null;

      // Test with too many repetitions
      const inputTooMany = 'aaaaa';
      const resultTooMany = parser.parse(new StringStream(inputTooMany));

      // Should fail because it expects at most 4 repetitions
      expect(resultTooMany).to.be.null;
    });
  });

  describe('SeparatedRepeat rule', () => {
    it('should parse items separated by a separator', () => {
      // Create a grammar with a SeparatedRepeat rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('separated', {
                Expression: node('string', { Text: text('item') }),
                Separator: node('string', { Text: text(',') })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with multiple items
      const inputMultiple = 'item,item,item';
      const resultMultiple = parser.parse(new StringStream(inputMultiple)) as Node;

      expect(resultMultiple).to.not.be.null;
      expect(resultMultiple.type).to.equal('Test');

      // Test with a single item
      const inputSingle = 'item';
      const resultSingle = parser.parse(new StringStream(inputSingle)) as Node;

      expect(resultSingle).to.not.be.null;
      expect(resultSingle.type).to.equal('Test');

      // Test with zero items
      const inputZero = '';
      const resultZero = parser.parse(new StringStream(inputZero)) as Node;

      expect(resultZero).to.not.be.null;
      expect(resultZero.type).to.equal('Test');
    });
  });

  describe('Capture rule', () => {
    it('should capture the matched content', () => {
      // Create a grammar with a Capture rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('declaration', {
                Name: text('Content'),
                Expression: node('capture', {
                  Expression: node('string', { Text: text('hello') })
                })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with a matching input
      const input = 'hello';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');
      const contentAttr = result.attributes['Content'] as Text;
      expect(contentAttr.type).to.equal('text');
      expect(contentAttr.value).to.equal('hello');
    });
  });

  describe('AndNot rule', () => {
    it('should match if the first expression matches and the second does not', () => {
      // Create a grammar with an AndNot rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('andNot', {
                Expression: node('charSet', {
                  Entries: list([
                    node('range', {
                      From: node('char', { Literal: text('a') }),
                      To: node('char', { Literal: text('z') })
                    })
                  ])
                }),
                NotExpression: node('string', { Text: text('if') })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with a lowercase letter that is not 'if'
      const inputMatching = 'a';
      const resultMatching = parser.parse(new StringStream(inputMatching)) as Node;

      expect(resultMatching).to.not.be.null;
      expect(resultMatching.type).to.equal('Test');

      // Test with 'if' (should not match)
      const inputNonMatching = 'if';
      const resultNonMatching = parser.parse(new StringStream(inputNonMatching));

      expect(resultNonMatching).to.be.null;
    });
  });

  describe('As rule', () => {
    it('should replace the matched content with a specified value', () => {
      // Create a grammar with an As rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('declaration', {
                Name: text('Content'),
                Expression: node('as', {
                  Expression: node('string', { Text: text('hello') }),
                  Value: node('string', { Text: text('world') })
                })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with a matching input
      const input = 'hello';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');
      const contentAttr = result.attributes['Content'] as Text;
      expect(contentAttr.type).to.equal('text');
      expect(contentAttr.value).to.equal('world'); // Value should be replaced
    });
  });

  describe('Declaration rule', () => {
    it('should declare a named capture', () => {
      // Create a grammar with a Declaration rule
      const ast = node('unit', {
        Definitions: list([
          node('definition', {
            Name: text('Test'),
            Type: text(':='),
            Sequence: list([
              node('declaration', {
                Name: text('FirstName'),
                Expression: node('string', { Text: text('John') })
              }),
              node('declaration', {
                Name: text('LastName'),
                Expression: node('string', { Text: text('Doe') })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with a matching input
      const input = 'JohnDoe';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(result).to.not.be.null;
      expect(result.type).to.equal('Test');
      const firstNameAttr = result.attributes['FirstName'] as Text;
      expect(firstNameAttr.type).to.equal('text');
      expect(firstNameAttr.value).to.equal('John');
      const lastNameAttr = result.attributes['LastName'] as Text;
      expect(lastNameAttr.type).to.equal('text');
      expect(lastNameAttr.value).to.equal('Doe');
    });
  });
});
