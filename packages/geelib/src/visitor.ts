import type { Node, List, Item } from './types.js';
import { isNode, isList } from './types.js';

export interface VisitorContext {
  whitespaceRule?: string;
  [key: string]: any;
}

export interface VisitorRule {
  name: string;
  nodeType?: string;
  visit(node: Node, context: VisitorContext): Node | null;
}

export class NodeVisitor {
  private typeRules: Map<string, VisitorRule[]> = new Map();
  private globalRules: VisitorRule[] = [];

  addRule(rule: VisitorRule): void {
    if (rule.nodeType) {
      let rules = this.typeRules.get(rule.nodeType);
      if (!rules) {
        rules = [];
        this.typeRules.set(rule.nodeType, rules);
      }
      rules.push(rule);
    } else {
      this.globalRules.push(rule);
    }
  }

  visit(node: Node, context: VisitorContext = {}): Node {
    let current = node;
    const typeRules = this.typeRules.get(current.type);
    if (typeRules) {
      for (const rule of typeRules) {
        const result = rule.visit(current, context);
        if (result) {
          current = result;
        }
      }
    }

    for (const rule of this.globalRules) {
      const result = rule.visit(current, context);
      if (result) {
        current = result;
      }
    }

    const newAttributes = new Map<string, Item>();
    for (const [key, value] of current.attributes.entries()) {
      let newValue: Item | undefined;

      if (isNode(value)) {
        newValue = this.visit(value, context);
      } else if (isList(value)) {
        const list = value as List;
        newValue = {
          type: 'list',
          items: list.items.map(item =>
            isNode(item) ? this.visit(item, context) : item
          ),
          attributes: list.attributes
        };
      } else if (value) {
        newValue = value;
      }

      if (newValue) {
        newAttributes.set(key, newValue);
      }
    }

    return { ...current, attributes: newAttributes };
  }
}

