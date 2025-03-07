import { expect } from 'aegir/chai';
import { Parser } from '../src/parser.js';
import { StringStream } from '../src/string-stream.js';
import { buildGrammar } from '../src/grammar-builder.js';
import { item } from '../src/ast/ast.js';
import { optimize } from '../src/optimize/optimizer.js';
import type { Node, Text, List, Item } from '../src/ast/ast.js';
import { isNode, isText } from "../src/ast/ast.js";

describe('Parser - Expression Tests', () => {
  describe('Or expressions', () => {
    it('should parse alternatives in an or expression', () => {
      // Create a grammar with an or expression
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                or: item({
                  Expressions: item([
                    item({
                      string: item({
                        Value: item('hello')
                      })
                    }),
                    item({
                      string: item({
                        Value: item('world')
                      })
                    })
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

      // Test with the first alternative
      const input1 = 'hello';
      const stream1 = new StringStream(input1);
      const result1 = parser.parse(stream1);

      expect(result1).to.not.be.null;
      if (result1) {
        // Use type assertion to tell TypeScript that result1.value is a Record<string, Item>
        const testNode = (result1.value as Record<string, Item>)['Test']!;
        expect(testNode).to.exist;
        const contentItem = testNode.value as Record<string, Item>;
        expect(contentItem).to.have.property('Content');
        const content = contentItem['Content']!;
        expect(isText(content)).to.be.true;
        expect((content as Text).value).to.equal('hello');
      }

      // Test with the second alternative
      const input2 = 'world';
      const stream2 = new StringStream(input2);
      const result2 = parser.parse(stream2);

      expect(result2).to.not.be.null;
      if (result2) {
        // Use type assertion to tell TypeScript that result2.value is a Record<string, Item>
        const testNode = (result2.value as Record<string, Item>)['Test']!;
        expect(testNode).to.exist;
        const contentItem = testNode.value as Record<string, Item>;
        expect(contentItem).to.have.property('Content');
        const content = contentItem['Content']!;
        expect(isText(content)).to.be.true;
        expect((content as Text).value).to.equal('world');
      }
    });
  });

  describe('Sequence expressions', () => {
    it('should parse a sequence of expressions', () => {
      // Create a grammar with a sequence
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({ string: item({ Text: item('hello') }) }),
              item({ string: item({ Text: item('world') }) })
            ])
          })
        ]),
        Root: item('Test')
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with a matching sequence
      const input = 'helloworld';
      const result = parser.parse(new StringStream(input));
      expect(result).to.not.be.undefined;
      expect(result?.value).to.have.property('Test');

      // Test with a non-matching sequence
      const inputNonMatching = 'hello';
      const resultNonMatching = parser.parse(new StringStream(inputNonMatching));
      expect(resultNonMatching).to.be.undefined;
    });
  });

  describe('Optional expressions', () => {
    it('should parse optional expressions', () => {
      // Create a grammar with an optional expression
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({ string: item({ Text: item('hello') }) }),
              item({
                optional: item({
                  Sequence: item([
                    item({ string: item({ Text: item('world') }) })
                  ])
                })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with the optional part
      const inputWithOptional = 'helloworld';
      const resultWithOptional = parser.parse(new StringStream(inputWithOptional));
      expect(resultWithOptional).to.not.be.undefined;
      expect(resultWithOptional?.value).to.have.property('Test');

      // Test without the optional part
      const inputWithoutOptional = 'hello';
      const resultWithoutOptional = parser.parse(new StringStream(inputWithoutOptional));
      expect(resultWithoutOptional).to.not.be.undefined;
      expect(resultWithoutOptional?.value).to.have.property('Test');
    });
  });

  describe('Group expressions', () => {
    it('should parse group expressions', () => {
      // Create a grammar with a group expression
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                group: item({
                  Sequence: item([
                    item({ string: item({ Text: item('hello') }) }),
                    item({ string: item({ Text: item('world') }) })
                  ])
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
      const input = 'helloworld';
      const result = parser.parse(new StringStream(input));
      expect(result).to.not.be.undefined;
      expect(result?.value).to.have.property('Test');
    });
  });

  describe('Repeat expressions', () => {
    it('should parse zero or more repetitions', () => {
      // Create a grammar with a repeat expression
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                repeat: item({
                  Expression: item({ string: item({ Text: item('a') }) })
                })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with multiple repetitions
      const inputMultiple = 'aaa';
      const resultMultiple = parser.parse(new StringStream(inputMultiple));
      expect(resultMultiple).to.not.be.undefined;
      expect(resultMultiple?.value).to.have.property('Test');

      // Test with a single repetition
      const inputSingle = 'a';
      const resultSingle = parser.parse(new StringStream(inputSingle));
      expect(resultSingle).to.not.be.undefined;
      expect(resultSingle?.value).to.have.property('Test');

      // Test with zero repetitions
      const inputZero = '';
      const resultZero = parser.parse(new StringStream(inputZero));
      expect(resultZero).to.not.be.undefined;
      expect(resultZero?.value).to.have.property('Test');
    });

    it('should parse a specific number of repetitions', () => {
      // Create a grammar with a repeat expression with a count
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                repeat: item({
                  Expression: item({ string: item({ Text: item('a') }) }),
                  Count: item({
                    Value: item('3')
                  })
                })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with exactly 3 repetitions
      const inputExact = 'aaa';
      const resultExact = parser.parse(new StringStream(inputExact));
      expect(resultExact).to.not.be.undefined;
      expect(resultExact?.value).to.have.property('Test');

      // Test with too few repetitions
      const inputTooFew = 'aa';
      const resultTooFew = parser.parse(new StringStream(inputTooFew));
      expect(resultTooFew).to.be.undefined;

      // Test with too many repetitions
      const inputTooMany = 'aaaa';
      const resultTooMany = parser.parse(new StringStream(inputTooMany));
      expect(resultTooMany).to.be.undefined;
    });

    it('should parse a range of repetitions', () => {
      // Create a grammar with a repeat expression with a range
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                repeat: item({
                  Expression: item({ string: item({ Text: item('a') }) }),
                  Range: item({
                    From: item('2'),
                    To: item('4')
                  })
                })
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
      const resultMin = parser.parse(new StringStream(inputMin));
      expect(resultMin).to.not.be.undefined;
      expect(resultMin?.value).to.have.property('Test');

      // Test with the maximum number of repetitions
      const inputMax = 'aaaa';
      const resultMax = parser.parse(new StringStream(inputMax));
      expect(resultMax).to.not.be.undefined;
      expect(resultMax?.value).to.have.property('Test');

      // Test with a number in between
      const inputMid = 'aaa';
      const resultMid = parser.parse(new StringStream(inputMid));
      expect(resultMid).to.not.be.undefined;
      expect(resultMid?.value).to.have.property('Test');

      // Test with too few repetitions
      const inputTooFew = 'a';
      const resultTooFew = parser.parse(new StringStream(inputTooFew));
      expect(resultTooFew).to.be.undefined;

      // Test with too many repetitions
      const inputTooMany = 'aaaaa';
      const resultTooMany = parser.parse(new StringStream(inputTooMany));
      expect(resultTooMany).to.be.undefined;
    });
  });

  describe('Separated repeat expressions', () => {
    it('should parse items separated by a separator', () => {
      // Create a grammar with a separated repeat expression
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                separated: item({
                  Expression: item({ string: item({ Text: item('item') }) }),
                  Separator: item({ string: item({ Text: item(',') }) })
                })
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
      const resultMultiple = parser.parse(new StringStream(inputMultiple));
      expect(resultMultiple).to.not.be.undefined;
      expect(resultMultiple?.value).to.have.property('Test');

      // Test with a single item
      const inputSingle = 'item';
      const resultSingle = parser.parse(new StringStream(inputSingle));
      expect(resultSingle).to.not.be.undefined;
      expect(resultSingle?.value).to.have.property('Test');

      // Test with zero items
      const inputZero = '';
      const resultZero = parser.parse(new StringStream(inputZero));
      expect(resultZero).to.not.be.undefined;
      expect(resultZero?.value).to.have.property('Test');
    });
  });

  describe('Capture expressions', () => {
    it('should capture expressions', () => {
      // Create a grammar with a capture expression
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                declaration: item({
                  Name: item('Content'),
                  Expression: item({
                    capture: item({
                      Expression: item({ string: item({ Text: item('hello') }) })
                    })
                  })
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
      const result = parser.parse(new StringStream(input));
      expect(result).to.not.be.undefined;

      if (result) {
        const testNode = result.value as Record<string, Item>;
        const contentItem = testNode['Test']?.value as Record<string, Item>;
        expect(contentItem).to.have.property('Content');
        expect(isText(contentItem['Content']!)).to.be.true;
        expect(contentItem['Content']!.value).to.equal('hello');
      }
    });
  });

  describe('AndNot expressions', () => {
    it('should parse expressions that match the first but not the second', () => {
      // Create a grammar with an andNot expression
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                andNot: item({
                  Expression: item({ string: item({ Text: item('var') }) }),
                  NotExpression: item({ string: item({ Text: item('if') }) })
                })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test with 'var' (should match)
      const inputMatching = 'var';
      const resultMatching = parser.parse(new StringStream(inputMatching));
      expect(resultMatching).to.not.be.undefined;
      expect(resultMatching?.value).to.have.property('Test');

      // Test with 'if' (should not match)
      const inputNonMatching = 'if';
      const resultNonMatching = parser.parse(new StringStream(inputNonMatching));
      expect(resultNonMatching).to.be.undefined;
    });
  });

  describe('As expressions', () => {
    it('should replace the matched text with a specified value', () => {
      // Create a grammar with an as expression
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                declaration: item({
                  Name: item('Content'),
                  Expression: item({
                    as: item({
                      Expression: item({ string: item({ Text: item('hello') }) }),
                      Value: item({
                        String: item({
                          Value: item('world')
                        })
                      })
                    })
                  })
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
      const result = parser.parse(new StringStream(input));
      expect(result).to.not.be.undefined;

      if (result) {
        const testNode = result.value as Record<string, Item>;
        const contentItem = testNode['Test']?.value as Record<string, Item>;
        expect(contentItem).to.have.property('Content');
        expect(isText(contentItem['Content']!)).to.be.true;
        expect(contentItem['Content']!.value).to.equal('world'); // Value should be replaced
      }
    });
  });

  describe('Declaration expressions', () => {
    it('should declare named values', () => {
      // Create a grammar with declaration expressions
      const ast = item({
        Definitions: item([
          item({
            Name: item('Test'),
            Type: item(':='),
            Sequence: item([
              item({
                declaration: item({
                  Name: item('FirstName'),
                  Expression: item({ string: item({ Text: item('John') }) })
                })
              }),
              item({
                declaration: item({
                  Name: item('LastName'),
                  Expression: item({ string: item({ Text: item('Doe') }) })
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
      const input = 'JohnDoe';
      const result = parser.parse(new StringStream(input));
      expect(result).to.not.be.undefined;

      if (result) {
        const testNode = result.value as Record<string, Item>;
        const testItem = testNode['Test']?.value as Record<string, Item>;
        expect(testItem).to.have.property('FirstName');
        expect(isText(testItem['FirstName']!)).to.be.true;
        expect(testItem['FirstName']!.value).to.equal('John');
        expect(testItem).to.have.property('LastName');
        expect(isText(testItem['LastName']!)).to.be.true;
        expect(testItem['LastName']!.value).to.equal('Doe');
      }
    });
  });
});
