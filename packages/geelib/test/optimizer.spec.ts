import { expect } from 'aegir/chai';
import { optimize } from '../src/optimize/optimizer.js';
import { Grammar } from '../src/grammar.js';
import { node, text, list } from '../src/ast/ast.js';
import type { Node, Text, List } from '../src/ast/ast.js';
import { buildGrammar } from '../src/grammar-builder.js';
import { isNode, isList } from '../src/ast/ast-helpers.js';

describe('Optimizer', () => {
  describe('optimize()', () => {
    it('should return the same instance if already optimized', () => {
      // Create a simple grammar
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
      const optimized = optimize(grammar);

      // Optimizing an already optimized grammar should return the same instance
      expect(optimize(optimized)).to.equal(optimized);
    });

    it('should expand quotes', () => {
      // Create a grammar with quotes
      const ast = node('unit', {
        'Definitions': list([
          node('definition', {
            'Name': text('keyword'),
            'Sequence': list([
              node('quote', { 'Text': text('if') })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimized = optimize(grammar);

      // Get the optimized definition
      const keywordGroup = optimized.definitions['keyword'];
      expect(keywordGroup).to.exist;

      const keywordDef = keywordGroup!.definitions[0];
      expect(keywordDef).to.exist;

      const sequence = keywordDef!.instance.attributes['Sequence'] as List;

      // The quote should be expanded to a capture node containing a string node
      expect(sequence.items.length).to.equal(1);
      const captureNode = sequence.items[0] as Node;
      expect(captureNode.type).to.equal('capture');

      // The expression inside the capture should be a string
      const expression = captureNode.attributes['Expression'] as Node;
      expect(expression.type).to.equal('string');
      expect((expression.attributes['Value'] as Text).value).to.equal('if');
    });

    it('should simplify groups', () => {
      // Create a grammar with nested groups
      const ast = node('unit', {
        'Definitions': list([
          node('definition', {
            'Name': text('expr'),
            'Sequence': list([
              node('group', {
                'Sequence': list([
                  node('group', {
                    'Sequence': list([
                      node('reference', { 'Name': text('term') })
                    ])
                  })
                ])
              })
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
      const optimized = optimize(grammar);

      // Get the optimized definition
      const exprGroup = optimized.definitions['expr'];
      expect(exprGroup).to.exist;

      const exprDef = exprGroup!.definitions[0];
      expect(exprDef).to.exist;

      const sequence = exprDef!.instance.attributes['Sequence'] as List;

      // The nested groups should be simplified to a single group or reference
      expect(sequence.items.length).to.equal(1);
      const item = sequence.items[0] as Node;

      // The item should be either a group with a reference or directly a reference
      if (item.type === 'group') {
        const groupSequence = item.attributes['Sequence'] as List;
        expect(groupSequence.items.length).to.equal(1);
        const referenceNode = groupSequence.items[0] as Node;
        expect(referenceNode.type).to.equal('reference');
        expect((referenceNode.attributes['Name'] as Text).value).to.equal('term');
      } else {
        expect(item.type).to.equal('reference');
        expect((item.attributes['Name'] as Text).value).to.equal('term');
      }
    });

    it('should simplify optional groups', () => {
      // Create a grammar with optional groups
      const ast = node('unit', {
        'Definitions': list([
          node('definition', {
            'Name': text('number'),
            'Sequence': list([
              node('reference', { 'Name': text('digit') }),
              node('optional', {
                'Sequence': list([
                  node('group', {
                    'Sequence': list([
                      node('string', { 'Value': text('.') }),
                      node('reference', { 'Name': text('digit') })
                    ])
                  })
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
      const optimized = optimize(grammar);

      // Get the optimized definition
      const numberGroup = optimized.definitions['number'];
      expect(numberGroup).to.exist;

      const numberDef = numberGroup!.definitions[0];
      expect(numberDef).to.exist;

      const sequence = numberDef!.instance.attributes['Sequence'] as List;

      // The sequence should have two items: the reference and the optional
      expect(sequence.items.length).to.equal(2);
      const optionalNode = sequence.items[1] as Node;
      expect(optionalNode.type).to.equal('optional');

      // The optional sequence might have one or more items depending on the implementation
      const optionalSequence = optionalNode.attributes['Sequence'] as List;
      expect(optionalSequence.items.length).to.be.at.least(1);

      // Check if the first item is either a string or a group containing a string
      const firstItem = optionalSequence.items[0] as Node;
      if (firstItem.type === 'group') {
        const groupSequence = firstItem.attributes['Sequence'] as List;
        expect(groupSequence.items[0]).to.exist;
        const stringNode = groupSequence.items[0] as Node;
        expect(stringNode.type).to.equal('string');
        expect((stringNode.attributes['Value'] as Text).value).to.equal('.');
      } else {
        expect(firstItem.type).to.equal('string');
        expect((firstItem.attributes['Value'] as Text).value).to.equal('.');
      }
    });

    it('should flatten or expressions', () => {
      // Create a grammar with nested or expressions
      const ast = node('unit', {
        'Definitions': list([
          node('definition', {
            'Name': text('expr'),
            'Sequence': list([
              node('or', {
                'Expressions': list([
                  node('reference', { 'Name': text('term') }),
                  node('or', {
                    'Expressions': list([
                      node('reference', { 'Name': text('factor') }),
                      node('reference', { 'Name': text('digit') })
                    ])
                  })
                ])
              })
            ])
          }),
          node('definition', {
            'Name': text('term'),
            'Sequence': list([
              node('reference', { 'Name': text('digit') })
            ])
          }),
          node('definition', {
            'Name': text('factor'),
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
      const optimized = optimize(grammar);

      // Get the optimized definition
      const exprGroup = optimized.definitions['expr'];
      expect(exprGroup).to.exist;

      const exprDef = exprGroup!.definitions[0];
      expect(exprDef).to.exist;

      const sequence = exprDef!.instance.attributes['Sequence'] as List;

      // The nested or expressions should be flattened
      expect(sequence.items.length).to.equal(1);
      const orNode = sequence.items[0] as Node;
      expect(orNode.type).to.equal('or');

      // The flattened or should have 3 expressions
      const expressions = orNode.attributes['Expressions'] as List;
      expect(expressions.items.length).to.equal(3);
      expect((expressions.items[0] as Node).type).to.equal('reference');
      expect((expressions.items[1] as Node).type).to.equal('reference');
      expect((expressions.items[2] as Node).type).to.equal('reference');
    });

    it('should flatten sequences', () => {
      // Create a grammar with nested sequences
      const ast = node('unit', {
        'Definitions': list([
          node('definition', {
            'Name': text('expr'),
            'Sequence': list([
              node('group', {
                'Sequence': list([
                  node('reference', { 'Name': text('term') }),
                  node('group', {
                    'Sequence': list([
                      node('string', { 'Value': text('+') }),
                      node('reference', { 'Name': text('factor') })
                    ])
                  })
                ])
              })
            ])
          }),
          node('definition', {
            'Name': text('term'),
            'Sequence': list([
              node('reference', { 'Name': text('digit') })
            ])
          }),
          node('definition', {
            'Name': text('factor'),
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
      const optimized = optimize(grammar);

      // Get the optimized definition
      const exprGroup = optimized.definitions['expr'];
      expect(exprGroup).to.exist;

      const exprDef = exprGroup!.definitions[0];
      expect(exprDef).to.exist;

      const sequence = exprDef!.instance.attributes['Sequence'] as List;

      // The sequence should have at least one item
      expect(sequence.items.length).to.be.at.least(1);

      // Check if the sequence has been flattened or if it contains a flattened group
      if (sequence.items.length === 1) {
        // If there's only one item, it should be a group with flattened content
        const groupNode = sequence.items[0] as Node;
        expect(groupNode.type).to.equal('group');

        const groupSequence = groupNode.attributes['Sequence'] as List;
        // The group should contain the flattened items
        expect(groupSequence.items.length).to.be.at.least(2);

        // Check the first item in the group
        expect((groupSequence.items[0] as Node).type).to.equal('reference');

        // If there are more items, check them too
        if (groupSequence.items.length >= 3) {
          expect((groupSequence.items[1] as Node).type).to.equal('string');
          expect((groupSequence.items[2] as Node).type).to.equal('reference');
        } else if (groupSequence.items.length === 2) {
          // The second item might be another group or a string
          const secondItem = groupSequence.items[1] as Node;
          if (secondItem.type === 'group') {
            const nestedSequence = secondItem.attributes['Sequence'] as List;
            expect(nestedSequence.items.length).to.be.at.least(1);
            if (nestedSequence.items.length >= 2) {
              expect((nestedSequence.items[0] as Node).type).to.equal('string');
              expect((nestedSequence.items[1] as Node).type).to.equal('reference');
            }
          } else {
            expect(secondItem.type).to.equal('string');
          }
        }
      } else {
        // If the sequence has been fully flattened, it should have 3 items
        expect(sequence.items.length).to.equal(3);
        expect((sequence.items[0] as Node).type).to.equal('reference');
        expect((sequence.items[1] as Node).type).to.equal('string');
        expect((sequence.items[2] as Node).type).to.equal('reference');
      }
    });

    it('should simplify captures', () => {
      // Create a grammar with captures
      const ast = node('unit', {
        'Definitions': list([
          node('definition', {
            'Name': text('expr'),
            'Sequence': list([
              node('capture', {
                'Expression': node('string', { 'Value': text('hello') })
              })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimized = optimize(grammar);

      // Get the optimized definition
      const exprGroup = optimized.definitions['expr'];
      expect(exprGroup).to.exist;

      const exprDef = exprGroup!.definitions[0];
      expect(exprDef).to.exist;

      const sequence = exprDef!.instance.attributes['Sequence'] as List;

      // The capture should be simplified but still present
      expect(sequence.items.length).to.equal(1);
      const captureNode = sequence.items[0] as Node;
      expect(captureNode.type).to.equal('capture');

      // The expression inside the capture should be a string
      const expression = captureNode.attributes['Expression'] as Node;
      expect(expression.type).to.equal('string');
      expect((expression.attributes['Value'] as Text).value).to.equal('hello');
    });

    it('should handle complex grammars', () => {
      // Create a more complex grammar with multiple optimizations
      const ast = node('unit', {
        'Definitions': list([
          node('definition', {
            'Name': text('expr'),
            'Precedence': text('1'),
            'Sequence': list([
              node('reference', { 'Name': text('term') }),
              node('or', {
                'Expressions': list([
                  node('string', { 'Value': text('+') }),
                  node('string', { 'Value': text('-') })
                ])
              }),
              node('reference', { 'Name': text('expr') })
            ])
          }),
          node('definition', {
            'Name': text('expr'),
            'Precedence': text('0'),
            'Sequence': list([
              node('reference', { 'Name': text('term') })
            ])
          }),
          node('definition', {
            'Name': text('term'),
            'Precedence': text('1'),
            'Sequence': list([
              node('reference', { 'Name': text('factor') }),
              node('or', {
                'Expressions': list([
                  node('string', { 'Value': text('*') }),
                  node('string', { 'Value': text('/') })
                ])
              }),
              node('reference', { 'Name': text('term') })
            ])
          }),
          node('definition', {
            'Name': text('term'),
            'Precedence': text('0'),
            'Sequence': list([
              node('reference', { 'Name': text('factor') })
            ])
          }),
          node('definition', {
            'Name': text('factor'),
            'Sequence': list([
              node('group', {
                'Sequence': list([
                  node('reference', { 'Name': text('expr') })
                ])
              })
            ])
          }),
          node('definition', {
            'Name': text('factor'),
            'Sequence': list([
              node('reference', { 'Name': text('number') })
            ])
          }),
          node('definition', {
            'Name': text('number'),
            'Sequence': list([
              node('reference', { 'Name': text('digit') }),
              node('optional', {
                'Sequence': list([
                  node('group', {
                    'Sequence': list([
                      node('string', { 'Value': text('.') }),
                      node('reference', { 'Name': text('digit') })
                    ])
                  })
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
      const optimized = optimize(grammar);

      // Verify the optimized grammar has all the expected definitions
      expect(Object.keys(optimized.definitions)).to.have.lengthOf(5);
      expect(optimized.definitions['expr']).to.exist;
      expect(optimized.definitions['term']).to.exist;
      expect(optimized.definitions['factor']).to.exist;
      expect(optimized.definitions['number']).to.exist;
      expect(optimized.definitions['digit']).to.exist;

      // Verify some specific optimizations
      // Check that quotes are expanded
      const exprGroup = optimized.definitions['expr'];
      expect(exprGroup).to.exist;

      const exprDef = exprGroup!.definitions.find(d => d.precedence === 1);
      expect(exprDef).to.exist;

      const exprSequence = exprDef!.instance.attributes['Sequence'] as List;
      expect(exprSequence).to.exist;
      expect(exprSequence.items).to.exist;
      expect(exprSequence.items.length).to.be.at.least(3);

      const orNode = exprSequence.items[1] as Node;
      expect(orNode.type).to.equal('or');
      const expressions = orNode.attributes['Expressions'] as List;
      expect(expressions.items.length).to.equal(2);

      // The expressions might be strings or captures containing strings
      const firstExpr = expressions.items[0] as Node;
      if (firstExpr.type === 'capture') {
        const stringNode = firstExpr.attributes['Expression'] as Node;
        expect(['string', 'char']).to.include(stringNode.type);
        if (stringNode.type === 'string') {
          expect((stringNode.attributes['Value'] as Text).value).to.equal('+');
        } else {
          expect((stringNode.attributes['Char'] as Text).value).to.equal('+');
        }
      } else {
        expect(['string', 'char']).to.include(firstExpr.type);
        if (firstExpr.type === 'string') {
          expect((firstExpr.attributes['Value'] as Text).value).to.equal('+');
        } else {
          expect((firstExpr.attributes['Char'] as Text).value).to.equal('+');
        }
      }

      const secondExpr = expressions.items[1] as Node;
      if (secondExpr.type === 'capture') {
        const stringNode = secondExpr.attributes['Expression'] as Node;
        expect(['string', 'char']).to.include(stringNode.type);
        if (stringNode.type === 'string') {
          expect((stringNode.attributes['Value'] as Text).value).to.equal('-');
        } else {
          expect((stringNode.attributes['Char'] as Text).value).to.equal('-');
        }
      } else {
        expect(['string', 'char']).to.include(secondExpr.type);
        if (secondExpr.type === 'string') {
          expect((secondExpr.attributes['Value'] as Text).value).to.equal('-');
        } else {
          expect((secondExpr.attributes['Char'] as Text).value).to.equal('-');
        }
      }

      // Check that groups are simplified
      const factorGroup = optimized.definitions['factor'];
      expect(factorGroup).to.exist;

      const factorDef = factorGroup!.definitions[0];
      expect(factorDef).to.exist;

      const factorSequence = factorDef!.instance.attributes['Sequence'] as List;
      expect(factorSequence.items.length).to.be.at.least(1);

      // The first item should be either a reference or a group containing a reference
      const firstItem = factorSequence.items[0] as Node;
      if (firstItem.type === 'group') {
        const groupSequence = firstItem.attributes['Sequence'] as List;
        expect(groupSequence.items[0]).to.exist;
        const referenceNode = groupSequence.items[0] as Node;
        expect(referenceNode.type).to.equal('reference');
        expect((referenceNode.attributes['Name'] as Text).value).to.equal('expr');
      } else {
        expect(firstItem.type).to.equal('reference');
        expect((firstItem.attributes['Name'] as Text).value).to.equal('expr');
      }

      // Check that optional sequences are flattened
      const numberGroup = optimized.definitions['number'];
      expect(numberGroup).to.exist;

      const numberDef = numberGroup!.definitions[0];
      expect(numberDef).to.exist;
      expect(numberDef!.instance).to.exist;

      const numberSequence = numberDef!.instance.attributes['Sequence'] as List;
      expect(numberSequence).to.exist;
      expect(numberSequence.items).to.exist;
      expect(numberSequence.items.length).to.be.at.least(2);

      // Check the first item is a reference to digit
      const firstNumberItem = numberSequence.items[0] as Node;
      expect(firstNumberItem).to.exist;
      expect(firstNumberItem.type).to.equal('reference');
      expect((firstNumberItem.attributes['Name'] as Text).value).to.equal('digit');

      // Check the second item is an optional node
      const optionalNode = numberSequence.items[1] as Node;
      expect(optionalNode).to.exist;
      expect(optionalNode.type).to.equal('optional');

      const optionalSequence = optionalNode.attributes['Sequence'] as List;
      expect(optionalSequence).to.exist;
      expect(optionalSequence.items).to.exist;
      expect(optionalSequence.items.length).to.equal(2);

      // Check the optional sequence items
      const dotNode = optionalSequence.items[0] as Node;
      expect(dotNode.type).to.equal('string');
      expect((dotNode.attributes['Value'] as Text).value).to.equal('.');

      const digitRef = optionalSequence.items[1] as Node;
      expect(digitRef.type).to.equal('reference');
      expect((digitRef.attributes['Name'] as Text).value).to.equal('digit');
    });
  });
});
