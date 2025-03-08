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

    it('should add a rule with a memberName filter', () => {
      const visitor = new NodeVisitor();
      let matchingCalled = false;
      let nonMatchingCalled = false;

      const rule: VisitorRule = {
        name: 'filteredRule',
        memberName: 'text',
        visit: (member: Member, context: VisitorContext) => {
          matchingCalled = true;
          return member;
        }
      };

      visitor.addRule(rule);

      // Create a spy for non-matching members
      const nonMatchingRule: VisitorRule = {
        name: 'nonMatchingRule',
        memberName: 'other',
        visit: (member: Member, context: VisitorContext) => {
          nonMatchingCalled = true;
          return member;
        }
      };

      visitor.addRule(nonMatchingRule);

      // Create test nodes
      const matchingNode = item({});
      const nonMatchingNode = item({});

      // Create members with different names to test filtering
      const matchingMember: Member = ['text', matchingNode];
      const nonMatchingMember: Member = ['other', nonMatchingNode];

      // Visit the matching member
      visitor.visit(matchingMember);
      expect(matchingCalled).to.be.true;
      expect(nonMatchingCalled).to.be.false;

      // Reset flags
      matchingCalled = false;
      nonMatchingCalled = false;

      // Visit the non-matching member
      visitor.visit(nonMatchingMember);
      expect(matchingCalled).to.be.false;
      expect(nonMatchingCalled).to.be.true;
    });
  });

  describe('visit', () => {
    it('should visit child nodes', () => {
      const visitor = new NodeVisitor();
      const childNode = item({});
      const parentNode = item({ child: childNode });
      const member: Member = ['parent', parentNode];

      visitor.addRule({
        name: 'modifyRule',
        memberName: 'child',
        visit: (member: Member, context: VisitorContext) => {
          const [name, node] = member;
          return [name, {
            ...node,
            grammarName: 'modified-child'
          }];
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

      // Create two items for the list
      const item1 = item({});
      const item2 = item({});

      // Create a list containing the items
      const listNode = item([item1, item2]);

      // Create a member with the list
      const member: Member = ['list', listNode];

      // Add a rule that modifies the first item in the list
      visitor.addRule({
        name: 'modifyFirstItemRule',
        visit: (member: Member, context: VisitorContext) => {
          const [name, node] = member;
          // This is a global rule that will be applied to all items
          // We'll check if this is the first item in the list by checking if it's the same object
          if (node === item1) {
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
      expect(resultItems[1]?.grammarName).to.be.undefined;
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
