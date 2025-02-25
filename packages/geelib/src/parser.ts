import type { Item, Node, TokenStream, List, Text, RepeatCount, RepeatRange } from './types';
import { isNode, isList } from './types';
import { ParserContext } from './parser-context';
import { DefinitionGroups } from './definition';
import type { Definition } from './definition';
import { first } from './it-first';

export class Parser {
  private options: { whitespaceRule?: string; caseSensitive?: boolean };

  constructor(
    private definitions: DefinitionGroups,
    options?: { whitespaceRule?: string; caseSensitive?: boolean }
  ) {
    this.options = options ?? {};
  }

  parse(reader: TokenStream, root?: string): Item | null {
    const rootName = root ?? first(this.definitions.keys());
		if (!rootName) throw new Error('At least one definition is required');

    const context = new ParserContext(reader, false, this.options);
    context.pushResults();
    if (this.parseDefinitionGroup(context, rootName, null)) {
      return context.result;
    }
    return null;
  }

  matches(reader: TokenStream, root: string): boolean {
    const rootName = root ?? first(this.definitions.keys());
		if (!rootName) throw new Error('At least one definition is required');

    const context = new ParserContext(reader, true, this.options);
    context.pushResults();
    return this.parseDefinitionGroup(context, rootName, null);
  }

  private parseDefinitionGroup(context: ParserContext, definitionName: string, referencer: Node | null): boolean {
    const group = this.definitions.get(definitionName);
    if (!group) return false;

    // Determine minimum precedence based on reference
    let minPrecedence = 0;
    if (referencer && group.referenceMinPrecedents.has(referencer)) {
      minPrecedence = group.referenceMinPrecedents.get(referencer)!;
    }

    let bestPosition = context.reader.position;
    let bestResult: Item | null = null;
    let anySucceeded = false;
    const leftRecursive = group.isLeftRecursive();
    const orderedDefinitions = Array.from(group.definitions).sort((a, b) => b.precedence - a.precedence);

    // Try each definition in descending order of precedence
    for (let index = 0; index < orderedDefinitions.length; index++) {
      const definition = orderedDefinitions[index];
      if (!definition) continue;

      if (definition.precedence >= minPrecedence || !definition.isLeftRecursive()) {
        let success = false;
        context.pushPosition();
        context.pushResult(this.createNode(definitionName));

        try {
          success = this.parseDefinition(context, definition);
          anySucceeded ||= success;
          success &&= context.reader.position > bestPosition;
          if (success) {
            bestPosition = context.reader.position;
            bestResult = context.result;
          }
        } finally {
          context.rollbackPosition();
          context.rollbackResult();
        }

        if (leftRecursive && success) {
          context.cacheReset();
          index = -1; // Will be incremented to 0
        }
      }
    }

    if (anySucceeded) {
      if (bestResult) {
        context.append(bestResult);
      }
      context.reader.position = bestPosition;
      return true;
    }
    return false;
  }

  private parseDefinition(context: ParserContext, definition: Definition): boolean {
    // Filter check
    if (definition.filter?.isExclusive && !context.reader.eof) {
      const char = context.reader.read();
      if (!definition.filter.charSet.matches(char)) {
        return false;
      }
    }

    const isNode = this.containsDeclaration(definition.instance);
    let success = false;
    const oldPosition = context.reader.position;

    context.cacheStart(definition.name);
    context.beginTransaction();

    try {
      success = this.parseSequence(context, definition.instance.attributes.get('Sequence') as List);
      if (success) {
        if (isNode) {
          const node = this.toNode(context.result);
          this.setParentReferences(node);
          context.rollbackResult();
          context.pushResults();
          context.append(node);
        }
        context.cacheSucceed(definition.name, oldPosition, context.reader.position, context.result);
        context.commitTransaction();
      } else {
        context.cacheFail(definition.name, oldPosition);
        context.rollbackTransaction();
      }
    } catch (error) {
      context.rollbackTransaction();
      throw error;
    }

    return success;
  }

  private parseSequence(context: ParserContext, sequence: List): boolean {
    if (sequence.items.length === 1) {
      return this.parseExpression(context, sequence.items[0] as Node);
    }

    context.beginTransaction();
    let success = true;

    try {
      for (const item of sequence.items) {
        success = this.parseExpression(context, item as Node);
        if (!success) {
          context.rollbackTransaction();
          return false;
        }
      }
      context.commitTransaction();
    } catch (error) {
      context.rollbackTransaction();
      throw error;
    }

    return true;
  }

