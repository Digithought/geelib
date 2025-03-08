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
                Or: item({
                  Expressions: item([
                    item({
                      String: item({
                        Text: item('hello')
                      })
                    }),
                    item({
                      String: item({
                        Text: item('world')
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
        const testNode = result1.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('hello');
        }
      }

      // Test with the second alternative
      const input2 = 'world';
      const stream2 = new StringStream(input2);
      const result2 = parser.parse(stream2);

      expect(result2).to.not.be.null;
      if (result2) {
        const testNode = result2.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('world');
        }
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
              item({ String: item({ Text: item('hello') }) }),
              item({ String: item({ Text: item('world') }) })
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
      if (result) {
        const testNode = result.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('helloworld');
        }
      }

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
              item({ String: item({ Text: item('hello') }) }),
              item({
                Optional: item({
                  Sequence: item([
                    item({ String: item({ Text: item('world') }) })
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
      if (resultWithOptional) {
        const testNode = resultWithOptional.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('helloworld');
        }
      }

      // Test without the optional part
      const inputWithoutOptional = 'hello';
      const resultWithoutOptional = parser.parse(new StringStream(inputWithoutOptional));
      expect(resultWithoutOptional).to.not.be.undefined;
      if (resultWithoutOptional) {
        const testNode = resultWithoutOptional.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('hello');
        }
      }
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
                Group: item({
                  Sequence: item([
                    item({ String: item({ Text: item('hello') }) }),
                    item({ String: item({ Text: item('world') }) })
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
      if (result) {
        const testNode = result.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('helloworld');
        }
      }
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
                Repeat: item({
                  Expression: item({ String: item({ Text: item('a') }) })
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
      if (resultMultiple) {
        const testNode = resultMultiple.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('aaa');
        }
      }

      // Test with a single repetition
      const inputSingle = 'a';
      const resultSingle = parser.parse(new StringStream(inputSingle));
      expect(resultSingle).to.not.be.undefined;
      if (resultSingle) {
        const testNode = resultSingle.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('a');
        }
      }

      // Test with zero repetitions
      const inputZero = '';
      const resultZero = parser.parse(new StringStream(inputZero));
      expect(resultZero).to.not.be.undefined;
      if (resultZero) {
        const testNode = resultZero.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('');
        }
      }
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
                Repeat: item({
                  Expression: item({ String: item({ Text: item('a') }) }),
                  Count: item('3')
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
      if (resultExact) {
        const testNode = resultExact.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('aaa');
        }
      }

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
                Repeat: item({
                  Expression: item({ String: item({ Text: item('a') }) }),
                  From: item('2'),
                  To: item('4')
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
      if (resultMin) {
        const testNode = resultMin.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('aa');
        }
      }

      // Test with the maximum number of repetitions
      const inputMax = 'aaaa';
      const resultMax = parser.parse(new StringStream(inputMax));
      expect(resultMax).to.not.be.undefined;
      if (resultMax) {
        const testNode = resultMax.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('aaaa');
        }
      }

      // Test with a number in between
      const inputMid = 'aaa';
      const resultMid = parser.parse(new StringStream(inputMid));
      expect(resultMid).to.not.be.undefined;
      if (resultMid) {
        const testNode = resultMid.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('aaa');
        }
      }

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
                Separated: item({
                  Expression: item({ String: item({ Text: item('item') }) }),
                  Separator: item({ String: item({ Text: item(',') }) })
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
      if (resultMultiple) {
        const testNode = resultMultiple.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('itemitemitem');
        }
      }

      // Test with a single item
      const inputSingle = 'item';
      const resultSingle = parser.parse(new StringStream(inputSingle));
      expect(resultSingle).to.not.be.undefined;
      if (resultSingle) {
        const testNode = resultSingle.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('item');
        }
      }

      // Test with zero items
      const inputZero = '';
      const resultZero = parser.parse(new StringStream(inputZero));
      expect(resultZero).to.not.be.undefined;
      if (resultZero) {
        const testNode = resultZero.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('');
        }
      }
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
                Declaration: item({
                  Name: item('Content'),
                  Expression: item({
                    Capture: item({
                      Expression: item({ String: item({ Text: item('hello') }) })
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
        expect(testNode).to.have.property('Test');
        expect(isNode(testNode['Test'])).to.be.true;
        if (isNode(testNode['Test'])) {
          const testValue = testNode['Test'].value;
          expect(testValue).to.have.property('Content');
          expect(isText(testValue['Content'])).to.be.true;
          if (isText(testValue['Content'])) {
            expect(testValue['Content'].value).to.equal('hello');
          }
        }
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
                AndNot: item({
                  Expression: item({ String: item({ Text: item('var') }) }),
                  Not: item({ String: item({ Text: item('if') }) })
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
      if (resultMatching) {
        const testNode = resultMatching.value as Record<string, Item>;
        expect(testNode).to.have.property('Test');
        expect(isText(testNode['Test'])).to.be.true;
        if (isText(testNode['Test'])) {
          expect(testNode['Test'].value).to.equal('var');
        }
      }

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
                Declaration: item({
                  Name: item('Content'),
                  Expression: item({
                    As: item({
                      Expression: item({ String: item({ Text: item('hello') }) }),
                      Value: item({ String: item({ Text: item('world') }) })
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
        expect(testNode).to.have.property('Test');
        expect(isNode(testNode['Test'])).to.be.true;
        if (isNode(testNode['Test'])) {
          const testValue = testNode['Test'].value;
          expect(testValue).to.have.property('Content');
          expect(isText(testValue['Content'])).to.be.true;
          if (isText(testValue['Content'])) {
            expect(testValue['Content'].value).to.equal('world'); // Value should be replaced
          }
        }
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
                Declaration: item({
                  Name: item('FirstName'),
                  Expression: item({ String: item({ Text: item('John') }) })
                })
              }),
              item({
                Declaration: item({
                  Name: item('LastName'),
                  Expression: item({ String: item({ Text: item('Doe') }) })
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
        expect(testNode).to.have.property('Test');
        expect(isNode(testNode['Test'])).to.be.true;
        if (isNode(testNode['Test'])) {
          const testValue = testNode['Test'].value;
          expect(testValue).to.have.property('FirstName');
          expect(isText(testValue['FirstName'])).to.be.true;
          if (isText(testValue['FirstName'])) {
            expect(testValue['FirstName'].value).to.equal('John');
          }
          expect(testValue).to.have.property('LastName');
          expect(isText(testValue['LastName'])).to.be.true;
          if (isText(testValue['LastName'])) {
            expect(testValue['LastName'].value).to.equal('Doe');
          }
        }
      }
    });
  });
});
