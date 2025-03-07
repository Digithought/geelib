import type { TokenStream } from './types.js';
import type { Item, Member } from "./ast/ast.js";
import { item, getAttribute, getRequiredAttribute, getTextValue, getRequiredTextValue } from './ast/ast.js';
import { ParserContext } from './parser-context.js';
import type { Definition } from './definition.js';
import { Associativity } from './definition.js';
import type { OptimizedGrammar } from './grammar.js';
import { GrammarError, ParserError } from './errors.js';

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
   * @returns Parsed item or undefined if parsing failed
   */
  parse(reader: TokenStream): Item | undefined {
    const context = new ParserContext(reader, false, this.grammar.options);
    return this.parseDefinitionGroup(context, this.grammar.root, null);
  }

  /**
   * Check if input matches the grammar
   *
   * @param reader Token stream to check
   * @returns True if the input matches the grammar
   */
  matches(reader: TokenStream): boolean {
    const context = new ParserContext(reader, true, this.grammar.options);
    return this.parseDefinitionGroup(context, this.grammar.root, null) !== undefined;
  }

  private parseDefinitionGroup(context: ParserContext, definitionName: string, referencer: Item | null): Item | undefined {
    const group = this.grammar.definitions[definitionName];
    if (!group) return undefined;

    // Determine minimum precedence based on reference
    let minPrecedence = 0;
    if (referencer && group.referenceMinPrecedents.has(referencer as any)) {
      minPrecedence = group.referenceMinPrecedents.get(referencer as any)!;
    }

    let bestPosition = context.reader.position;
    let bestResult: Item | undefined;
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
        const startPosition = context.reader.position;
        const result = this.parseDefinition(context, definition);

        if (result !== undefined) {
          anySucceeded = true;

          // Check if this result is better (consumed more input)
          if (context.reader.position > bestPosition) {
            bestPosition = context.reader.position;
            bestResult = result;
          }

          // Reset position for next attempt
          context.reader.position = startPosition;

          // If left recursive and we found a match, try again from the beginning
          if (leftRecursive) {
            context.cacheReset();
            index = -1; // Will be incremented to 0
          }
        }
      }
    }

    if (anySucceeded && bestResult) {
      context.reader.position = bestPosition;
      return bestResult;
    }

    return undefined;
  }

  private parseDefinition(context: ParserContext, definition: Definition): Item | undefined {
    // Filter check
    if (definition.filter?.isExclusive && !context.reader.eof) {
      const char = context.reader.read();
      if (!definition.filter.charSet.matches(char)) {
        return undefined;
      }
    }

    return context.parseCache(definition.name, () => {
      // Get the Sequence member
      const sequenceMember = getRequiredAttribute(definition.instance, 'Sequence',
        `Invalid grammar: Definition ${definition.name} missing Sequence`);

      // Parse the sequence
      const result = this.parseSequence(context, sequenceMember);

      // If successful and this is a node definition, wrap it
      if (result !== undefined) {
        const typeValue = getTextValue(definition.instance, 'Type');
        const isNodeDefinition = typeValue === ':=';

        if (isNodeDefinition) {
          // Create a record with the definition name as the type
          return item({ [definition.name]: result });
        }
      }

      return result;
    });
  }

  private parseSequence(context: ParserContext, member: Member): Item | undefined {
    const [, sequence] = member;

    if (Array.isArray(sequence.value) && sequence.value.length === 1) {
      const expr = sequence.value[0];
      if (expr) {
        // Use type assertion to fix type issue
        return this.parseExpression(context, ['expression', expr] as any);
      }
      return undefined;
    }

    return context.parseTransact(() => {
      const results: Item[] = [];

      if (!Array.isArray(sequence.value)) {
        return undefined;
      }

      for (const expr of sequence.value as Item[]) {
        // Use type assertion to fix type issue
        const result = this.parseExpression(context, ['expression', expr] as any);
        if (result === undefined) {
          return undefined;
        }
        results.push(result);
      }

      // Combine all results into a list
      if (results.length === 0) {
        return item([]);
      } else if (results.length === 1) {
        return results[0];
      } else {
        // Combine all items into a list
        return results.reduce((acc, curr) => context.combineItems(acc, curr));
      }
    });
  }

  private parseExpression(context: ParserContext, member: Member): Item | undefined {
    // Use type assertion to fix type issues
    const memberAsAny = member as any;
    const [, expr] = memberAsAny;
    const expressionType = this.getExpressionType(expr);

    switch (expressionType) {
      case 'repeat': return this.parseRepeatExpression(context, memberAsAny);
      case 'separated': return this.parseSeparatedRepeatExpression(context, memberAsAny);
      case 'andNot': return this.parseAndNotExpression(context, memberAsAny);
      case 'as': return this.parseAsExpression(context, memberAsAny);
      case 'declaration': return this.parseDeclarationExpression(context, memberAsAny);
      case 'or': return this.parseOrExpression(context, memberAsAny);
      case 'group': return this.parseGroupExpression(context, memberAsAny);
      case 'optional': return this.parseOptionalExpression(context, memberAsAny);
      case 'reference': return this.parseReferenceExpression(context, memberAsAny);
      case 'range': return this.parseRangeExpression(context, memberAsAny);
      case 'char': return this.parseCharExpression(context, memberAsAny);
      case 'string': return this.parseStringExpression(context, memberAsAny);
      case 'charSet': return this.parseCharSetExpression(context, memberAsAny);
      case 'capture': return this.parseCaptureExpression(context, memberAsAny);
      default:
        throw new GrammarError(`Invalid grammar: Invalid expression node type (${expressionType})`);
    }
  }

  private parseRepeatExpression(context: ParserContext, member: Member): Item | undefined {
    const [, exprItem] = member;
    const expressionMember = getRequiredAttribute(exprItem, 'Expression',
      'Invalid grammar: Repeat expression missing Expression');

    const count = getAttribute(exprItem, 'Count');
    const range = getAttribute(exprItem, 'Range');

    return context.parseTransact(() => {
      const results: Item[] = [];
      let iterations = 0;

      while (true) {
        const oldPosition = context.reader.position;

        // Check count/range constraints
        if (count) {
          const countValue = getTextValue(count[1], 'Value');
          if (countValue && !isNaN(parseInt(countValue))) {
            if (iterations >= parseInt(countValue)) break;
          }
        }

        if (range) {
          const toValue = getTextValue(range[1], 'To');
          if (toValue) {
            if (toValue !== 'n' && iterations >= parseInt(toValue)) break;
          }
        }

        // Use type assertion to fix type issue
        const result = this.parseExpression(context, expressionMember as any);
        if (result === undefined || context.reader.position === oldPosition) break;

        results.push(result);
        iterations++;
      }

      // Validate minimum iterations
      if (range) {
        const from = getRequiredAttribute(range[1], 'From',
          'Invalid grammar: Range expression missing From');
        const fromValue = getTextValue(from[1], 'Value');
        if (fromValue && !isNaN(parseInt(fromValue))) {
          const from = parseInt(fromValue);
          if (iterations < from) {
            return undefined;
          }
        }
      }

      // Return the list of results
      return results.length > 0 ? item(results) : undefined;
    });
  }

  private parseCaptureExpression(context: ParserContext, member: Member): Item | undefined {
    const [, exprItem] = member;
    const expressionMember = getRequiredAttribute(exprItem, 'Expression',
      'Invalid grammar: Capture expression missing Expression');

    return context.parseTransact(() => {
      const result = this.parseExpression(context, expressionMember);
      if (result === undefined) return undefined;

      // Create a capture item with the result
      return item({ Expression: result });
    });
  }

  private parseSeparatedRepeatExpression(context: ParserContext, member: Member): Item | undefined {
    const [, exprItem] = member;
    const record = exprItem.value as Record<string, Item>;
    const expressionItem = record['Expression'];
    const separatorItem = record['Separator'];

    if (!expressionItem || !separatorItem) {
      throw new GrammarError('Invalid grammar: SeparatedRepeat expression missing Expression or Separator');
    }

    const expression: Member = ['Expression', expressionItem];
    const separator: Member = ['Separator', separatorItem];

    return context.parseTransact(() => {
      const results: Item[] = [];
      let first = true;

      while (true) {
        const oldPosition = context.reader.position;

        // Parse separator if not the first item
        if (!first) {
          const sepResult = this.parseExpression(context, separator);
          if (sepResult === undefined) break;
        } else {
          first = false;
        }

        // Parse the expression
        const result = this.parseExpression(context, expression);
        if (result === undefined || context.reader.position === oldPosition) break;

        results.push(result);
      }

      // Return the list of results
      return results.length > 0 ? item(results) : undefined;
    });
  }

  private parseAndNotExpression(context: ParserContext, member: Member): Item | undefined {
    const [, exprItem] = member;
    const record = exprItem.value as Record<string, Item>;
    const expressionItem = record['Expression'];
    const notExpressionItem = record['NotExpression'];

    if (!expressionItem || !notExpressionItem) {
      throw new GrammarError('Invalid grammar: AndNot expression missing Expression or NotExpression');
    }

    const expression: Member = ['Expression', expressionItem];
    const notExpression: Member = ['NotExpression', notExpressionItem];

    // First check if the not expression matches
    const startPos = context.reader.position;
    const notResult = this.parseExpression(context, notExpression);

    // Reset position
    context.reader.position = startPos;

    // If not expression matched, this expression fails
    if (notResult !== undefined) {
      return undefined;
    }

    // Otherwise, parse the main expression
    return this.parseExpression(context, expression);
  }

  private parseAsExpression(context: ParserContext, member: Member): Item | undefined {
    const [, exprItem] = member;
    const expressionMember = getRequiredAttribute(exprItem, 'Expression',
      'Invalid grammar: As expression missing Expression');
    const [, valueItem] = getRequiredAttribute(exprItem, 'Value',
      'Invalid grammar: As expression missing Value');

    // Navigate through the nested structure to get the value
    const [, stringItem] = getRequiredAttribute(valueItem, 'String',
      'Invalid grammar: As expression Value missing String');
    const value = getRequiredTextValue(stringItem, 'Value',
      'Invalid grammar: As expression String missing Value');

    return context.parseTransact(() => {
      // Parse the expression
      const result = this.parseExpression(context, expressionMember);
      if (result === undefined) return undefined;

      // Return the specified value instead
      return item(value);
    });
  }

  private parseDeclarationExpression(context: ParserContext, member: Member): Item | undefined {
    const [, exprItem] = member;
    const record = exprItem.value as Record<string, Item>;
    const nameItem = record['Name'];
    const expressionItem = record['Expression'];

    if (!nameItem || !expressionItem || typeof nameItem.value !== 'string') {
      throw new GrammarError('Invalid grammar: Declaration expression missing Name or Expression');
    }

    const name = nameItem.value;
    const expression: Member = ['Expression', expressionItem];

    return context.parseTransact(() => {
      const result = this.parseExpression(context, expression);
      if (result === undefined) return undefined;

      // Create a declaration with the name and expression
      return item({ [name]: result });
    });
  }

  private parseOrExpression(context: ParserContext, member: Member): Item | undefined {
    const [, exprItem] = member;
    const record = exprItem.value as Record<string, Item>;
    const expressionsItem = record['Expressions'];

    if (!expressionsItem || !Array.isArray(expressionsItem.value)) {
      throw new GrammarError('Invalid grammar: Or expression missing Expressions');
    }

    const expressions = expressionsItem.value;

    // Try each expression in order
    for (const expr of expressions) {
      const result = this.parseExpression(context, ['expression', expr]);
      if (result !== undefined) {
        return result;
      }
    }

    return undefined;
  }

  private parseGroupExpression(context: ParserContext, member: Member): Item | undefined {
    const [, exprItem] = member;
    const record = exprItem.value as Record<string, Item>;
    const sequenceItem = record['Sequence'];

    if (!sequenceItem) {
      throw new GrammarError('Invalid grammar: Group expression missing Sequence');
    }

    return this.parseSequence(context, ['Sequence', sequenceItem]);
  }

  private parseOptionalExpression(context: ParserContext, member: Member): Item | undefined {
    const [, exprItem] = member;
    const record = exprItem.value as Record<string, Item>;
    const sequenceItem = record['Sequence'];

    if (!sequenceItem) {
      throw new GrammarError('Invalid grammar: Optional expression missing Sequence');
    }

    const result = this.parseSequence(context, ['Sequence', sequenceItem]);

    // Optional always succeeds, but may return empty list
    return result || item([]);
  }

  private parseReferenceExpression(context: ParserContext, member: Member): Item | undefined {
    const [, exprItem] = member;
    const record = exprItem.value as Record<string, Item>;
    const nameItem = record['Name'];

    if (!nameItem || typeof nameItem.value !== 'object') {
      throw new GrammarError('Invalid grammar: Reference expression missing Name');
    }

    const nameRecord = nameItem.value as Record<string, Item>;
    const valueItem = nameRecord['Value'];

    if (!valueItem || typeof valueItem.value !== 'string') {
      throw new GrammarError('Invalid grammar: Reference Name missing Value');
    }

    const referenceName = valueItem.value;
    const grammarNameItem = record['GrammarName'];
    const grammarName = grammarNameItem && typeof grammarNameItem.value === 'string' ? grammarNameItem.value : undefined;

    // Handle cross-grammar references
    if (grammarName) {
      // TODO: Implement cross-grammar reference resolution
      throw new ParserError('Cross-grammar references not yet implemented', context.reader.position);
    }

    return context.parseCache(referenceName, () => {
      return this.parseDefinitionGroup(context, referenceName, exprItem);
    });
  }

  private parseRangeExpression(context: ParserContext, member: Member): Item | undefined {
    if (context.reader.eof) return undefined;

    const [, exprItem] = member;
    const [, fromItem] = getRequiredAttribute(exprItem, 'From',
      'Invalid grammar: Range expression missing From');
    const [, toItem] = getRequiredAttribute(exprItem, 'To',
      'Invalid grammar: Range expression missing To');

    const char = context.reader.read();
    const from = this.getCharValue(fromItem);
    const to = this.getCharValue(toItem);

    if (char >= from && char <= to) {
      context.reader.next();
      return item(char);
    }

    return undefined;
  }

  private parseCharExpression(context: ParserContext, member: Member): Item | undefined {
    if (context.reader.eof) return undefined;

    const [, exprItem] = member;
    const char = context.reader.read();
    const target = this.getCharValue(exprItem);

    if (char === target) {
      context.reader.next();
      return item(char);
    }

    return undefined;
  }

  private parseStringExpression(context: ParserContext, member: Member): Item | undefined {
    const [, exprItem] = member;
    const target = getRequiredTextValue(exprItem, 'Text',
      'Invalid grammar: String expression missing Text');

    return context.parseTransact(() => {
      for (let index = 0; index < target.length; index++) {
        const currentChar = context.reader.read();
        if (context.reader.eof || !context.compareStrings(target[index], currentChar)) {
          return undefined;
        }
        context.reader.next();
      }

      return item(target);
    });
  }

  private parseCharSetExpression(context: ParserContext, member: Member): Item | undefined {
    if (context.reader.eof) return undefined;

    const [, exprItem] = member;
    const record = exprItem.value as Record<string, Item>;
    const char = context.reader.read();
    const isAll = record['All'] !== undefined;
    const isNot = record['Not'] !== undefined;
    let matches = false;

    // Handle the "All" case - matches any character
    if (isAll) {
      matches = true;
    } else {
      // Handle the Entries case
      const entriesItem = record['Entries'];

      if (!entriesItem || !Array.isArray(entriesItem.value)) {
        throw new GrammarError('Invalid grammar: CharSet expression missing Entries');
      }

      const entries = entriesItem.value;
      matches = entries.some(entry => {
        const entryRecord = entry.value as Record<string, Item>;

        // Check if it's a range
        if ('From' in entryRecord && 'To' in entryRecord) {
          const from = this.getCharValue(entryRecord['From']);
          const to = this.getCharValue(entryRecord['To']);
          return char >= from && char <= to;
        } else {
          // It's a char
          return char === this.getCharValue(entry);
        }
      });
    }

    // Apply the Not modifier if present
    if (isNot) {
      matches = !matches;
    }

    if (matches) {
      context.reader.next();
      return item(char);
    }

    return undefined;
  }

  private getCharValue(node: Item): string {
    // Handle the '#' Index : digit* format
    const indexValue = getTextValue(node, 'Index');
    if (indexValue !== undefined) {
      return String.fromCharCode(parseInt(indexValue));
    }

    // Handle the Literal : ('''''' as '''' | {?}) format
    const literalValue = getTextValue(node, 'Literal');
    if (literalValue !== undefined) {
      return literalValue;
    }

    throw new GrammarError('Invalid grammar: Char expression missing Index or Literal');
  }

  private getExpressionType(node: Item): string {
    if (!node || typeof node.value !== 'object' || Array.isArray(node.value)) {
      return '';
    }

    const record = node.value as Record<string, Item>;

    // Return the first key in the record
    for (const key in record) {
      return key;
    }

    return '';
  }
}