  private parseExpression(context: ParserContext, node: Node): boolean {
    const expressionType = this.getExpressionType(node);
    switch (expressionType) {
      case 'repeat': return this.parseRepeatExpression(context, node);
      case 'separated': return this.parseSeparatedRepeatExpression(context, node);
      case 'andNot': return this.parseAndNotExpression(context, node);
      case 'as': return this.parseAsExpression(context, node);
      case 'declaration': return this.parseDeclarationExpression(context, node);
      case 'or': return this.parseOrExpression(context, node);
      case 'group': return this.parseGroupExpression(context, node);
      case 'optional': return this.parseOptionalGroupExpression(context, node);
      case 'reference': return this.parseReferenceExpression(context, node);
      case 'range': return this.parseRangeExpression(context, node);
      case 'char': return this.parseCharExpression(context, node);
      case 'string': return this.parseStringExpression(context, node);
      case 'charSet': return this.parseCharSetExpression(context, node);
      case 'capture': return this.parseCaptureExpression(context, node);
      case 'quote': return this.parseQuoteExpression(context, node);
      default:
        throw new Error(`Invalid grammar: Invalid expression node type (${expressionType})`);
    }
  }

  private parseRepeatExpression(context: ParserContext, node: Node): boolean {
    const expression = node.attributes.get('Expression') as Node;
    const count = node.attributes.get('Count') as Node | undefined;
    const range = node.attributes.get('Range') as Node | undefined;
    let found = false;
    let iterations = 0;

    context.beginTransaction();

    try {
      while (true) {
        const oldPosition = context.reader.position;

        // Check count/range constraints
        if (count) {
          const countAttr = count.attributes.get('Value') as Text;
          if (!countAttr || !('value' in countAttr)) {
            throw new Error('Count node missing Value attribute');
          }
          const countValue = parseInt(countAttr.value);
          if (iterations >= countValue) break;
        }
        if (range) {
          const toAttr = range.attributes.get('To') as Text;
          if (!toAttr || !('value' in toAttr)) {
            throw new Error('Range node missing To attribute');
          }
          const to = toAttr.value;
          if (to !== 'n' && iterations >= parseInt(to)) break;
        }

        const success = this.parseExpression(context, expression);
        if (!success || context.reader.position === oldPosition) break;

        found = true;
        iterations++;
      }

      // Validate minimum iterations
      if (range) {
        const fromAttr = range.attributes.get('From') as Text;
        if (!fromAttr || !('value' in fromAttr)) {
          throw new Error('Range node missing From attribute');
        }
        const from = parseInt(fromAttr.value);
        if (iterations < from) {
          context.rollbackTransaction();
          return false;
        }
      }

      if (found) {
        context.commitTransaction();
      } else {
        context.rollbackTransaction();
      }
    } catch (error) {
      context.rollbackTransaction();
      throw error;
    }

    return found;
  }

  private parseCaptureExpression(context: ParserContext, node: Node): boolean {
    const expression = node.attributes.get('Expression') as Node;
    let success = false;

    context.beginTransaction();
    try {
      success = this.parseExpression(context, expression);
      if (success) {
        const result = context.result;
        context.rollbackResult();
        context.append({ type: 'capture', attributes: new Map([['value', result]]) });
        context.commitTransaction();
      } else {
        context.rollbackTransaction();
      }
    } catch (error) {
      context.rollbackTransaction();
      throw error;
    }

    return success;
  }

  private parseSeparatedRepeatExpression(context: ParserContext, node: Node): boolean {
    const expression = node.attributes.get('Expression') as Node;
    const separator = node.attributes.get('Separator') as Node;
    let first = true;
    let anyFound = false;

    context.beginTransaction();

    try {
      while (true) {
        const oldPosition = context.reader.position;
        let found = false;

        context.beginTransaction();

        try {
          let separatorSatisfied = true;
          if (!first) {
            context.beginTransaction();
            try {
              separatorSatisfied = this.parseExpression(context, separator);
            } finally {
              if (!separatorSatisfied) {
                context.rollbackTransaction();
              } else {
                context.commitTransaction();
              }
            }
          } else {
            first = false;
          }

          if (separatorSatisfied) {
            found = this.parseExpression(context, expression);
            anyFound ||= found;
          }

          if (!found || context.reader.position === oldPosition) {
            context.rollbackTransaction();
            break;
          }
          context.commitTransaction();
        } catch (error) {
          context.rollbackTransaction();
          throw error;
        }
      }

      if (anyFound) {
        context.commitTransaction();
      } else {
        context.rollbackTransaction();
      }
    } catch (error) {
      context.rollbackTransaction();
      throw error;
    }

    return anyFound;
  }

  private parseAndNotExpression(context: ParserContext, node: Node): boolean {
    const expression = node.attributes.get('Expression') as Node;
    const notExpression = node.attributes.get('NotExpression') as Node;
    let success: boolean;

    context.beginTransaction();
    try {
      success = this.parseExpression(context, notExpression);
      context.rollbackTransaction();
      if (success) return false;
    } catch (error) {
      context.rollbackTransaction();
      throw error;
    }

    return this.parseExpression(context, expression);
  }

