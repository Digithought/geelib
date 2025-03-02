import type { TokenStream, RepeatCount, RepeatRange } from './types';
import type { Item, Node, List, Text } from "./ast/ast";
import { isNode, isList } from "./ast/ast-helpers";
import { ParserContext } from './parser-context';
import type { Definition } from './definition';
import { Associativity } from './definition';
import type { OptimizedGrammar } from './grammar';

export class Parser {
  /**
   * Creates a new Parser instance
   *
   * @param grammar The grammar to use for parsing
   */
  constructor(public readonly grammar: OptimizedGrammar) {
  }

  /**
   * Parse input using the grammar
   *
   * @param reader Token stream to parse
   * @returns Parsed item or null if parsing failed
   */
  parse(reader: TokenStream): Item | null {
    const context = new ParserContext(reader, false, this.grammar.options);
    context.pushResults();
    if (this.parseDefinitionGroup(context, this.grammar.root, null)) {
      return context.result;
    }
    return null;
  }

  /**
   * Check if input matches the grammar
   *
   * @param reader Token stream to check
   * @returns True if the input matches the grammar
   */
  matches(reader: TokenStream): boolean {
    const context = new ParserContext(reader, true, this.grammar.options);
    context.pushResults();
    return this.parseDefinitionGroup(context, this.grammar.root, null);
  }

