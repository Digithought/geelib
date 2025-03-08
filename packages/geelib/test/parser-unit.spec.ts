import { expect } from 'aegir/chai';
import { Parser } from '../src/parser.js';
import { StringStream } from '../src/string-stream.js';
import { buildGrammar } from '../src/grammar-builder.js';
import { item } from '../src/ast/ast.js';
import { optimize } from '../src/optimize/optimizer.js';
import type { Node, Text, List, Item } from '../src/ast/ast.js';
import { isNode, isText } from "../src/ast/ast.js";

describe('Parser - Unit Tests', () => {
  describe('Unit rule', () => {
    it('should parse a basic grammar declaration', () => {
      // Create a simple grammar
      const ast = item({
        Definitions: item([
          item({
            Name: item('Rule'),
            Type: item(':='),
            Sequence: item([
              item({ Char: item({ Index: item('65') }) }) // ASCII 'A'
            ])
          })
        ]),
        Root: item('Rule'),
        Name: item('Test')
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      const input = 'A';
      const result = parser.parse(new StringStream(input)) as Node;

      expect(isNode(result)).to.be.true;
      const rule = result.value['Rule'] as Text;
      expect(isText(rule)).to.be.true;
      expect(rule.value).to.equal('A');
    });

    it('should parse a grammar with comparer setting', () => {
      // Create a simple grammar
      const ast = item({
        Definitions: item([
          item({
            Name: item('Rule'),
            Type: item(':='),
            Sequence: item([
              item({ Char: item({ Literal: item('A') }) })
            ])
          })
        ]),
        Root: item('Rule'),
        Name: item('Test'),
        Comparer: item('sensitive')
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      const easyInput = 'A';
      const result = parser.parse(new StringStream(easyInput)) as Node;
      expect(isNode(result)).to.be.true;
      const rule = result.value['Rule'] as Text;
      expect(isText(rule)).to.be.true;
      expect(rule.value).to.equal('A');

      const hardInput = 'a';
      const resultHard = parser.parse(new StringStream(hardInput));
      expect(resultHard).to.be.null;
    });

    it('should parse a grammar with whitespace setting', () => {
      // Create a simple grammar
      const ast = item({
        Definitions: item([
          item({
            Name: item('Rule'),
            Type: item(':='),
            Sequence: item([
              item({ Char: item({ Index: item('65') }) }) // ASCII 'A'
            ])
          }),
          item({
            Name: item('_'),
            Type: item(':='), // Change from '=' to ':=' to make it a declaration
            Sequence: item([
              item({ Repeat: item({ Expression: item({ String: item({ Text: item(' ') }) }) }) })
            ])
          })
        ]),
        Root: item('Rule'),
        Name: item('Test'),
        Whitespace: item('_')
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test grammar with whitespace setting
      const easyInput = 'A';
      const result = parser.parse(new StringStream(easyInput));

      expect(result).to.not.be.undefined;
      if (result) {
        expect(isNode(result)).to.be.true;
        if (isNode(result)) {
          const rule = result.value['Rule'];
          expect(rule).to.not.be.undefined;
          if (rule) {
            expect(isText(rule)).to.be.true;
            if (isText(rule)) {
              expect(rule.value).to.equal('A');
            }
          }
        }
      }

      // Test with whitespace
      const hardInput = ' A ';
      const resultHard = parser.parse(new StringStream(hardInput));

      expect(resultHard).to.not.be.undefined;
      if (resultHard) {
        expect(isNode(resultHard)).to.be.true;
        if (isNode(resultHard)) {
          const ruleHard = resultHard.value['Rule'];
          expect(ruleHard).to.not.be.undefined;
          if (ruleHard) {
            expect(isText(ruleHard)).to.be.true;
            if (isText(ruleHard)) {
              expect(ruleHard.value).to.equal('A');
            }
          }
        }
      }
    });

    it('case insensitive', () => {
      // Create a simple grammar
      const ast = item({
        Definitions: item([
          item({
            Name: item('Rule'),
            Type: item(':='),
            Sequence: item([
              item({ Char: item({ Literal: item('A') }) })
            ])
          })
        ]),
        Root: item('Rule'),
        Name: item('Test'),
        Comparer: item('insensitive')
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      const easyInput = 'A';
      const result = parser.parse(new StringStream(easyInput)) as Node;
      expect(isNode(result)).to.be.true;
      const rule = result.value['Rule'] as Text;
      expect(isText(rule)).to.be.true;
      expect(rule.value).to.equal('A');

      const hardInput = 'a';
      const resultHard = parser.parse(new StringStream(hardInput)) as Node;
      expect(isNode(resultHard)).to.be.true;
      const ruleHard = resultHard.value['Rule'] as Text;
      expect(isText(ruleHard)).to.be.true;
      expect(ruleHard.value).to.equal('a');
    });
  });
});
