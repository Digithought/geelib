import type { Item } from "./ast/ast.js";
import { isNode, isList, type Member } from "./ast/ast.js";

export interface VisitorContext {
  whitespaceRule?: string;
  [key: string]: any;
}

export interface VisitorRule {
  name: string;
  memberName?: string | string[];
  visit(member: Member, context: VisitorContext): Member | undefined;
}

export class NodeVisitor {
  private typeRules: Map<string, VisitorRule[]> = new Map();
  private globalRules: VisitorRule[] = [];

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

