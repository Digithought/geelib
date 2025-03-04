import { CharSet } from './types.js';
import type { Node, List, Text } from "./ast/ast.js";
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
    // If the instance is not a sequence, handle it directly
    if (definition.instance.type !== 'sequence') {
      return this.determineExpression(definition.instance);
    }

    const sequence = definition.instance.attributes['Sequence'] as List;
    if (!sequence) {
      return null;
    }
    return this.determineSequence(sequence);
  }

  private determineSequence(sequence: List): Filter | null {
    if (!sequence || !sequence.items) {
      return null;
    }

    const result: Filter = {
      charSet: new CharSet(),
      isExclusive: true
    };

    for (const item of sequence.items) {
      const expressionFilter = this.determineExpression(item as Node);
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
    switch (node.type) {
      case 'repeat':
      case 'separated':
      case 'andNot':
      case 'as':
      case 'declaration': {
        const expr = node.attributes['Expression'] as Node;
        return this.determineExpression(expr);
      }

      case 'or': {
        const result: Filter = {
          charSet: new CharSet(),
          isExclusive: true
        };

        const expressions = (node.attributes['Expressions'] as List).items;
        for (const expr of expressions) {
          const exprFilter = this.determineExpression(expr as Node);
          if (exprFilter) {
            result.charSet.union(exprFilter.charSet);
            result.isExclusive &&= exprFilter.isExclusive;
          }
        }

        return result;
      }

      case 'group':
      case 'optional': {
        const sequence = node.attributes['Sequence'] as List;
        const result = this.determineSequence(sequence);
        if (node.type === 'optional' && result) {
          result.isExclusive = false;
        }
        return result;
      }

      case 'reference': {
        const nameNode = node.attributes['Name'] as Node;
        if (!nameNode || !nameNode.attributes || !nameNode.attributes['Value']) {
          return null;
        }

        const name = nameNode.attributes['Value'] as Text;
        if (!name || !name.value) {
          return null;
        }

        const targetGroup = this.definitions[name.value];
        if (!targetGroup) return null;

        // If would recurse, add as fixup
        if (this.evaluating.has(name.value)) {
          let sources = this.fixups.get(name.value);
          if (!sources) {
            sources = new Set();
            this.fixups.set(name.value, sources);
          }
          for (const evaluating of Array.from(this.evaluating)) {
            if (evaluating !== name.value) {
              sources.add(evaluating);
            }
          }
          return null;
        }

        this.determineGroup(name.value);
        return targetGroup.filter || null;
      }

      case 'range': {
        const from = this.getCharValue(node.attributes['From'] as Node);
        const to = this.getCharValue(node.attributes['To'] as Node);
        return {
          charSet: new CharSet({ low: from.charCodeAt(0), high: to.charCodeAt(0) }),
          isExclusive: true
        };
      }

      case 'char': {
        const char = this.getCharValue(node);
        const code = char.charCodeAt(0);
        return {
          charSet: new CharSet({ low: code, high: code }),
          isExclusive: true
        };
      }

      case 'string': {
        const value = (node.attributes['Value'] as Text).value;
        if (!value || value.length === 0) return null;

        // We know value has at least one character since we checked length
        const code = value.charCodeAt(0);
        return {
          charSet: new CharSet({
            low: code,
            high: code
          }),
          isExclusive: true
        };
      }

      case 'charSet': {
        const result: Filter = {
          charSet: new CharSet(),
          isExclusive: true
        };

        const isAll = node.attributes['All'];
        const isNot = node.attributes['Not'];

        if (isAll) {
          result.charSet.union({ low: 0, high: 0xFFFF });
        } else {
          const entries = node.attributes['Entries'] as List;
          for (const entry of entries.items) {
            const entryNode = entry as Node;
            if (entryNode.type === 'range') {
              const from = this.getCharValue(entryNode.attributes['From'] as Node);
              const to = this.getCharValue(entryNode.attributes['To'] as Node);
              result.charSet.union({
                low: from.charCodeAt(0),
                high: to.charCodeAt(0)
              });
            } else {
              const char = this.getCharValue(entryNode);
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
    const index = node.attributes['Index'];
    if (index && 'value' in index) {
      return String.fromCharCode(parseInt((index as Text).value));
    }
    const charValue = node.attributes['Char'];
    if (!charValue || !('value' in charValue)) {
      throw new Error('Node has no valid Char attribute');
    }
    return (charValue as Text).value;
  }
}
