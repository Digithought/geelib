import { expect } from 'aegir/chai';
import { NodeVisitor } from '../src/visitor.js';
import type { VisitorRule, VisitorContext } from '../src/visitor.js';
import type { Node, Item, NodeType } from '../src/ast/ast.js';

describe('NodeVisitor', () => {
  describe('addRule', () => {
    it('should add a global rule', () => {
      const visitor = new NodeVisitor();
      const rule: VisitorRule = {
        name: 'globalRule',
        visit: (node) => node
      };

      visitor.addRule(rule);

      // We can't directly test the internal state, but we can test the behavior
      const node: Node = {
        type: 'text' as NodeType,
        attributes: {}
      };

      // Create a spy to check if the rule is called
      let called = false;
      rule.visit = (n) => {
        called = true;
        return n;
      };

      visitor.visit(node);
      expect(called).to.be.true;
    });

    it('should add a type-specific rule', () => {
      const visitor = new NodeVisitor();
      const rule: VisitorRule = {
        name: 'typeRule',
        nodeType: 'text' as NodeType,
        visit: (node) => node
      };

      visitor.addRule(rule);

      // Create nodes of different types
      const matchingNode: Node = {
        type: 'text' as NodeType,
        attributes: {}
      };

      const nonMatchingNode: Node = {
        type: 'list' as NodeType,
        attributes: {}
      };

      // Create spies to check if the rule is called
      let called = false;
      rule.visit = (n) => {
        called = true;
        return n;
      };

      // Should call the rule for matching node type
      visitor.visit(matchingNode);
      expect(called).to.be.true;

      // Reset the spy
      called = false;

      // Should not call the rule for non-matching node type
      visitor.visit(nonMatchingNode);
      expect(called).to.be.false;
    });
  });

  describe('visit', () => {
    it('should visit a simple node', () => {
      const visitor = new NodeVisitor();
      const node: Node = {
        type: 'text' as NodeType,
        attributes: {}
      };

      const result = visitor.visit(node);
      expect(result).to.deep.equal(node);
    });

    it('should apply transformations from rules', () => {
      const visitor = new NodeVisitor();
      const rule: VisitorRule = {
        name: 'transformRule',
        visit: (node: Node) => {
          const transformed: Node = {
            ...node,
            attributes: {
              ...node.attributes,
              transformed: { type: 'text' as NodeType, start: 0, end: 0 } as Item
            }
          };
          return transformed;
        }
      };

      visitor.addRule(rule);

      const node: Node = {
        type: 'text' as NodeType,
        attributes: {
          original: { type: 'text' as NodeType, start: 0, end: 0 } as Item
        }
      };

      const result = visitor.visit(node);
      expect(result).to.deep.equal({
        type: 'text',
        attributes: {
          original: { type: 'text', start: 0, end: 0 },
          transformed: { type: 'text', start: 0, end: 0 }
        }
      });
    });

    it('should recursively visit child nodes', () => {
      const visitor = new NodeVisitor();
      const childNode: Node = {
        type: 'text' as NodeType,
        attributes: {}
      };

      const parentNode: Node = {
        type: 'container' as NodeType,
        attributes: {
          child: childNode
        }
      };

      // Add a rule that transforms child nodes
      const childRule: VisitorRule = {
        name: 'childRule',
        nodeType: 'text' as NodeType,
        visit: (node: Node) => {
          const transformed: Node = {
            ...node,
            attributes: {
              ...node.attributes,
              transformed: { type: 'text' as NodeType, start: 0, end: 0 } as Item
            }
          };
          return transformed;
        }
      };

      visitor.addRule(childRule);

      const result = visitor.visit(parentNode);

      // The child node should be transformed
      expect(result.attributes.child).to.deep.equal({
        type: 'text',
        attributes: {
          transformed: { type: 'text', start: 0, end: 0 }
        }
      });
    });

    it('should handle lists of nodes', () => {
      const visitor = new NodeVisitor();
      const listNode = {
        type: 'list' as NodeType,
        items: [
          { type: 'item1' as NodeType, attributes: {} } as Node,
          { type: 'item2' as NodeType, attributes: {} } as Node
        ]
      };

      const parentNode: Node = {
        type: 'container' as NodeType,
        attributes: {
          list: listNode as unknown as Item
        }
      };

      // Add a rule that transforms item nodes
      const itemRule: VisitorRule = {
        name: 'itemRule',
        nodeType: 'item1' as NodeType,
        visit: (node: Node) => {
          const transformed: Node = {
            ...node,
            attributes: {
              ...node.attributes,
              transformed: { type: 'text' as NodeType, start: 0, end: 0 } as Item
            }
          };
          return transformed;
        }
      };

      visitor.addRule(itemRule);

      const result = visitor.visit(parentNode);

      // The first item in the list should be transformed
      const resultList = result.attributes.list as unknown as typeof listNode;
      expect(resultList.items[0]).to.deep.equal({
        type: 'item1',
        attributes: {
          transformed: { type: 'text', start: 0, end: 0 }
        }
      });

      // The second item should remain unchanged
      expect(resultList.items[1]).to.deep.equal({
        type: 'item2',
        attributes: {}
      });
    });

    it('should apply multiple rules in order', () => {
      const visitor = new NodeVisitor();

      // Add two rules that transform the node in sequence
      const rule1: VisitorRule = {
        name: 'rule1',
        visit: (node: Node) => {
          const transformed: Node = {
            ...node,
            attributes: {
              ...node.attributes,
              rule1Applied: { type: 'text' as NodeType, start: 0, end: 0 } as Item
            }
          };
          return transformed;
        }
      };

      const rule2: VisitorRule = {
        name: 'rule2',
        visit: (node: Node) => {
          const transformed: Node = {
            ...node,
            attributes: {
              ...node.attributes,
              rule2Applied: { type: 'text' as NodeType, start: 0, end: 0 } as Item
            }
          };
          return transformed;
        }
      };

      visitor.addRule(rule1);
      visitor.addRule(rule2);

      const node: Node = {
        type: 'text' as NodeType,
        attributes: {}
      };

      const result = visitor.visit(node);

      // Both rules should have been applied
      expect(result.attributes.rule1Applied).to.exist;
      expect(result.attributes.rule2Applied).to.exist;
    });

    it('should handle rules that return null', () => {
      const visitor = new NodeVisitor();

      // Add a rule that returns null
      const nullRule: VisitorRule = {
        name: 'nullRule',
        visit: () => null
      };

      visitor.addRule(nullRule);

      const node: Node = {
        type: 'text' as NodeType,
        attributes: {}
      };

      const result = visitor.visit(node);

      // The node should remain unchanged
      expect(result).to.deep.equal(node);
    });
  });
});
