import type { Item } from "./ast/ast.js";
import { isNode, isList, type Member } from "./ast/ast.js";

/**
 * Context passed to visitor rules during traversal.
 * Contains information about the current state of the visitor.
 */
export interface VisitorContext {
  whitespaceRule?: string;
  [key: string]: any;
}

/**
 * A rule that can be applied to nodes during traversal.
 * Rules are applied to Members (name-value pairs), not to arbitrary Items.
 */
export interface VisitorRule {
  name: string;
  /**
   * Optional filter to apply the rule only to Members with specific names.
   * If not provided, the rule is applied to all Members.
   */
  memberName?: string | string[];
  /**
   * Function called when the rule is applied to a Member.
   * @param member The Member being visited (a name-value pair)
   * @param context The visitor context
   * @returns A new Member to replace the original, or undefined to keep the original
   */
  visit(member: Member, context: VisitorContext): Member | undefined;
}

/**
 * Visitor for traversing and transforming AST structures.
 *
 * The visitor follows a specific traversal pattern:
 * 1. `visit` processes Members (name-value pairs)
 * 2. `visitItem` processes Items (nodes, lists, or text)
 * 3. For nodes, each attribute is processed as a Member using `visit`
 * 4. For lists, each item is processed using `visitItem` (not `visit`)
 *
 * Rules are applied to Members, not to arbitrary Items. This means that
 * rules can only target named attributes in nodes, not items in lists.
 */
export class NodeVisitor {
  private typeRules: Map<string, VisitorRule[]> = new Map();
  private globalRules: VisitorRule[] = [];

  /**
   * Adds a rule to the visitor.
   * @param rule The rule to add
   */
  addRule(rule: VisitorRule): void {
    if (rule.memberName) {
      const types = Array.isArray(rule.memberName) ? rule.memberName : [rule.memberName];
      for (const type of types) {
        let rules = this.typeRules.get(type);
        if (!rules) {
          rules = [];
          this.typeRules.set(type, rules);
        }
        rules.push(rule);
      }
    } else {
      this.globalRules.push(rule);
    }
  }

  /**
   * Visits a Member (name-value pair) and applies rules to it.
   * This is the entry point for the visitor pattern.
   *
   * @param member The Member to visit
   * @param context The visitor context
   * @returns A new Member to replace the original, or undefined if no rules were applied
   */
  visit(member: Member, context: VisitorContext = {}): Member | undefined {
		const [name] = member;
		let replacement: Member | undefined;
    const typeRules = this.typeRules.get(name);
    if (typeRules) {
      for (const rule of typeRules) {
        const result = rule.visit(replacement ?? member, context);
        if (result) {
          replacement = result;
        }
      }
    }

    for (const rule of this.globalRules) {
      const result = rule.visit(replacement ?? member, context);
      if (result) {
        replacement = result;
      }
    }

		const newMember = replacement ?? member;
		const [newName, value] = newMember;
		return [newName, this.visitItem(value, context)]
  }

  /**
   * Visits an Item (node, list, or text) and recursively processes its children.
   * This method does not apply rules directly to the Item, but rather to its children
   * if they are Members.
   *
   * @param item The Item to visit
   * @param context The visitor context
   * @returns A new Item with its children processed
   */
	visitItem(item: Item, context: VisitorContext): Item {
		if (isNode(item)) {
			const attrs = Object.entries(item.value)
			return { ...item, value: Object.fromEntries(attrs.map(member => {
				const result = this.visit(member, context);
				return result ?? member;
			}))};
		}
		if (isList(item)) {
			const list = item.value as Item[];
			return { ...item, value: list.map(item => this.visitItem(item, context)) };
		}
		return item;
  }
}

