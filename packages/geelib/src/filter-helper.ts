import { CharSet } from './types.js';
import type { Node, List, Text, Item } from "./ast/ast.js";
import { isNode, isList, singleMember, getAttribute, getTextValue } from "./ast/ast.js";
import type { DefinitionGroups } from './definition.js';
import type { Filter } from './definition.js';

interface FilterContext {
  evaluating: Set<string>;
  fixups: Map<string, Set<string>>;
}

export class FilterHelper {
  private evaluating = new Set<string>();
  private fixups = new Map<string, Set<string>>();

  constructor(private definitions: DefinitionGroups) {}

  determine(): void {
    // Main pass
    for (const groupName of Array.from(Object.keys(this.definitions))) {
      this.determineGroup(groupName);
    }

    // Resolve fixups
    for (const [targetName, sources] of Array.from(this.fixups.entries())) {
      const targetGroup = this.definitions[targetName];
      if (!targetGroup) continue;

      for (const sourceName of Array.from(sources)) {
        const sourceGroup = this.definitions[sourceName];
        if (!sourceGroup) continue;

        if (sourceGroup.filter && targetGroup.filter) {
          targetGroup.filter.charSet.union(sourceGroup.filter.charSet);
        }
      }
    }
  }

  private determineGroup(groupName: string): void {
    const group = this.definitions[groupName];
    if (!group || group.filter) return;

    const filter: Filter = {
      charSet: new CharSet(),
      isExclusive: true
    };

    this.evaluating.add(groupName);
    try {
      for (const definition of Array.from(group.definitions)) {
        const defFilter = this.determineDefinition(definition);
        if (defFilter) {
          filter.charSet.union(defFilter.charSet);
          filter.isExclusive &&= defFilter.isExclusive;
        }
      }
    } finally {
      this.evaluating.delete(groupName);
    }

    group.filter = filter;
  }

  private determineDefinition(definition: { instance: Node }): Filter | null {
    // Get the node type from the first member
    const member = singleMember(definition.instance);
    if (member) {
      // If the instance is not a sequence, handle it directly
      if (member[0] !== 'Sequence') {
        return this.determineExpression(definition.instance);
      }
    }

    const sequence = definition.instance.value['Sequence'] as List;
    if (!sequence) {
      return null;
    }
    return this.determineSequence(sequence);
  }

  private determineSequence(sequence: List): Filter | null {
    if (!sequence || !sequence.value) {
      return null;
    }

    const result: Filter = {
      charSet: new CharSet(),
      isExclusive: true
    };

    for (const item of sequence.value) {
      if (!isNode(item)) continue;

      const expressionFilter = this.determineExpression(item);
      if (expressionFilter) {
        result.charSet.union(expressionFilter.charSet);
        result.isExclusive &&= expressionFilter.isExclusive;
      }
      if (result.isExclusive) {
        return result;
      }
    }

    result.isExclusive = false;
    return result;
  }

  private determineExpression(node: Node): Filter | null {
    // Get the node type from the first member
    const member = singleMember(node);
    if (!member) return null;

    const nodeType = member[0];

    switch (nodeType) {
      case 'Repeat':
      case 'Separated':
      case 'AndNot':
      case 'As':
      case 'Declaration': {
        const expr = node.value['Expression'] as Node;
        if (!expr) return null;
        return this.determineExpression(expr);
      }

      case 'Or': {
        const result: Filter = {
          charSet: new CharSet(),
          isExclusive: true
        };

        const expressions = node.value['Expressions'] as List;
        if (!expressions || !isList(expressions)) return null;

        for (const expr of expressions.value) {
          if (!isNode(expr)) continue;

          const exprFilter = this.determineExpression(expr);
          if (exprFilter) {
            result.charSet.union(exprFilter.charSet);
            result.isExclusive &&= exprFilter.isExclusive;
          }
        }

        return result;
      }

      case 'Group':
      case 'Optional': {
        const sequence = node.value['Sequence'] as List;
        if (!sequence) return null;

        const result = this.determineSequence(sequence);
        if (nodeType === 'Optional' && result) {
          result.isExclusive = false;
        }
        return result;
      }

      case 'Reference': {
        const nameNode = node.value['Name'] as Node;
        if (!nameNode) return null;

        const nameValue = getTextValue(nameNode, 'Value');
        if (!nameValue) return null;

        const targetGroup = this.definitions[nameValue];
        if (!targetGroup) return null;

        // If would recurse, add as fixup
        if (this.evaluating.has(nameValue)) {
          let sources = this.fixups.get(nameValue);
          if (!sources) {
            sources = new Set();
            this.fixups.set(nameValue, sources);
          }
          for (const evaluating of Array.from(this.evaluating)) {
            if (evaluating !== nameValue) {
              sources.add(evaluating);
            }
          }
          return null;
        }

        this.determineGroup(nameValue);
        return targetGroup.filter || null;
      }

      case 'Range': {
        const from = this.getCharValue(node.value['From'] as Node);
        const to = this.getCharValue(node.value['To'] as Node);
        return {
          charSet: new CharSet({ low: from.charCodeAt(0), high: to.charCodeAt(0) }),
          isExclusive: true
        };
      }

      case 'Char': {
        const char = this.getCharValue(node);
        const code = char.charCodeAt(0);
        return {
          charSet: new CharSet({ low: code, high: code }),
          isExclusive: true
        };
      }

      case 'String': {
        const valueText = getTextValue(node, 'Value');
        if (!valueText || valueText.length === 0) return null;

        // We know value has at least one character since we checked length
        const code = valueText.charCodeAt(0);
        return {
          charSet: new CharSet({
            low: code,
            high: code
          }),
          isExclusive: true
        };
      }

      case 'CharSet': {
        const result: Filter = {
          charSet: new CharSet(),
          isExclusive: true
        };

        const isAll = node.value['All'];
        const isNot = node.value['Not'];

        if (isAll) {
          result.charSet.union({ low: 0, high: 0xFFFF });
        } else {
          const entries = node.value['Entries'] as List;
          if (!entries || !isList(entries)) return null;

          for (const entry of entries.value) {
            if (!isNode(entry)) continue;

            const entryType = singleMember(entry)?.[0];
            if (entryType === 'range') {
              const from = this.getCharValue(entry.value['From'] as Node);
              const to = this.getCharValue(entry.value['To'] as Node);
              result.charSet.union({
                low: from.charCodeAt(0),
                high: to.charCodeAt(0)
              });
            } else {
              const char = this.getCharValue(entry);
              const code = char.charCodeAt(0);
              result.charSet.union({ low: code, high: code });
            }
          }
        }

        if (isNot) {
          result.charSet.invert();
        }

        return result;
      }

      default:
        return null;
    }
  }

  private getCharValue(node: Node): string {
    const index = node.value['Index'];
    if (index) {
      return String.fromCharCode(parseInt((index as Text).value));
    }
    const literalValue = node.value['Literal'];
    if (!literalValue) {
      throw new Error('Node has no valid Char attribute');
    }
    return (literalValue as Text).value;
  }
}