  private parseDefinitionGroup(context: ParserContext, definitionName: string, referencer: Node | null): boolean {
    const group = this.grammar.definitions[definitionName];
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

    // Sort definitions by precedence and handle associativity
    const orderedDefinitions = Array.from(group.definitions).sort((a: Definition, b: Definition) => {
      // First sort by precedence (higher precedence first)
      if (b.precedence !== a.precedence) {
        return b.precedence - a.precedence;
      }

      // If same precedence, sort by associativity
      // Right associative definitions should come before left associative ones
      if (a.associativity === Associativity.Right && b.associativity === Associativity.Left) {
        return -1;
      } else if (a.associativity === Associativity.Left && b.associativity === Associativity.Right) {
        return 1;
      }

      return 0;
    });

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
      success = this.parseSequence(context, definition.instance.attributes['Sequence'] as List);
      if (success) {
        if (isNode) {
          const node = context.result as Node;
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
      default:
        throw new Error(`Invalid grammar: Invalid expression node type (${expressionType})`);
    }
  }

  private parseRepeatExpression(context: ParserContext, node: Node): boolean {
    const expression = node.attributes['Expression'] as Node;
    const count = node.attributes['Count'] as Node | undefined;
    const range = node.attributes['Range'] as Node | undefined;
    let found = false;
    let iterations = 0;

    context.beginTransaction();

    try {
      while (true) {
        const oldPosition = context.reader.position;

        // Check count/range constraints
        if (count) {
          const countAttr = count.attributes['Value'] as Text;
          if (!countAttr || !('value' in countAttr)) {
            throw new Error('Count node missing Value attribute');
          }
          const countValue = parseInt(countAttr.value);
          if (iterations >= countValue) break;
        }
        if (range) {
          const toAttr = range.attributes['To'] as Text;
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
        const fromAttr = range.attributes['From'] as Text;
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
    const expression = node.attributes['Expression'] as Node;
    let success = false;

    context.beginTransaction();
    try {
      success = this.parseExpression(context, expression);
      if (success) {
        context.rollbackResult();
        context.append({ type: 'capture', attributes: { Expression: context.result } } as Node);
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
    const expression = node.attributes['Expression'] as Node;
    const separator = node.attributes['Separator'] as Node;
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
    const expression = node.attributes['Expression'] as Node;
    const notExpression = node.attributes['NotExpression'] as Node;
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
    const expression = node.attributes['Expression'] as Node;
    const value = ((node.attributes['Value'] as Node).attributes['String'] as Node).attributes['Value'] as Text;
    let success = false;

    context.beginTransaction();
    try {
      success = this.parseExpression(context, expression);
      if (success) {
        context.rollbackResult();
        context.append({ type: 'text', value: value.value } as Text);
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
    const name = node.attributes['Name'] as Text;
    const expression = node.attributes['Expression'] as Node;
    let success = false;

    context.beginTransaction();
    try {
      success = this.parseExpression(context, expression);
      if (success) {
        const result = context.result;
        context.rollbackResult();
        context.append({ type: 'declaration', attributes: { Name: name, Expression: result } } as Node);
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
    const expressions = (node.attributes['Expressions'] as List).items;
    for (const expression of expressions) {
      if (this.parseExpression(context, expression as Node)) {
        return true;
      }
    }
    return false;
  }

  private parseGroupExpression(context: ParserContext, node: Node): boolean {
    return this.parseSequence(context, node.attributes['Sequence'] as List);
  }

  private parseOptionalGroupExpression(context: ParserContext, node: Node): boolean {
    this.parseSequence(context, node.attributes['Sequence'] as List);
    return true;
  }

  private parseReferenceExpression(context: ParserContext, node: Node): boolean {
    const referenceName = (node.attributes['Name'] as Node).attributes['Value'] as Text;
    const grammarName = node.attributes['GrammarName'] as Text;

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
    const from = this.getCharValue(node.attributes['From'] as Node);
    const to = this.getCharValue(node.attributes['To'] as Node);

    if (char >= from && char <= to) {
      context.append({ type: 'text', value: char } as Text);
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
      context.append({ type: 'text', value: char } as Text);
      context.reader.next();
      return true;
    }
    return false;
  }

  private parseStringExpression(context: ParserContext, node: Node): boolean {
    const target = (node.attributes['Text'] as Text).value;
    let success = true;

    context.beginTransaction();
    try {
			for (let index = 0; success && (index < target.length); index++)
				success &&= (!context.reader.eof && (target[index] == context.reader.readThenNext()));
    } catch (error) {
      context.rollbackTransaction();
      throw error;
    }

		if (success) {
			context.append({ type: 'text', value: target } as Text);
			context.commitTransaction();
		} else {
			context.rollbackTransaction();
		}

    return success;
  }

  private parseCharSetExpression(context: ParserContext, node: Node): boolean {
    if (context.reader.eof) return false;

    const char = context.reader.read();
    const isAll = node.attributes['All'] as Node | undefined;
    const isNot = node.attributes['Not'] as Node | undefined;
    let matches = false;

    // Handle the "All" case - matches any character
    if (isAll) {
      matches = true;
    } else {
      // Handle the Entries case
      const entries = node.attributes['Entries'] as List;
			matches = entries.items.some(entry => {
				const entryNode = entry as Node;
				if (entryNode.type === 'range') {
					const from = this.getCharValue(entryNode.attributes['From'] as Node);
					const to = this.getCharValue(entryNode.attributes['To'] as Node);
					return char >= from && char <= to;
				} else {
					return char === this.getCharValue(entryNode);
				}
			});
    }

    // Apply the Not modifier if present
    if (isNot) {
      matches = !matches;
    }

    if (matches) {
      context.append({ type: 'text', value: char } as Text);
      context.reader.next();
    }
    return matches;
  }

  private getCharValue(node: Node): string {
    // Handle the '#' Index : digit* format
    const index = node.attributes['Index'] as Text;
    if (index && 'value' in index) {
      return String.fromCharCode(parseInt(index.value));
    }
		// Handle the Literal : ('''''' as '''' | {?}) format
    const charValue = node.attributes['Literal'] as Text;
    return charValue.value;
  }

  private createNode(type: string): Node {
    return {
      type: type as any,
      attributes: {},
    };
  }

  private getExpressionType(node: Node): string {
    const keys = Object.keys(node.attributes);
    if (keys.length === 0) throw new Error('Node has no attributes');
    const type = keys[0];
    if (!type) throw new Error('Node has no expression type');
    return type;
  }

  private containsDeclaration(node: Node): boolean {
    if (node.type === 'declaration') return true;

    const values = Object.values(node.attributes);
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
}
