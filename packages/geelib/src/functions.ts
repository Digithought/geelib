import type { TokenStream } from './types.js';
import type { Item, Node } from "./ast/ast.js";
import { Parser } from './parser.js';
import { optimize, OptimizedGrammar } from './optimize/optimizer.js';
import { StringStream } from './string-stream.js';
import { buildGrammar } from './grammar-builder.js';
import { geeAst } from './ast/gee-ast.js';

/**
 * Parse a grammar text and create a Grammar instance
 *
 * @param grammarText The grammar text to parse
 * @returns A Grammar instance
 */
export function parseGrammarText(grammarText: string): OptimizedGrammar {
	return parseGrammar(new StringStream(grammarText));
}

/**
 * Parse a grammar stream and create an OptimizedGrammar instance
 *
 * @param grammarStream The grammar stream to parse
 * @returns An OptimizedGrammar instance
 */
export function parseGrammar(grammarStream: TokenStream): OptimizedGrammar {
	const rawGeeGrammar = buildGrammar(geeAst);
	const geeGrammar = optimize(rawGeeGrammar);
  const parser = new Parser(geeGrammar);
  const ast = parser.parse(grammarStream);
  if (!ast) {
    throw new Error('Failed to parse grammar');
  }
	const grammar = buildGrammar(ast as Node);
	return optimize(grammar);
}

/**
 * Parse text using an optimized grammar
 *
 * @param grammar The grammar to use for parsing
 * @param text The text to parse
 * @returns Parsed item or null if parsing failed
 */
export function parseText(grammar: OptimizedGrammar, text: string): Item | null {
  const reader = new StringStream(text);
  const parser = new Parser(grammar);
  return parser.parse(reader) || null;
}

/**
 * Parse input using an optimized grammar
 * @param grammar The grammar to use for parsing
 * @param input The input stream to parse
 * @returns Parsed item or null if parsing failed
 */
export function parseStream(grammar: OptimizedGrammar, input: TokenStream): Item | null {
  const parser = new Parser(grammar);
  return parser.parse(input) || null;
}

/**
 * Check if text matches a grammar
 * @param grammar The grammar to use for matching
 * @param text The text to check
 * @returns True if the text matches the grammar
 */
export function matchesText(grammar: OptimizedGrammar, text: string): boolean {
  const reader = new StringStream(text);
  return matchesStream(grammar, reader);
}

/**
 * Check if stream matches a grammar
 * @param grammar The grammar to use for matching
 * @param input The input stream to check
 * @returns True if the input matches the grammar
 */
export function matchesStream(grammar: OptimizedGrammar, input: TokenStream): boolean {
  const parser = new Parser(grammar);
  return parser.matches(input);
}
