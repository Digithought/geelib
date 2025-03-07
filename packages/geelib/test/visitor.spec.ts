import { expect } from 'aegir/chai';
import { NodeVisitor } from '../src/visitor.js';
import type { VisitorRule, VisitorContext } from '../src/visitor.js';
import type { Node, Item, Member } from '../src/ast/ast.js';
import { item } from '../src/ast/ast.js';

describe('NodeVisitor', () => {
  describe('addRule', () => {
    it('should add a global rule', () => {
      const visitor = new NodeVisitor();
      const rule: VisitorRule = {
        name: 'globalRule',
        visit: (member: Member, context: VisitorContext) => member
      };

      visitor.addRule(rule);

      // We can't directly test the internal state, but we can test the behavior
      const node = item({});
      const member: Member = ['test', node];

      // Create a spy to check if the rule is called
      let called = false;
      rule.visit = (member: Member, context: VisitorContext) => {
        called = true;
        return member;
      };

      visitor.visit(member);
      expect(called).to.be.true;
    });

    it('should add a rule with a filter', () => {
      const visitor = new NodeVisitor();
      let matchingCalled = false;
      let nonMatchingCalled = false;

      const rule: VisitorRule = {
        name: 'filteredRule',
        visit: (member: Member, context: VisitorContext) => {
          const [name, item] = member;
          return member;
        }
      };

      visitor.addRule(rule);

      const matchingNode = item({}, 0, 0, 'text');
      const nonMatchingNode = item({}, 0, 0, 'other');
      const matchingMember: Member = ['text', matchingNode];
      const nonMatchingMember: Member = ['other', nonMatchingNode];

      rule.visit = (member: Member, context: VisitorContext) => {
        const [name, node] = member;
        if (node.grammarName === 'text') {
          matchingCalled = true;
        } else {
          nonMatchingCalled = true;
        }
        return member;
      };

      visitor.visit(matchingMember);
      visitor.visit(nonMatchingMember);

      expect(matchingCalled).to.be.true;
      expect(nonMatchingCalled).to.be.false;
    });
  });

  describe('visit', () => {
    it('should visit child nodes', () => {
      const visitor = new NodeVisitor();
      const childNode = item({}, 0, 0, 'child');
      const parentNode = item({ child: childNode });
      const member: Member = ['parent', parentNode];

      visitor.addRule({
        name: 'modifyRule',
        visit: (member: Member, context: VisitorContext) => {
          const [name, node] = member;
          if (node.grammarName === 'child') {
            return [name, {
              ...node,
              grammarName: 'modified-child'
            }];
          }
          return member;
        }
      });

      const result = visitor.visit(member);
      if (!result) {
        throw new Error('Expected result to be defined');
      }

      const [resultName, resultNode] = result;
      const resultValue = resultNode.value as Record<string, Item>;

      expect(resultValue.child?.grammarName).to.equal('modified-child');
    });

    it('should visit items in a list', () => {
      const visitor = new NodeVisitor();
      const item1 = item({}, 0, 0, 'item1');
      const item2 = item({}, 0, 0, 'item2');
      const listNode = item([item1, item2]);
      const member: Member = ['list', listNode];

      visitor.addRule({
        name: 'modifyRule',
        visit: (member: Member, context: VisitorContext) => {
          const [name, node] = member;
          if (node.grammarName === 'item1') {
            return [name, {
              ...node,
              grammarName: 'modified-item1'
            }];
          }
          return member;
        }
      });

      const result = visitor.visit(member);
      if (!result) {
        throw new Error('Expected result to be defined');
      }

      const [resultName, resultNode] = result;
      const resultItems = resultNode.value as Item[];

      expect(resultItems[0]?.grammarName).to.equal('modified-item1');
      expect(resultItems[1]?.grammarName).to.equal('item2');
    });

    it('should handle text nodes', () => {
      const visitor = new NodeVisitor();
      const textNode = item('hello');
      const member: Member = ['text', textNode];

      // Text nodes should pass through unchanged
      const result = visitor.visit(member);
      if (!result) {
        throw new Error('Expected result to be defined');
      }

      const [resultName, resultNode] = result;
      expect(resultNode.value).to.equal('hello');
    });
  });
});
