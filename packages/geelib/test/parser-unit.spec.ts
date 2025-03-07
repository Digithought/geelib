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
        Name: item('Test'),
        Definitions: item([
          item({
            Name: item('Rule'),
            Type: item(':='),
            Sequence: item([
              item({ Index: item('65') }) // ASCII 'A'
            ])
          })
        ])
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
        Name: item('Test'),
        Comparer: item('sensitive'),
        Definitions: item([
          item({
            Name: item('Rule'),
            Type: item(':='),
            Sequence: item([
              item({ Index: item('65') }) // ASCII 'A'
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      const goodInput = 'A';
      const result = parser.parse(new StringStream(goodInput)) as Node;

      expect(isNode(result)).to.be.true;
      const rule = result.value['Rule'] as Text;
      expect(isText(rule)).to.be.true;
      expect(rule.value).to.equal('A');

      const badInput = 'a';
      const resultBad = parser.parse(new StringStream(badInput));
      expect(resultBad).to.be.null;
    });

    it('should parse a grammar with whitespace setting', () => {
      // Create a simple grammar
      const ast = item({
        Name: item('Test'),
        Whitespace: item('ws'),
        Definitions: item([
          item({
            Name: item('Rule'),
            Type: item(':='),
            Sequence: item([
              item({ Index: item('65') }) // ASCII 'A'
            ])
          }),
          item({
            Name: item('ws'),
            Type: item('='),
            Sequence: item([
              item({ Literal: item(' ') })
            ])
          })
        ])
      });

      const grammar = buildGrammar(ast);
      const optimizedGrammar = optimize(grammar);
      const parser = new Parser(optimizedGrammar);

      // Test grammar with whitespace setting
      const easyInput = 'A';
      const result = parser.parse(new StringStream(easyInput)) as Node;

      expect(isNode(result)).to.be.true;
      const rule = result.value['Rule'] as Text;
      expect(isText(rule)).to.be.true;
      expect(rule.value).to.equal('A');

      const hardInput = ' A ';
      const resultHard = parser.parse(new StringStream(hardInput));
      expect(isText(rule)).to.be.true;
      expect(rule.value).to.equal('A');
    });

    it('case insensitive', () => {
      // Create a simple grammar
      const ast = item({
        Name: item('Test'),
        Comparer: item('insensitive'),
        Definitions: item([
          item({
            Name: item('Rule'),
            Type: item(':='),
            Sequence: item([
              item({ Literal: item('A') })
            ])
          })
        ])
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
