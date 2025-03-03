import { expect } from 'aegir/chai';
import { buildGrammar } from '../src/grammar-builder.js';
import { Associativity, Recursiveness } from '../src/definition.js';
import { node, text, list } from '../src/ast/ast.js';
import type { Node, Text, List } from '../src/ast/ast.js';

describe('Grammar Builder', () => {
  describe('buildGrammar()', () => {
    it('should build a grammar with a single non-recursive definition', () => {
      // Create a simple AST with a single definition for a digit
      const ast = node('unit', {
        'Definitions': list([
          node('definition', {
            'Name': text('digit'),
            'Sequence': list([
              node('range', {
                'From': node('char', { 'Char': text('0') }),
                'To': node('char', { 'Char': text('9') })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);

      // Verify the grammar structure
      expect(grammar.root).to.equal('digit');
      expect(Object.keys(grammar.definitions)).to.have.lengthOf(1);
      expect(grammar.definitions['digit']).to.exist;
      expect(grammar.definitions['digit']!.definitions).to.have.lengthOf(1);

      // Verify the definition properties
      const definition = grammar.definitions['digit']!.definitions[0]!;
      expect(definition.name).to.equal('digit');
      expect(definition.precedence).to.equal(Number.MAX_SAFE_INTEGER);
      expect(definition.recursiveness).to.equal(Recursiveness.Non | Recursiveness.IsExclusive);
      expect(definition.isLeftRecursive()).to.be.false;
    });

    it('should build a grammar with multiple definitions', () => {
      // Create an AST with multiple definitions
      const ast = node('unit', {
        'Definitions': list([
          node('definition', {
            'Name': text('digit'),
            'Sequence': list([
              node('range', {
                'From': node('char', { 'Char': text('0') }),
                'To': node('char', { 'Char': text('9') })
              })
            ])
          }),
          node('definition', {
            'Name': text('letter'),
            'Sequence': list([
              node('or', {
                'Expressions': list([
                  node('range', {
                    'From': node('char', { 'Char': text('a') }),
                    'To': node('char', { 'Char': text('z') })
                  }),
                  node('range', {
                    'From': node('char', { 'Char': text('A') }),
                    'To': node('char', { 'Char': text('Z') })
                  })
                ])
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);

      // Verify the grammar structure
      expect(grammar.root).to.equal('digit');
      expect(Object.keys(grammar.definitions)).to.have.lengthOf(2);
      expect(grammar.definitions['digit']).to.exist;
      expect(grammar.definitions['letter']).to.exist;

      // Verify the definitions
      expect(grammar.definitions['digit']!.definitions).to.have.lengthOf(1);
      expect(grammar.definitions['letter']!.definitions).to.have.lengthOf(1);

      // Verify the definition properties
      const digitDef = grammar.definitions['digit']!.definitions[0]!;
      expect(digitDef.name).to.equal('digit');
      expect(digitDef.recursiveness).to.equal(Recursiveness.Non | Recursiveness.IsExclusive);

      const letterDef = grammar.definitions['letter']!.definitions[0]!;
      expect(letterDef.name).to.equal('letter');
      expect(letterDef.recursiveness).to.equal(Recursiveness.Non | Recursiveness.IsExclusive);
    });

    it('should handle left-recursive definitions with precedence', () => {
      // Create an AST with a left-recursive definition (expr = expr "+" term)
      const ast = node('unit', {
        'Definitions': list([
          node('definition', {
            'Name': text('expr'),
            'Precedence': text('1'),
            'Sequence': list([
              node('reference', { 'Name': text('expr') }),
              node('string', { 'Value': text('+') }),
              node('reference', { 'Name': text('term') })
            ])
          }),
          node('definition', {
            'Name': text('term'),
            'Sequence': list([
              node('reference', { 'Name': text('digit') })
            ])
          }),
          node('definition', {
            'Name': text('digit'),
            'Sequence': list([
              node('range', {
                'From': node('char', { 'Char': text('0') }),
                'To': node('char', { 'Char': text('9') })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);

      // Verify the grammar structure
      expect(Object.keys(grammar.definitions)).to.have.lengthOf(3);

      // Verify the left-recursive definition
      const exprGroup = grammar.definitions['expr']!;
      expect(exprGroup).to.exist;
      expect(exprGroup.definitions).to.have.lengthOf(1);

      const exprDef = exprGroup.definitions[0]!;
      expect(exprDef.name).to.equal('expr');
      expect(exprDef.precedence).to.equal(1);
      expect(exprDef.recursiveness! & Recursiveness.Left).to.not.equal(0);
      expect(exprDef.isLeftRecursive()).to.be.true;

      // Verify the group recursiveness
      expect(exprGroup.recursiveness! & Recursiveness.Left).to.not.equal(0);
      expect(exprGroup.isLeftRecursive()).to.be.true;
    });

    it('should handle right-recursive definitions with precedence and associativity', () => {
      // Create an AST with a right-recursive definition (expr = term "^" expr)
      const ast = node('unit', {
        'Definitions': list([
          node('definition', {
            'Name': text('expr'),
            'Precedence': text('2'),
            'Associativity': text('R'),
            'Sequence': list([
              node('reference', { 'Name': text('term') }),
              node('string', { 'Value': text('^') }),
              node('reference', { 'Name': text('expr') })
            ])
          }),
          node('definition', {
            'Name': text('term'),
            'Sequence': list([
              node('reference', { 'Name': text('digit') })
            ])
          }),
          node('definition', {
            'Name': text('digit'),
            'Sequence': list([
              node('range', {
                'From': node('char', { 'Char': text('0') }),
                'To': node('char', { 'Char': text('9') })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);

      // Verify the grammar structure
      expect(Object.keys(grammar.definitions)).to.have.lengthOf(3);

      // Verify the right-recursive definition
      const exprGroup = grammar.definitions['expr']!;
      expect(exprGroup).to.exist;
      expect(exprGroup.definitions).to.have.lengthOf(1);

      const exprDef = exprGroup.definitions[0]!;
      expect(exprDef.name).to.equal('expr');
      expect(exprDef.precedence).to.equal(2);
      expect(exprDef.associativity).to.equal(Associativity.Right);
      expect(exprDef.recursiveness! & Recursiveness.Right).to.not.equal(0);

      // Verify the group recursiveness
      expect(exprGroup.recursiveness! & Recursiveness.Right).to.not.equal(0);
    });

    it('should handle full-recursive definitions with precedence', () => {
      // Create an AST with a full-recursive definition (expr = expr "+" expr)
      const ast = node('unit', {
        'Definitions': list([
          node('definition', {
            'Name': text('expr'),
            'Precedence': text('1'),
            'Sequence': list([
              node('reference', { 'Name': text('expr') }),
              node('string', { 'Value': text('+') }),
              node('reference', { 'Name': text('expr') })
            ])
          }),
          // Add a non-recursive definition to make the grammar valid
          node('definition', {
            'Name': text('expr'),
            'Sequence': list([
              node('reference', { 'Name': text('digit') })
            ])
          }),
          node('definition', {
            'Name': text('digit'),
            'Sequence': list([
              node('range', {
                'From': node('char', { 'Char': text('0') }),
                'To': node('char', { 'Char': text('9') })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);

      // Verify the grammar structure
      expect(Object.keys(grammar.definitions)).to.have.lengthOf(2);

      // Verify the full-recursive definition
      const exprGroup = grammar.definitions['expr']!;
      expect(exprGroup).to.exist;
      expect(exprGroup.definitions).to.have.lengthOf(2);

      // Find the recursive definition (the one with precedence 1)
      const recursiveDef = exprGroup.definitions.find(d => d.precedence === 1)!;
      expect(recursiveDef).to.exist;
      expect(recursiveDef.name).to.equal('expr');

      // Check if it has left and right recursion (which should result in full recursion)
      const hasLeftRecursion = (recursiveDef.recursiveness! & Recursiveness.Left) !== 0;
      const hasRightRecursion = (recursiveDef.recursiveness! & Recursiveness.Right) !== 0;
      const hasFullRecursion = (recursiveDef.recursiveness! & Recursiveness.Full) !== 0;

      // Either it should have full recursion directly, or both left and right recursion
      expect(hasFullRecursion || (hasLeftRecursion && hasRightRecursion)).to.be.true;

      // Verify the group recursiveness has some form of recursion
      expect(exprGroup.recursiveness! & (Recursiveness.Left | Recursiveness.Right | Recursiveness.Full)).to.not.equal(0);
    });

    it('should handle optional expressions', () => {
      // Create an AST with an optional expression
      const ast = node('unit', {
        'Definitions': list([
          node('definition', {
            'Name': text('number'),
            'Sequence': list([
              node('reference', { 'Name': text('digit') }),
              node('optional', {
                'Sequence': list([
                  node('string', { 'Value': text('.') }),
                  node('reference', { 'Name': text('digit') })
                ])
              })
            ])
          }),
          node('definition', {
            'Name': text('digit'),
            'Sequence': list([
              node('range', {
                'From': node('char', { 'Char': text('0') }),
                'To': node('char', { 'Char': text('9') })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);

      // Verify the grammar structure
      expect(Object.keys(grammar.definitions)).to.have.lengthOf(2);

      // Verify the definition with optional part
      const numberGroup = grammar.definitions['number']!;
      expect(numberGroup).to.exist;
      expect(numberGroup.definitions).to.have.lengthOf(1);

      const numberDef = numberGroup.definitions[0]!;
      expect(numberDef.name).to.equal('number');
      expect(numberDef.recursiveness).to.equal(Recursiveness.Non | Recursiveness.IsExclusive);
    });

    it('should handle whitespace rule', () => {
      // Create an AST with a whitespace rule
      const ast = node('unit', {
        'whitespace': text('_'),
        'Definitions': list([
          node('definition', {
            'Name': text('expr'),
            'Sequence': list([
              node('reference', { 'Name': text('digit') })
            ])
          }),
          node('definition', {
            'Name': text('_'),
            'Sequence': list([
              node('repeat', {
                'Expression': node('range', {
                  'From': node('char', { 'Char': text(' ') }),
                  'To': node('char', { 'Char': text(' ') })
                })
              })
            ])
          }),
          node('definition', {
            'Name': text('digit'),
            'Sequence': list([
              node('range', {
                'From': node('char', { 'Char': text('0') }),
                'To': node('char', { 'Char': text('9') })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);

      // Verify the grammar structure
      expect(Object.keys(grammar.definitions)).to.have.lengthOf(3);

      // Verify the whitespace rule is set
      expect(grammar.options.whitespaceRule).to.equal('_');
    });

    it('should handle case sensitivity option', () => {
      // Create an AST with case sensitivity option
      const ast = node('unit', {
        'comparer': text('sensitive'),
        'Definitions': list([
          node('definition', {
            'Name': text('letter'),
            'Sequence': list([
              node('range', {
                'From': node('char', { 'Char': text('a') }),
                'To': node('char', { 'Char': text('z') })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);

      // Verify the grammar structure
      expect(Object.keys(grammar.definitions)).to.have.lengthOf(1);

      // Verify the case sensitivity option is set
      expect(grammar.options.caseSensitive).to.be.true;
    });

    it('should throw an error for recursive definitions without precedence', () => {
      // Create an AST with a recursive definition but no precedence
      const ast = node('unit', {
        'Definitions': list([
          node('definition', {
            'Name': text('expr'),
            'Sequence': list([
              node('reference', { 'Name': text('expr') }),
              node('string', { 'Value': text('+') }),
              node('reference', { 'Name': text('term') })
            ])
          }),
          node('definition', {
            'Name': text('term'),
            'Sequence': list([
              node('reference', { 'Name': text('digit') })
            ])
          }),
          node('definition', {
            'Name': text('digit'),
            'Sequence': list([
              node('range', {
                'From': node('char', { 'Char': text('0') }),
                'To': node('char', { 'Char': text('9') })
              })
            ])
          })
        ])
      });

      expect(() => buildGrammar(ast)).to.throw(Error, /Recursive definitions must be given explicit precedence/);
    });

    it('should throw an error for non-recursive definitions with precedence', () => {
      // Create an AST with a non-recursive definition but with precedence
      const ast = node('unit', {
        'Definitions': list([
          node('definition', {
            'Name': text('digit'),
            'Precedence': text('1'),
            'Sequence': list([
              node('range', {
                'From': node('char', { 'Char': text('0') }),
                'To': node('char', { 'Char': text('9') })
              })
            ])
          })
        ])
      });

      expect(() => buildGrammar(ast)).to.throw(Error, /Only recursive definitions may be in an explicit precedence definition/);
    });
  });
});