  private parseAsExpression(context: ParserContext, node: Node): boolean {
    const expression = node.attributes.get('Expression') as Node;
    const value = (node.attributes.get('Value') as Node).attributes.get('Value') as Text;
    let success = false;

    context.beginTransaction();
    try {
      success = this.parseExpression(context, expression);
      if (success) {
        context.rollbackResult();
        context.append({ type: 'text', value: value.value, attributes: new Map() });
        context.commitTransaction();
      } else {
        context.rollbackTransaction();
      }
    } catch (error) {
      context.rollbackTransaction();
      throw error;
    }

    return success;
  }

  private parseDeclarationExpression(context: ParserContext, node: Node): boolean {
    const name = (node.attributes.get('Name') as Node).attributes.get('Value') as Text;
    const expression = node.attributes.get('Expression') as Node;
    let success = false;

    context.beginTransaction();
    try {
      success = this.parseExpression(context, expression);
      if (success) {
        const result = context.result;
        context.rollbackResult();
        context.append({ type: 'declaration', attributes: new Map([['name', name], ['value', result]]) });
        context.commitTransaction();
      } else {
        context.rollbackTransaction();
      }
    } catch (error) {
      context.rollbackTransaction();
      throw error;
    }

    return success;
  }

  private parseOrExpression(context: ParserContext, node: Node): boolean {
    const expressions = (node.attributes.get('Expressions') as List).items;
    for (const expression of expressions) {
      if (this.parseExpression(context, expression as Node)) {
        return true;
      }
    }
    return false;
  }

  private parseGroupExpression(context: ParserContext, node: Node): boolean {
    return this.parseSequence(context, node.attributes.get('Sequence') as List);
  }

  private parseOptionalGroupExpression(context: ParserContext, node: Node): boolean {
    this.parseSequence(context, node.attributes.get('Sequence') as List);
    return true;
  }

  private parseReferenceExpression(context: ParserContext, node: Node): boolean {
    const referenceName = (node.attributes.get('Name') as Node).attributes.get('Value') as Text;
    const grammarName = node.attributes.get('GrammarName') as Text;

    // Handle cross-grammar references
    if (grammarName) {
      // TODO: Implement cross-grammar reference resolution
      throw new Error('Cross-grammar references not yet implemented');
    }

    const cacheResult = context.cacheSeek(referenceName.value);
    if (cacheResult !== null) {
      return cacheResult;
    }
    return this.parseDefinitionGroup(context, referenceName.value, node);
  }

  private parseRangeExpression(context: ParserContext, node: Node): boolean {
    if (context.reader.eof) return false;

    const char = context.reader.read();
    const from = this.getCharValue(node.attributes.get('From') as Node);
    const to = this.getCharValue(node.attributes.get('To') as Node);

    if (char >= from && char <= to) {
      context.append({ type: 'text', value: char, attributes: new Map() });
      context.reader.next();
      return true;
    }
    return false;
  }

  private parseCharExpression(context: ParserContext, node: Node): boolean {
    if (context.reader.eof) return false;

    const char = context.reader.read();
    const target = this.getCharValue(node);

    if (char === target) {
      context.append({ type: 'text', value: char, attributes: new Map() });
      context.reader.next();
      return true;
    }
    return false;
  }

  private parseStringExpression(context: ParserContext, node: Node): boolean {
    const target = (node.attributes.get('Value') as Text).value;
    const escapeMap = this.getEscapeMap(node);
    let success = true;

    context.beginTransaction();
    try {
      let i = 0;
      while (success && i < target.length) {
        if (context.reader.eof) {
          success = false;
          break;
        }

        const char = context.reader.read();
        if (escapeMap && i < target.length - 1) {
          // Check for escape sequence
          const sequence = target.substring(i, i + 2);
          const replacement = escapeMap.get(sequence);
          if (replacement) {
            success = char === replacement;
            i += 2;
          } else {
            success = char === target[i];
            i++;
          }
        } else {
          success = char === target[i];
          i++;
        }

        if (success) {
          context.reader.next();
        }
      }

      if (success) {
        context.append({ type: 'text', value: target, attributes: new Map() });
        context.commitTransaction();
      } else {
        context.rollbackTransaction();
      }
    } catch (error) {
      context.rollbackTransaction();
      throw error;
    }

    return success;
  }

