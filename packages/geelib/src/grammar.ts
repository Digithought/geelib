import type { DefinitionGroups } from './definition.js';

export interface GrammarOptions {
  /**
   * The name of the rule to use for whitespace handling
   */
  whitespaceRule?: string;

  /**
   * Whether the grammar is case-sensitive
   */
  caseSensitive?: boolean;
}

/**
 * Grammar class that encapsulates definitions, root rule, and parsing options
 */
export class Grammar {
  /**
   * Creates a new Grammar instance
   *
   * @param definitions The definition groups that make up the grammar
   * @param root The name of the root rule
   * @param options Grammar options for parsing
   */
  constructor(
    public readonly definitions: DefinitionGroups,
    public readonly root: string,
    public readonly options: GrammarOptions = {},
  ) {}

  /**
   * Create a copy of this grammar with new definitions
   *
   * @param definitions New definition groups
   * @returns A new Grammar instance
   * @internal This should only be used by the optimizer
   */
  withDefinitions(definitions: DefinitionGroups): Grammar {
    return new Grammar(
      definitions,
      this.root,
      this.options,
    );
  }
}
