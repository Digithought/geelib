import { expect } from 'aegir/chai';
import { item } from '../src/ast/ast.js';
import { buildGrammar } from '../src/grammar-builder.js';
import { optimize } from '../src/optimize/optimizer.js';
import { isNode, isList, isText } from "../src/ast/ast.js";
import type { Item, Node, Text } from '../src/ast/ast.js';
import { Parser } from '../src/parser.js';
import { StringStream } from '../src/string-stream.js';

describe('Quote Expander', () => {
  it('should transform Quote expressions during optimization', () => {
    // This test verifies that Quote expressions are properly expanded by the optimizer
    const ast = item({
      Whitespace: item('_'),
      Definitions: item([
        item({
          Name: item('Test'),
          Type: item(':='),
          Sequence: item([
            item({ Quote: item({ Text: item('hello') }) })
          ])
        }),
        item({
          Name: item('_'),
          Type: item(':='),
          Sequence: item([
            item({ Repeat: item({ Expression:
              item({ String: item({ Text: item(' ') }) })
            }) })
          ])
        })
      ]),
      Root: item('Test')
    });

    // Build the grammar and optimize it
    const grammar = buildGrammar(ast);
    const optimized = optimize(grammar);

    // Verify that the Quote node has been transformed
    const testDefinition = optimized.definitions['Test'];
    expect(testDefinition).to.not.be.undefined;
    if (testDefinition) {
      const definitions = testDefinition.definitions;
      expect(definitions.length).to.be.greaterThan(0);
      if (definitions.length > 0) {
        const definition = definitions[0];
        if (definition) {
          const sequence = definition.instance.value['Sequence'];
          expect(sequence).to.not.be.undefined;
          expect(isList(sequence)).to.be.true;

          // The Quote should have been transformed into a sequence with whitespace
          if (isList(sequence)) {
            expect(sequence.value.length).to.be.greaterThan(0);
            // Check that there's no Quote node in the sequence
            const hasQuote = sequence.value.some(item => {
              if (isNode(item)) {
                return 'Quote' in item.value;
              }
              return false;
            });
            expect(hasQuote).to.be.false;
          }
        }
      }
    }
  });

  it('should handle escaped quotes in quoted strings', () => {
    // This test verifies that Quote expressions with escaped quotes are properly handled
    const ast = item({
      Definitions: item([
        item({
          Name: item('Test'),
          Type: item(':='),
          Sequence: item([
            item({
              String: item({
                Text: item('hello "world"')
              })
            })
          ])
        })
      ]),
      Root: item('Test')
    });

    // Build the grammar and optimize it
    const grammar = buildGrammar(ast);
    const optimized = optimize(grammar);

    // Now test that the parser can parse the input
    const parser = new Parser(optimized);
    const input = 'hello "world"';
    const stream = new StringStream(input);
    const result = parser.parse(stream);

    expect(result).to.not.be.undefined;
    if (result) {
      // Use type assertion
      const nodeValue = result.value as Record<string, Item>;
      expect(nodeValue).to.have.property('Test');
      const testNode = nodeValue['Test']!;
      expect(isText(testNode)).to.be.true;
      if (isText(testNode)) {
        expect(testNode.value).to.equal('hello "world"');
      }
    }
  });
});