  private parseCharSetExpression(context: ParserContext, node: Node): boolean {
    if (context.reader.eof) return false;

    const char = context.reader.read();
    const isAll = node.attributes.has('All');
    const isNot = node.attributes.has('Not');
    let matches = isAll;

    if (!isAll) {
      const entries = node.attributes.get('Entries') as List;
      matches = entries.items.some(entry => {
        const entryNode = entry as Node;
        if (entryNode.type === 'range') {
          const from = this.getCharValue(entryNode.attributes.get('From') as Node);
          const to = this.getCharValue(entryNode.attributes.get('To') as Node);
          return char >= from && char <= to;
        } else {
          return char === this.getCharValue(entryNode);
        }
      });
    }

    matches = matches !== isNot;
    if (matches) {
      context.append({ type: 'text', value: char, attributes: new Map() });
      context.reader.next();
    }
    return matches;
  }

  private parseQuoteExpression(context: ParserContext, node: Node): boolean {
    const textAttr = node.attributes.get('Text') as Text;
    if (!textAttr || !('value' in textAttr)) {
      throw new Error('Quote node missing Text attribute');
    }
    const text = textAttr.value;
    let success = true;

    context.beginTransaction();
    try {
      // Handle whitespace before if whitespace rule is defined
      if (context.whitespaceRule) {
        success = this.parseDefinitionGroup(context, context.whitespaceRule, null);
        if (!success) {
          context.rollbackTransaction();
          return false;
        }
      }

      // Match the actual text with case sensitivity based on grammar options
      for (let i = 0; success && i < text.length; i++) {
        if (context.reader.eof) {
          success = false;
          break;
        }

        const char = context.reader.read();
        if (context.caseSensitive) {
          success = char === text[i];
        } else {
          success = char.toLowerCase() === text[i]!.toLowerCase();
        }

        if (success) {
          context.reader.next();
        }
      }

      // Handle whitespace after if whitespace rule is defined
      if (success && context.whitespaceRule) {
        success = this.parseDefinitionGroup(context, context.whitespaceRule, null);
      }

      if (success) {
        context.append({ type: 'text', value: text, attributes: new Map() });
        context.commitTransaction();
      } else {
        context.rollbackTransaction();
      }
    } catch (error) {
      context.rollbackTransaction();
      throw error;
    }

    return success;
  }

  private getCharValue(node: Node): string {
    const index = node.attributes.get('Index');
    if (index && 'value' in index) {
      return String.fromCharCode(parseInt((index as Text).value));
    }
    const charValue = node.attributes.get('Char');
    if (!charValue || !('value' in charValue)) {
      throw new Error('Node has no valid Char attribute');
    }
    return (charValue as Text).value;
  }

  private createNode(type: string): Node {
    return {
      type: type as any,
      attributes: new Map(),
      parent: undefined
    };
  }

  private setParentReferences(node: Node): void {
    const values = Array.from(node.attributes.values());
    for (const value of values) {
      if (isNode(value)) {
        value.parent = node;
        this.setParentReferences(value);
      } else if (isList(value)) {
        const list = value as List;
        for (const item of list.items) {
          if (isNode(item)) {
            item.parent = node;
            this.setParentReferences(item);
          }
        }
      }
    }
  }

  private getExpressionType(node: Node): string {
    const keys = Array.from(node.attributes.keys());
    if (keys.length === 0) throw new Error('Node has no attributes');
    const type = keys[0];
    if (!type) throw new Error('Node has no expression type');
    return type;
  }

  private containsDeclaration(node: Node): boolean {
    if (node.type === 'declaration') return true;

    const values = Array.from(node.attributes.values());
    for (const value of values) {
      if (isNode(value)) {
        if (this.containsDeclaration(value)) return true;
      } else if (isList(value)) {
        const list = value as List;
        for (const item of list.items) {
          if (isNode(item) && this.containsDeclaration(item)) return true;
        }
      }
    }

    return false;
  }

  private toNode(item: Item): Node {
    // Implementation of node conversion logic
    return item as Node;
  }

  private getEscapeMap(node: Node): Map<string, string> | undefined {
    // Look for any 'as' expressions in parent nodes
    const escapeMap = new Map<string, string>();
    let current: Node = node;

    while (current) {
      if (current.type === 'as') {
        const expr = current.attributes.get('Expression') as Node;
        const value = current.attributes.get('Value') as Node;
        if (expr?.type === 'string' && value?.type === 'string') {
          const fromAttr = expr.attributes.get('Value') as Text;
          const toAttr = value.attributes.get('Value') as Text;
          if (fromAttr && 'value' in fromAttr && toAttr && 'value' in toAttr) {
            escapeMap.set(fromAttr.value, toAttr.value);
          }
        }
      }
      if (!current.parent) break;
      current = current.parent;
    }

    return escapeMap.size > 0 ? escapeMap : undefined;
  }
}
