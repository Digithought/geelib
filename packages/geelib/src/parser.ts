import type { TokenStream } from './types.js';
import type { Item, List, Member, Node } from "./ast/ast.js";
import { item, getRequiredAttribute, getTextValue, getRequiredTextValue, isList, isNode, singleMember, getNumberValue, getAttribute } from './ast/ast.js';
import { ParserContext } from './parser-context.js';
import type { Definition } from './definition.js';
import { Associativity } from './definition.js';
import { OptimizedGrammar } from './optimize/optimizer.js';
import { GrammarError, ParserError } from './errors.js';
import { captured, mergeResults, uncaptured } from './capture.js';
import { CharSet } from './types.js';

export class Parser {
  constructor(public readonly grammar: OptimizedGrammar) {
    // Ensure the grammar is optimized
    if (!(grammar instanceof OptimizedGrammar)) {
      throw new GrammarError('Parser requires an optimized grammar. Please use the optimize() function to optimize your grammar before passing it to the Parser.');
    }
  }

  /**
   * Parse input using the grammar
   *
   * @param reader Token stream to parse
   * @returns Parsed AST or undefined if parsing failed
   */
  parse(reader: TokenStream): Item | undefined {
    const context = new ParserContext(reader, false, this.grammar.options);
    return uncaptured(this.parseDefinitionGroup(context, this.grammar.root, null));
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
      const [, sequenceItem] = getRequiredAttribute(definition.instance, 'Sequence',
        `Invalid grammar: Definition ${definition.name} missing Sequence`);
			if (!isList(sequenceItem)) throw new GrammarError('Invalid grammar: Sequence is not a list');

			// Parse the sequence
      const result = this.parseSequence(context, sequenceItem);

      // If successful and this is a node definition, wrap it
      if (result !== undefined) {
        const typeValue = getTextValue(definition.instance, 'Type');
        const isNodeDefinition = typeValue === ':=';

        if (isNodeDefinition) {
          // Create a record with the definition name as the type
          return item({ [definition.name]: result }, result.span);
        }
      }

      return result;
    });
  }

  private parseSequence(context: ParserContext, list: List): Item | undefined {
		// Optimize single item sequences
    if (list.value.length === 1) {
      const expr = list.value[0];
			if (!isNode(expr)) throw new GrammarError('Invalid grammar: Sequence expression is not a node');
			return this.parseExpression(context, expr);
    }

    return context.parseTransact(() => {
      const results: Item[] = [];

      for (const expr of list.value) {
				if (!isNode(expr)) throw new GrammarError('Invalid grammar: Sequence item is not a node');
        const result = this.parseExpression(context, expr);
        if (result === undefined) {
          return undefined;
        }
        results.push(result);
      }

			return mergeResults(results);
    });
  }

  /**
   * Parses an expression node.
   *
   * Note: 'Quote' expressions are not handled directly by the parser.
   * They are transformed by the QuoteExpander during the optimization phase
   * into either 'String' or 'Char' expressions with appropriate whitespace handling.
   * This is why there is no 'case' for Quote in this switch statement.
   *
   * @param context Parser context
   * @param node Expression node to parse
   * @returns Parsed item or undefined if parsing failed
   */
  private parseExpression(context: ParserContext, node: Node): Item | undefined {
    // Use type assertion to fix type issues
    const typeMember = singleMember(node);
    if (!typeMember) {
      throw new GrammarError('Invalid grammar: Expression node missing type');
    }
    const [type, expr] = typeMember;

    if (!isNode(expr)) {
      throw new GrammarError(`Invalid grammar: Expression node has invalid ${type} value`);
    }

    switch (type) {
      case 'Repeat': return this.parseRepeatExpression(context, expr);
      case 'Separated': return this.parseSeparatedExpression(context, expr);
      case 'AndNot': return this.parseAndNotExpression(context, expr);
      case 'As': return this.parseAsExpression(context, expr);
      case 'Declaration': return this.parseDeclarationExpression(context, expr);
      case 'Or': return this.parseOrExpression(context, expr);
      case 'Group': return this.parseGroupExpression(context, expr);
      case 'Optional': return this.parseOptionalExpression(context, expr);
      case 'Reference': return this.parseReferenceExpression(context, expr);
      case 'Range': return this.parseRangeExpression(context, expr);
      case 'Char': return this.parseCharExpression(context, expr);
      case 'String': return this.parseStringExpression(context, expr);
      case 'CharSet': return this.parseCharSetExpression(context, expr);
      case 'Capture': return this.parseCaptureExpression(context, expr);
      case 'Quote':
        throw new GrammarError('Quote expressions should be transformed by the optimizer before reaching the parser. Make sure you are using an optimized grammar.');
      default:
        throw new GrammarError(`Invalid grammar: Invalid expression node type (${type})`);
    }
  }

  private parseRepeatExpression(context: ParserContext, node: Node): Item | undefined {
    const [, expr] = getRequiredAttribute(node, 'Expression',
      'Invalid grammar: Repeat expression missing Expression');
		if (!isNode(expr)) throw new GrammarError('Invalid grammar: Repeat expression missing Expression node');

		const countValue = getNumberValue(expr, 'Count');
		const rangeToValue = getNumberValue(expr, 'To');
		const rangeFromValue = getNumberValue(expr, 'From');
		if ((countValue !== undefined && countValue < 1) || (rangeToValue !== undefined && rangeToValue < 1)) {
			throw new GrammarError('Invalid grammar: Repeat expression "Count" or "To" is less than 1');
		}
		if ((rangeFromValue !== undefined && (rangeToValue === undefined || rangeFromValue > rangeToValue || rangeFromValue < 0))) {
			throw new GrammarError('Invalid grammar: Repeat expression "From" is invalid');
		}

    return context.parseTransact(() => {
      const results: Item[] = [];
      let iterations = 0;

      while (true) {
        iterations++;
				if (countValue !== undefined && iterations > countValue) break;
				if (rangeToValue !== undefined && iterations > rangeToValue) break;

				const oldPosition = context.reader.position;

        const result = this.parseExpression(context, expr);

				// If no match, or no progress, break
        if (result === undefined || context.reader.position === oldPosition) break;

        results.push(result);
      }

      // Validate we reached the minimum iterations
			const endRange = rangeFromValue ?? countValue;
      if (endRange !== undefined && iterations < endRange) {
        return undefined;
      }

      // Return the list of results
      return mergeResults(results);
    });
  }

  private parseCaptureExpression(context: ParserContext, node: Node): Item | undefined {
    const expressionMember = getRequiredAttribute(node, 'Expression',
      'Invalid grammar: Capture expression missing Expression');
		const [, expression] = expressionMember;
		if (!isNode(expression)) throw new GrammarError('Invalid grammar: Capture expression missing Expression node');

    return captured(this.parseExpression(context, expression));
  }

  private parseSeparatedExpression(context: ParserContext, node: Node): Item | undefined {
    const [, expressionItem] = getRequiredAttribute(node, 'Expression',
      'Invalid grammar: Separated expression missing Expression');
    const [, separatorItem] = getRequiredAttribute(node, 'Separator',
      'Invalid grammar: Separated expression missing Separator');

    if (!isNode(expressionItem)) throw new GrammarError('Invalid grammar: Separated expression has invalid Expression');
    if (!isNode(separatorItem)) throw new GrammarError('Invalid grammar: Separated expression has invalid Separator');

    return context.parseTransact(() => {
      const results: Item[] = [];
      let first = true;

      while (true) {
        const oldPosition = context.reader.position;

        // Parse separator if not the first item
        if (!first) {
          const sepResult = this.parseExpression(context, separatorItem);
          if (sepResult === undefined) break;
        } else {
          first = false;
        }

        // Parse the expression
        const result = this.parseExpression(context, expressionItem);
        if (result === undefined || context.reader.position === oldPosition) break;

        results.push(result);
      }

      // Return the list of results
      return mergeResults(results);
    });
  }

  private parseAndNotExpression(context: ParserContext, node: Node): Item | undefined {
    const [, expressionItem] = getRequiredAttribute(node, 'Expression',
      'Invalid grammar: AndNot expression missing Expression');
    const [, notExpressionItem] = getRequiredAttribute(node, 'Not',
      'Invalid grammar: AndNot expression missing Not');

    if (!isNode(expressionItem)) throw new GrammarError('Invalid grammar: AndNot expression has invalid Expression');
    if (!isNode(notExpressionItem)) throw new GrammarError('Invalid grammar: AndNot expression has invalid Not');

    return context.parseTransact(() => {
			const startPos = context.reader.position;

      // First check if the not expression matches
			const notResult = this.parseExpression(context, notExpressionItem);

      // Reset position
      context.reader.position = startPos;

      // If the not expression matches, this expression fails
      if (notResult !== undefined) {
        return undefined;
      }

      // Otherwise, parse the main expression
      return this.parseExpression(context, expressionItem);
    });
  }

  private parseAsExpression(context: ParserContext, node: Node): Item | undefined {
    const [, expressionItem] = getRequiredAttribute(node, 'Expression',
      'Invalid grammar: As expression missing Expression');
		if (!isNode(expressionItem)) throw new GrammarError('Invalid grammar: As expression has invalid Expression');

		const [, valueString] = getRequiredAttribute(node, 'Value', 'Invalid grammar: As expression missing Value');
		const valueText = getStringText(valueString);


    return context.parseTransact(() => {
      // Parse the expression
      const result = this.parseExpression(context, expressionItem);
      if (result === undefined) return undefined;

      // Return the specified value instead
      return item(valueText, result.span);
    });
  }

  private parseDeclarationExpression(context: ParserContext, node: Node): Item | undefined {
    const [, expressionItem] = getRequiredAttribute(node, 'Expression',
      'Invalid grammar: Declaration expression missing Expression');
    const nameText = getRequiredTextValue(node, 'Name',
      'Invalid grammar: Declaration expression missing Name');

    if (!isNode(expressionItem)) throw new GrammarError('Invalid grammar: Declaration expression has invalid Expression');

    return context.parseTransact(() => {
      const result = this.parseExpression(context, expressionItem);
      if (result === undefined) return undefined;

      // Create a declaration with the name and expression
      return item({ [nameText]: result }, result.span);
    });
  }

  private parseOrExpression(context: ParserContext, node: Node): Item | undefined {
    const [, expressionsItem] = getRequiredAttribute(node, 'Expressions',
      'Invalid grammar: Or expression missing Expressions');

    if (!isList(expressionsItem)) {
      throw new GrammarError('Invalid grammar: Or expression Expressions is not a list');
    }

    const expressions = expressionsItem.value;
    if (expressions.length === 0) {
      throw new GrammarError('Invalid grammar: Or expression has empty Expressions list');
    }

    // Try each expression in order
    for (const expr of expressions) {
      if (!isNode(expr)) {
        throw new GrammarError('Invalid grammar: Or expression has invalid expression in list');
      }

      const result = this.parseExpression(context, expr);
      if (result !== undefined) {
        return result;
      }
    }

    return undefined;
  }

  private parseGroupExpression(context: ParserContext, node: Node): Item | undefined {
    const [, sequence] = getRequiredAttribute(node, 'Sequence',
      'Invalid grammar: Group expression missing Sequence');

    if (!isList(sequence)) throw new GrammarError('Invalid grammar: Group expression has invalid Sequence');

    return this.parseSequence(context, sequence);
  }

  private parseOptionalExpression(context: ParserContext, node: Node): Item | undefined {
    const [, sequence] = getRequiredAttribute(node, 'Sequence',
      'Invalid grammar: Optional expression missing Sequence');

    if (!isList(sequence)) throw new GrammarError('Invalid grammar: Optional expression has invalid Sequence');

    const result = this.parseSequence(context, sequence);

    // Optional always succeeds, but may return empty text
    return result || item('', { start: context.reader.position, end: context.reader.position });
  }

  private parseReferenceExpression(context: ParserContext, node: Node): Item | undefined {
    const nameText = getRequiredTextValue(node, 'Name',
      'Invalid grammar: Reference expression missing Name');

    // Parse the referenced definition
    return this.parseDefinitionGroup(context, nameText, node);
  }

  private parseRangeExpression(context: ParserContext, node: Node): Item | undefined {

		if (context.reader.eof) return undefined;
		// Read the character and check if it's in the range
		const char = context.reader.read();

		if (!rangeMatches(context, char, node)) {
			return undefined;
		}

		// Consume the character
		context.reader.next();
		return item(char, { start: context.reader.position - 1, end: context.reader.position });
  }

  private parseCharExpression(context: ParserContext, node: Node): Item | undefined {

		if (context.reader.eof) return undefined;

		// Read the character and check if it matches
		const char = context.reader.read();

		if (!charMatches(context, char, node)) {
			return undefined;
		}

		// Consume the character
		context.reader.next();

		return item(char, { start: context.reader.position - 1, end: context.reader.position });
  }

  private parseStringExpression(context: ParserContext, node: Node): Item | undefined {
    const stringText = getRequiredTextValue(node, 'Text',
      'Invalid grammar: String expression missing Text');

		let readString = '';
    return context.parseTransact(() => {
			let readChar: string;
      // Try to match each character in the string
      for (let i = 0; i < stringText.length; i++) {
        if (context.reader.eof || (readChar = context.reader.readThenNext()) !== stringText[i]) {
          return undefined;
        }
        readString += readChar;
      }

      // Return the canonical matched string
      return item(readString, { start: context.reader.position - stringText.length, end: context.reader.position });
    });
  }

  /**
   * Parses a CharSet expression.
   *
   * A CharSet expression can be in one of two forms:
   * 1. {?} - Matches any single character (All flag)
   * 2. {entries} - Matches any character in the set of entries
   *
   * Both forms can be negated with the Not flag (!):
   * 1. {!?} - Never matches anything (logical opposite of "match any character")
   * 2. {!entries} - Matches any character NOT in the set of entries
   *
   * Entries can be individual characters or ranges:
   * - {a, b, c} - Matches 'a', 'b', or 'c'
   * - {a..z} - Matches any lowercase letter
   * - {a..z, A..Z, 0..9} - Matches any alphanumeric character
   *
   * An empty charset {} never matches anything, while a negated empty charset {!} matches any character.
   *
   * @param context Parser context
   * @param node CharSet expression node
   * @returns Parsed item or undefined if parsing failed
   */
  private parseCharSetExpression(context: ParserContext, node: Node): Item | undefined {
    const not = Boolean(getTextValue(node, 'Not'));
    const all = Boolean(getTextValue(node, 'All'));
    const entries = getAttribute(node, 'Entries');

    // Validate that we don't have both All and Entries
    if (all && entries) {
      throw new GrammarError('Invalid grammar: CharSet expression cannot have both All and Entries');
    }

    // Handle the "match any character" case
    if (all) {
      // If negated, or EOF, it should never match anything (always fail)
      if (not || context.reader.eof) {
        return undefined;
      }

      const char = context.reader.readThenNext();
      return item(char, { start: context.reader.position - 1, end: context.reader.position });
    }

    // Handle the entries case
    if (!isList(entries?.[1])) {
      throw new GrammarError('Invalid grammar: CharSet expression Entries is not present or not a list');
    }

    const entryList = entries[1].value;
    if (entryList.length === 0) {
      // Empty charset - if not negated, it never matches
      // If negated, it always matches, but we need a character to consume
      if (not && !context.reader.eof) {
        const char = context.reader.readThenNext();
        return item(char, { start: context.reader.position - 1, end: context.reader.position });
      }
      return undefined;
    }

    // Create a CharSet from the entries
    const charset = new CharSet();

    // Process each entry and add it to the charset
    for (const entry of entryList) {
      if (!isNode(entry)) {
        throw new GrammarError('Invalid grammar: Invalid CharSet entry - not a node');
      }

      const range = entry.value['Range'];
      if (isNode(range)) {
        // Handle range entry
        const fromNode = getRequiredAttribute(range, 'From',
          'Invalid grammar: Range expression missing From')[1] as Node;
        const toNode = getRequiredAttribute(range, 'To',
          'Invalid grammar: Range expression missing To')[1] as Node;

        if (!isNode(fromNode) || !isNode(toNode)) {
          throw new GrammarError('Invalid grammar: Range expression From and To must be nodes');
        }

        // Get character values from the Char nodes
        const fromChar = getCharValue(fromNode);
        const toChar = getCharValue(toNode);

        // Add the range to the charset
        charset.union({
          low: fromChar.charCodeAt(0),
          high: toChar.charCodeAt(0)
        });
      } else {
        const char = entry.value['Char'];
        if (!isNode(char)) {
          throw new GrammarError('Invalid grammar: Invalid CharSet entry - not a char or range');
        }

        // Get the character value
        const charValue = getCharValue(char);

        // Add the single character as a range
        charset.union({
          low: charValue.charCodeAt(0),
          high: charValue.charCodeAt(0)
        });
      }
    }

    // If negated, invert the charset
    if (not) {
      charset.invert();
    }

    const startPos = context.reader.position;

    return context.parseTransact(() => {
      // Check if we're at EOF
      if (context.reader.eof) {
        return undefined;
      }

      // Read the character and check if it matches
      const char = context.reader.read();

      if (!charset.matches(char)) {
        return undefined;
      }

      // Consume the character
      context.reader.next();

      return item(char, { start: startPos, end: context.reader.position - 1 });
    });
  }
}

