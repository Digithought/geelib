import type { TokenStream } from './types.js';
import type { Item, List, Member, Node } from "./ast/ast.js";
import { item, getRequiredAttribute, getTextValue, getRequiredTextValue, isList, isNode, singleMember, getNumberValue, getAttribute } from './ast/ast.js';
import { ParserContext } from './parser-context.js';
import type { Definition } from './definition.js';
import { Associativity } from './definition.js';
import type { OptimizedGrammar } from './optimize/optimizer.js';
import { GrammarError, ParserError } from './errors.js';
import { captured, mergeResults, uncaptured } from './capture.js';

export class Parser {
  constructor(public readonly grammar: OptimizedGrammar) {
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
          return item({ [definition.name]: result });
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
      case 'Separated': return this.parseSeparatedRepeatExpression(context, expr);
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

  private parseSeparatedRepeatExpression(context: ParserContext, node: Node): Item | undefined {
    const [, expressionItem] = getRequiredAttribute(node, 'Expression',
      'Invalid grammar: SeparatedRepeat expression missing Expression');
    const [, separatorItem] = getRequiredAttribute(node, 'Separator',
      'Invalid grammar: SeparatedRepeat expression missing Separator');

    if (!isNode(expressionItem)) throw new GrammarError('Invalid grammar: SeparatedRepeat expression has invalid Expression');
    if (!isNode(separatorItem)) throw new GrammarError('Invalid grammar: SeparatedRepeat expression has invalid Separator');

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
    const valueText = getRequiredTextValue(node, 'Value',
      'Invalid grammar: As expression missing Value');

    if (!isNode(expressionItem)) throw new GrammarError('Invalid grammar: As expression has invalid Expression');

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
    const [, expressionItem] = getRequiredAttribute(node, 'Expression',
      'Invalid grammar: Group expression missing Expression');

    if (!isNode(expressionItem)) throw new GrammarError('Invalid grammar: Group expression has invalid Expression');

    return this.parseExpression(context, expressionItem);
  }

  private parseOptionalExpression(context: ParserContext, node: Node): Item | undefined {
    const [, expressionItem] = getRequiredAttribute(node, 'Expression',
      'Invalid grammar: Optional expression missing Expression');

    if (!isNode(expressionItem)) throw new GrammarError('Invalid grammar: Optional expression has invalid Expression');

    const result = this.parseExpression(context, expressionItem);

    // Optional always succeeds, but may return empty text
    return result || item('');
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
		return item(char);
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

		return item(char);
  }

  private parseStringExpression(context: ParserContext, node: Node): Item | undefined {
    const stringText = getRequiredTextValue(node, 'Value',
      'Invalid grammar: String expression missing Value');

    return context.parseTransact(() => {
      // Try to match each character in the string
      for (let i = 0; i < stringText.length; i++) {
        if (context.reader.eof || context.reader.readThenNext() !== stringText[i]) {
          return undefined;
        }
      }

      // Return the canonical matched string
      return item(stringText);
    });
  }

  private parseCharSetExpression(context: ParserContext, node: Node): Item | undefined {
    const charSetText = getRequiredTextValue(node, 'Value',
      'Invalid grammar: CharSet expression missing Value');
    const not = Boolean(getTextValue(node, 'Not'));
		const all = Boolean(getTextValue(node, 'All'));
		const entries = getAttribute(node, 'Entries');

		if (all) {
			if (not) {
				if (context.reader.eof) {
					return item('', { start: context.reader.position, end: context.reader.position });
				} else {
					return undefined;
				}
			}
			if (!context.reader.eof) {
				const char = context.reader.read();
				return item(char, { start: context.reader.position - 1, end: context.reader.position });
			}
			return undefined;
		}
		if (!isList(entries?.[1])) {
			throw new GrammarError('Invalid grammar: CharSet expression Entries is not present or not a list');
		}
		const entryList = entries[1].value;
		if (entryList.length === 0) {
			return undefined;
		}

		const startPos = context.reader.position;
		let text = '';
    return context.parseTransact(() => {
			for (const entry of entryList) {
				if (!isNode(entry)) {
					throw new GrammarError('Invalid grammar: Invalid CharSet entry - not a node');
				}
				if (context.reader.eof) return undefined;
				const read = context.reader.readThenNext();
				const range = entry.value['Range'];
				if (isNode(range)) {
					if (!rangeMatches(context, read, range)) {
						return undefined;
					}
				} else {
					const char = entry.value['Char'];
					if (!isNode(char)) throw new GrammarError('Invalid grammar: Invalid CharSet entry - not a char or range');
					if (!charMatches(context, read, char)) {
						return undefined;
					}
				}
				text += read;
			}

      return item(text, { start: startPos, end: context.reader.position - 1 });
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
	const fromText = getRequiredTextValue(node, 'From',
		'Invalid grammar: Range expression missing From');
	const toText = getRequiredTextValue(node, 'To',
		'Invalid grammar: Range expression missing To');

	if (fromText.length !== 1 || toText.length !== 1) {
		throw new GrammarError('Invalid grammar: Range expression From and To must be single characters');
	}

	const fromChar = fromText.charCodeAt(0);
	const toChar = toText.charCodeAt(0);

	const charCode = char.charCodeAt(0);
	if (charCode < fromChar || charCode > toChar) {
		return false;
	}

	return true;
}
