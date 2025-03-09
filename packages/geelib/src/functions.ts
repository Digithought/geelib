import type { TokenStream } from './types.js';
import type { Item, Node } from "./ast/ast.js";
import { isNode, isList, getTextValue, item } from "./ast/ast.js";
import { Parser } from './parser.js';
import { optimize, OptimizedGrammar } from './optimize/optimizer.js';
import { StringStream } from './string-stream.js';
import { buildGrammar } from './grammar-builder.js';
import { geeAst } from './ast/gee-ast.js';

/**
 * Parse a grammar text and create an OptimizedGrammar instance.
 *
 * This function takes a grammar text in the Gee language format and parses it
 * into an OptimizedGrammar instance that can be used for parsing other texts.
 *
 * @param grammarText The grammar text to parse in Gee language format
 * @returns An OptimizedGrammar instance
 * @throws Error if the grammar text is invalid or cannot be parsed
 */
export function parseGrammarText(grammarText: string): OptimizedGrammar {
  if (grammarText === null || grammarText === undefined) {
    throw new Error('Grammar text cannot be null or undefined');
  }
	return parseGrammar(new StringStream(grammarText));
}

/**
 * Parse a grammar stream and create an OptimizedGrammar instance.
 *
 * This function takes a token stream containing a grammar in the Gee language format
 * and parses it into an OptimizedGrammar instance that can be used for parsing other texts.
 *
 * @param grammarStream The grammar stream to parse
 * @returns An OptimizedGrammar instance
 * @throws Error if the grammar stream is invalid or cannot be parsed
 */
export function parseGrammar(grammarStream: TokenStream): OptimizedGrammar {
  if (grammarStream === null || grammarStream === undefined) {
    throw new Error('Grammar stream cannot be null or undefined');
  }

  // Build and optimize the Gee grammar for parsing grammar definitions
  const geeGrammar = optimize(buildGrammar(geeAst));

  // Parse the input grammar using the Gee grammar
  const parser = new Parser(geeGrammar);
  const ast = parser.parse(grammarStream);
  if (!ast) {
    throw new Error('Failed to parse grammar');
  }
	return optimize(buildGrammar(ast));
}

/**
 * Parse text using an optimized grammar.
 *
 * This function takes an optimized grammar and a text string, and parses the text
 * according to the grammar rules. It returns the parsed AST if successful, or null
 * if the text does not match the grammar.
 *
 * @param grammar The optimized grammar to use for parsing
 * @param text The text to parse
 * @returns Parsed item or null if parsing failed
 * @throws Error if the grammar or text is null or undefined
 */
export function parseText(grammar: OptimizedGrammar, text: string): Item | null {
  if (grammar === null || grammar === undefined) {
    throw new Error('Grammar cannot be null or undefined');
  }
  if (text === null || text === undefined) {
    throw new Error('Text cannot be null or undefined');
  }
  const reader = new StringStream(text);
  const parser = new Parser(grammar);
  return parser.parse(reader) || null;
}

/**
 * Parse input using an optimized grammar.
 *
 * This function takes an optimized grammar and a token stream, and parses the stream
 * according to the grammar rules. It returns the parsed AST if successful, or null
 * if the stream does not match the grammar.
 *
 * @param grammar The optimized grammar to use for parsing
 * @param input The input stream to parse
 * @returns Parsed item or null if parsing failed
 * @throws Error if the grammar or input is null or undefined
 */
export function parseStream(grammar: OptimizedGrammar, input: TokenStream): Item | null {
  if (grammar === null || grammar === undefined) {
    throw new Error('Grammar cannot be null or undefined');
  }
  if (input === null || input === undefined) {
    throw new Error('Input stream cannot be null or undefined');
  }
  const parser = new Parser(grammar);
  return parser.parse(input) || null;
}

/**
 * Check if text matches a grammar.
 *
 * This function takes an optimized grammar and a text string, and checks if the text
 * matches the grammar rules. It returns true if the text matches, or false otherwise.
 *
 * @param grammar The optimized grammar to use for matching
 * @param text The text to check
 * @returns True if the text matches the grammar, false otherwise
 * @throws Error if the grammar or text is null or undefined
 */
export function matchesText(grammar: OptimizedGrammar, text: string): boolean {
  if (grammar === null || grammar === undefined) {
    throw new Error('Grammar cannot be null or undefined');
  }
  if (text === null || text === undefined) {
    throw new Error('Text cannot be null or undefined');
  }
  const reader = new StringStream(text);
  return matchesStream(grammar, reader);
}

/**
 * Check if stream matches a grammar.
 *
 * This function takes an optimized grammar and a token stream, and checks if the stream
 * matches the grammar rules. It returns true if the stream matches, or false otherwise.
 *
 * @param grammar The optimized grammar to use for matching
 * @param input The input stream to check
 * @returns True if the input matches the grammar, false otherwise
 * @throws Error if the grammar or input is null or undefined
 */
export function matchesStream(grammar: OptimizedGrammar, input: TokenStream): boolean {
  if (grammar === null || grammar === undefined) {
    throw new Error('Grammar cannot be null or undefined');
  }
  if (input === null || input === undefined) {
    throw new Error('Input stream cannot be null or undefined');
  }
  const parser = new Parser(grammar);
  return parser.matches(input);
}