function charMatches(context: ParserContext, char: string, node: Node): boolean {
	const indexValue = getNumberValue(node, 'Index');
	const literalValue = getTextValue(node, 'Literal');
	if ((indexValue !== undefined && literalValue !== undefined) || (indexValue === undefined && literalValue === undefined)) {
		throw new GrammarError('Invalid grammar: Char expression must have either Index or Literal, but not both');
	}
	if (literalValue && literalValue.length !== 1) {
		throw new GrammarError('Invalid grammar: Char expression Literal must be a single character');
	}

	if (indexValue !== undefined) {
		if (char.charCodeAt(0) !== indexValue) {
			return false;
		}
	} else {
		if (!context.compareStrings(char, literalValue)) {
			return false;
		}
	}

	return true;
}

function rangeMatches(context: ParserContext, char: string, node: Node): boolean {
	const fromNode = getRequiredAttribute(node, 'From',
		'Invalid grammar: Range expression missing From')[1] as Node;
	const toNode = getRequiredAttribute(node, 'To',
		'Invalid grammar: Range expression missing To')[1] as Node;

	if (!isNode(fromNode) || !isNode(toNode)) {
		throw new GrammarError('Invalid grammar: Range expression From and To must be nodes');
	}

	// Get character values from the Char nodes
	const fromChar = getCharValue(fromNode);
	const toChar = getCharValue(toNode);

	// Check if the character is in the range
	const charCode = char.charCodeAt(0);
	const fromCharCode = fromChar.charCodeAt(0);
	const toCharCode = toChar.charCodeAt(0);

	return charCode >= fromCharCode && charCode <= toCharCode;
}

/**
 * Helper function to extract a character value from a Char node
 */
function getCharValue(node: Node): string {
	const indexValue = getNumberValue(node, 'Index');
	const literalValue = getTextValue(node, 'Literal');

	if ((indexValue !== undefined && literalValue !== undefined) || (indexValue === undefined && literalValue === undefined)) {
		throw new GrammarError('Invalid grammar: Char expression must have either Index or Literal, but not both');
	}

	if (indexValue !== undefined) {
		return String.fromCharCode(indexValue);
	} else {
		if (literalValue && literalValue.length !== 1) {
			throw new GrammarError('Invalid grammar: Char expression Literal must be a single character');
		}
		return literalValue!;
	}
}

function getStringText(item: Item): string {
	if (!isNode(item)) throw new GrammarError('Invalid grammar: String expression is not a node');
	const [, stringValue] = getRequiredAttribute(item, 'String', 'Invalid grammar: String expression missing String');
	return getRequiredTextValue(stringValue, 'Text', 'Invalid grammar: String expression missing Text');
}
