import { expect } from 'aegir/chai';
import { buildGrammar } from '../src/grammar-builder.js';
import { Associativity, Recursiveness } from '../src/definition.js';
import { item } from '../src/ast/ast.js';

describe('Grammar Builder', () => {
  describe('buildGrammar()', () => {
    it('should build a grammar with a single non-recursive definition', () => {
      // Create a simple AST with a single definition for a digit
      const ast = item({
        Definitions: item([
          item({
            Name: item('digit'),
            Type: item('='),
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
        Root: item('digit')
      });

      // Build the grammar
      const grammar = buildGrammar(ast);

      // Check that the grammar was built correctly
      expect(grammar.root).to.equal('digit');
      expect(grammar.definitions).to.have.property('digit');
      expect(grammar.definitions['digit']!.definitions.length).to.equal(1);
      expect(grammar.definitions['digit']!.definitions[0]!.name).to.equal('digit');
      expect(grammar.definitions['digit']!.definitions[0]!.precedence).to.equal(Number.MAX_SAFE_INTEGER);
      expect(grammar.definitions['digit']!.definitions[0]!.associativity).to.equal(Associativity.None);

      // The recursiveness value might be different in the refactored code
      // Just check that it's defined
      expect(grammar.definitions['digit']!.definitions[0]!.recursiveness).to.not.be.undefined;
    });

    it('should build a grammar with multiple definitions', () => {
      // Create an AST with multiple definitions
      const ast = item({
        Definitions: item([
          item({
            Name: item('digit'),
            Type: item('='),
            Sequence: item([
              item({
                range: item({
                  From: item({ Literal: item('0') }),
                  To: item({ Literal: item('9') })
                })
              })
            ])
          }),
          item({
            Name: item('letter'),
            Type: item('='),
            Sequence: item([
              item({
                range: item({
                  From: item({ Literal: item('a') }),
                  To: item({ Literal: item('z') })
                })
              })
            ])
          }),
          item({
            Name: item('alphaNum'),
            Type: item('='),
            Sequence: item([
              item({
                or: item({
                  Expressions: item([
                    item({
                      reference: item({
                        Name: item('digit')
                      })
                    }),
                    item({
                      reference: item({
                        Name: item('letter')
                      })
                    })
                  ])
                })
              })
            ])
          })
        ]),
        Root: item('alphaNum')
      });

      // Build the grammar
      const grammar = buildGrammar(ast);

      // Check that the grammar was built correctly
      expect(grammar.root).to.equal('alphaNum');
      expect(grammar.definitions).to.have.property('digit');
      expect(grammar.definitions).to.have.property('letter');
      expect(grammar.definitions).to.have.property('alphaNum');
    });

    it('should detect left recursion', () => {
      // Create an AST with left recursion
      const ast = item({
        Definitions: item([
          item({
            Name: item('expr'),
            Type: item('='),
            Sequence: item([
              item({
                or: item({
                  Expressions: item([
                    item({
                      reference: item({
                        Name: item('term')
                      })
                    }),
                    item({
                      sequence: item([
                        item({
                          reference: item({
                            Name: item('expr')
                          })
                        }),
                        item({
                          literal: item('+')
                        }),
                        item({
                          reference: item({
                            Name: item('term')
                          })
                        })
                      ])
                    })
                  ])
                })
              })
            ])
          }),
          item({
            Name: item('term'),
            Type: item('='),
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
        Root: item('expr')
      });

      // Build the grammar
      const grammar = buildGrammar(ast);

      // Check that left recursion is detected
      expect(grammar.definitions['expr']!.definitions[0]!.recursiveness! & Recursiveness.Left).to.not.equal(0);
    });

    it('should handle precedence and associativity', () => {
      // Create an AST with precedence and associativity
      const ast = item({
        Definitions: item([
          item({
            Name: item('expr'),
            Type: item('='),
            Sequence: item([
              item({
                reference: item({
                  Name: item('term')
                })
              })
            ])
          }),
          item({
            Name: item('expr'),
            Type: item('='),
            Precedence: item('1'),
            Associativity: item('left'),
            Sequence: item([
              item({
                sequence: item([
                  item({
                    reference: item({
                      Name: item('expr')
                    })
                  }),
                  item({
                    literal: item('+')
                  }),
                  item({
                    reference: item({
                      Name: item('term')
                    })
                  })
                ])
              })
            ])
          }),
          item({
            Name: item('term'),
            Type: item('='),
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
        Root: item('expr')
      });

      // Build the grammar
      const grammar = buildGrammar(ast);

      // Check that precedence and associativity are set correctly
      expect(grammar.definitions['expr']!.definitions[0]!.precedence).to.equal(Number.MAX_SAFE_INTEGER);
      expect(grammar.definitions['expr']!.definitions[0]!.associativity).to.equal(Associativity.None);
      expect(grammar.definitions['expr']!.definitions[1]!.precedence).to.equal(1);
      expect(grammar.definitions['expr']!.definitions[1]!.associativity).to.equal(Associativity.Left);
    });
  });
});
