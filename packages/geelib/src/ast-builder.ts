import type { Node, List, Text, Item } from './types.js';
import { isNode, isList } from './types.js';
import { Parser } from './parser.js';
import { DefinitionGroups, Associativity, Recursiveness, RecurseMask } from './definition.js';
import type { Definition, DefinitionGroup } from './definition.js';
import { StringStream } from './string-stream.js';

export interface GrammarOptions {
  comparer?: 'sensitive' | 'insensitive';
  whitespace?: string;
}

export class ASTBuilder {
  private static readonly bootstrapGrammar = new DefinitionGroups();

  static {
    // Initialize the bootstrap grammar that can parse G4 syntax
    const definitions = new Set<Definition>();
    ASTBuilder.bootstrapGrammar.set('Unit', {
      definitions,
      referenceMinPrecedents: new Map(),
      isLeftRecursive: () => false
    });

    // Add the core grammar definition that matches G4 syntax
    definitions.add({
      name: 'Unit',
      precedence: 0,
      instance: {
        type: 'definition',
        attributes: new Map([
          ['Sequence', {
            type: 'list',
            items: [
              {
                type: 'group',
                attributes: new Map([
                  ['Sequence', {
                    type: 'list',
                    items: [
                      {
                        type: 'string',
                        attributes: new Map([['Value', { type: 'text', value: 'grammar', attributes: new Map() }]])
                      },
                      {
                        type: 'declaration',
                        attributes: new Map([
                          ['Name', { type: 'text', value: 'Name', attributes: new Map() }],
                          ['Expression', { type: 'reference', attributes: new Map([['Name', { type: 'text', value: 'identifier', attributes: new Map() }]]) }]
                        ])
                      },
                      {
                        type: 'optional',
                        attributes: new Map([
                          ['Sequence', {
                            type: 'list',
                            items: [
                              {
                                type: 'string',
                                attributes: new Map([['Value', { type: 'text', value: 'comparer', attributes: new Map() }]])
                              },
                              {
                                type: 'char',
                                attributes: new Map([['Char', { type: 'text', value: ':', attributes: new Map() }]])
                              },
                              {
                                type: 'declaration',
                                attributes: new Map([
                                  ['Name', { type: 'text', value: 'Comparer', attributes: new Map() }],
                                  ['Expression', {
                                    type: 'group',
                                    attributes: new Map([
                                      ['Sequence', {
                                        type: 'list',
                                        items: [
                                          {
                                            type: 'or',
                                            attributes: new Map([
                                              ['Expressions', {
                                                type: 'list',
                                                items: [
                                                  {
                                                    type: 'string',
                                                    attributes: new Map([['Value', { type: 'text', value: 'sensitive', attributes: new Map() }]])
                                                  },
                                                  {
                                                    type: 'string',
                                                    attributes: new Map([['Value', { type: 'text', value: 'insensitive', attributes: new Map() }]])
                                                  }
                                                ],
                                                attributes: new Map()
                                              }]
                                            ])
                                          }
                                        ],
                                        attributes: new Map()
                                      }]
                                    ])
                                  }]
                                ])
                              }
                            ],
                            attributes: new Map()
                          }]
                        ])
                      },
                      {
                        type: 'optional',
                        attributes: new Map([
                          ['Sequence', {
                            type: 'list',
                            items: [
                              {
                                type: 'string',
                                attributes: new Map([['Value', { type: 'text', value: 'whitespace', attributes: new Map() }]])
                              },
                              {
                                type: 'char',
                                attributes: new Map([['Char', { type: 'text', value: ':', attributes: new Map() }]])
                              },
                              {
                                type: 'declaration',
                                attributes: new Map([
                                  ['Name', { type: 'text', value: 'Whitespace', attributes: new Map() }],
                                  ['Expression', { type: 'reference', attributes: new Map([['Name', { type: 'text', value: 'identifier', attributes: new Map() }]]) }]
                                ])
                              }
                            ],
                            attributes: new Map()
                          }]
                        ])
                      }
                    ],
                    attributes: new Map()
                  }]
                ])
              },
              {
                type: 'declaration',
                attributes: new Map([
                  ['Name', { type: 'text', value: 'Definitions', attributes: new Map() }],
                  ['Expression', {
                    type: 'repeat',
                    attributes: new Map([
                      ['Expression', { type: 'reference', attributes: new Map([['Name', { type: 'text', value: 'Definition', attributes: new Map() }]]) }]
                    ])
                  }]
                ])
              }
            ],
            attributes: new Map()
          }]
        ])
      },
      isLeftRecursive: () => false
    });

    // Add other necessary definitions for the bootstrap grammar
    // ... Add definitions for identifier, Definition, etc.
  }

  static parseGrammar(grammarText: string): { ast: Node; options: GrammarOptions } {
    const parser = new Parser(this.bootstrapGrammar);
    const stream = new StringStream(grammarText);
    const result = parser.parse(stream, 'Unit');

    if (!result) {
      throw new Error('Failed to parse grammar');
    }

    const ast = result as Node;
    const options: GrammarOptions = {};

    // Extract grammar options
    const comparer = this.findDeclarationValue(ast, 'Comparer');
    if (comparer && 'value' in comparer) {
      options.comparer = comparer.value as 'sensitive' | 'insensitive';
    }

    const whitespace = this.findDeclarationValue(ast, 'Whitespace');
    if (whitespace && 'value' in whitespace) {
      options.whitespace = whitespace.value;
    }

    // Create a new parser with the extracted options
    const parserWithOptions = new Parser(this.bootstrapGrammar, {
      whitespaceRule: options.whitespace,
      caseSensitive: options.comparer === 'sensitive'
    });

    // Re-parse with proper options
    const finalResult = parserWithOptions.parse(new StringStream(grammarText), 'Unit');
    if (!finalResult) {
      throw new Error('Failed to parse grammar with options');
    }

    return { ast: finalResult as Node, options };
  }

  static buildDefinitionGroups(ast: Node): DefinitionGroups {
    const groups = new DefinitionGroups();

    // Process all definitions
    const definitions = this.findDeclarationValue(ast, 'Definitions') as List;
    if (!definitions || !definitions.items) {
      throw new Error('No definitions found in grammar');
    }

    // First pass: Create groups
    for (const def of definitions.items) {
      const definition = def as Node;
      const name = this.findDeclarationValue(definition, 'Name');
      if (!name || !('value' in name)) continue;

      let group = groups.get(name.value);
      if (!group) {
        group = {
          definitions: new Set(),
          referenceMinPrecedents: new Map(),
          isLeftRecursive: () => false // Will be updated later
        };
        groups.set(name.value, group);
      }

      group.definitions.add(this.createDefinition(definition));
    }

    // Second pass: Determine recursiveness and precedence
    Array.from(groups.entries()).forEach(([name, group]) => {
      this.determineRecursiveness(name, group, groups);
    });

    return groups;
  }

  private static createDefinition(node: Node): Definition {
    const name = this.findDeclarationValue(node, 'Name');
    if (!name || !('value' in name)) {
      throw new Error('Definition missing name');
    }

    const precedence = this.findDeclarationValue(node, 'Precedence');
    const associativity = this.findDeclarationValue(node, 'Associativity');

    const definition = DefinitionGroups.createDefinition(
      name.value,
      precedence && 'value' in precedence ? parseInt(precedence.value) : Number.MAX_SAFE_INTEGER,
      node
    );

    if (associativity && 'value' in associativity) {
      definition.associativity = associativity.value === 'R' ? Associativity.Right : Associativity.Left;
    }

    return definition;
  }

  private static determineRecursiveness(name: string, group: DefinitionGroup, groups: DefinitionGroups): void {
    const references = new Set<Node>();
    const visited = new Set<string>();
    let groupRecursiveness = Recursiveness.None;

    // Determine recursiveness for each definition in the group
    for (const definition of Array.from(group.definitions)) {
      const sequence = definition.instance.attributes.get('Sequence') as List;
      const recursiveness = this.determineSequenceRecursiveness(name, sequence, groups, visited, references);

      // Store recursiveness state
      definition.recursiveness = recursiveness;
      groupRecursiveness |= recursiveness;

      // Validate recursiveness based on precedence
      if (definition.precedence === Number.MAX_SAFE_INTEGER) {
        if ((recursiveness & (Recursiveness.Left | Recursiveness.Right | Recursiveness.Full)) !== Recursiveness.None) {
          throw new Error(`Invalid grammar for definition ${name}. Recursive definitions must be given explicit precedence.`);
        }
      } else {
        if ((recursiveness & (Recursiveness.Left | Recursiveness.Right | Recursiveness.Full)) === Recursiveness.None) {
          throw new Error(`Invalid grammar for definition ${name} (precedence ${definition.precedence}). Only recursive definitions may be in an explicit precedence definition.`);
        }
      }

      // Update group's reference min precedents
      for (const reference of Array.from(references)) {
        if (!group.referenceMinPrecedents.has(reference)) {
          group.referenceMinPrecedents.set(reference, this.adjustedMinPrecedence(definition, group.definitions));
        }
      }
    }

    // Store group recursiveness state
    group.recursiveness = groupRecursiveness;
  }

  private static determineSequenceRecursiveness(
    rootName: string,
    sequence: List,
    groups: DefinitionGroups,
    visited: Set<string>,
    references: Set<Node>,
    mask: number = RecurseMask.Left | RecurseMask.Right
  ): number {
    let result = Recursiveness.None;
    let leftIndex = -1;

    // Check left recursion
    if ((mask & RecurseMask.Left) !== 0) {
      leftIndex++;
      let left = Recursiveness.None;
      for (; !(left & Recursiveness.IsExclusive) && leftIndex < sequence.items.length; leftIndex++) {
        left = this.determineExpressionRecursiveness(
          rootName,
          sequence.items[leftIndex] as Node,
          groups,
          visited,
          references,
          RecurseMask.Left
        );
        result |= left;
      }
    }

    // Check right recursion
    let rightIndex = sequence.items.length;
    if ((mask & RecurseMask.Right) !== 0) {
      rightIndex--;
      let right = Recursiveness.None;
      for (; !(right & Recursiveness.IsExclusive) && rightIndex >= 0; rightIndex--) {
        right = this.determineExpressionRecursiveness(
          rootName,
          sequence.items[rightIndex] as Node,
          groups,
          visited,
          references,
          RecurseMask.Right
        );
        if (rightIndex <= leftIndex && (result & Recursiveness.Left) && (right & Recursiveness.Right)) {
          result = (result | Recursiveness.Full) & ~(Recursiveness.Left | Recursiveness.Right);
        } else {
          result |= right;
        }
      }
    }

    // Check for non-recursive sequence
    if ((mask === (RecurseMask.Left | RecurseMask.Right)) &&
        !(result & Recursiveness.Left) &&
        !(result & Recursiveness.Right) &&
        !(result & Recursiveness.Full)) {
      return Recursiveness.Non | (result & Recursiveness.IsExclusive);
    }

    return result;
  }

  private static determineExpressionRecursiveness(
    rootName: string,
    node: Node,
    groups: DefinitionGroups,
    visited: Set<string>,
    references: Set<Node>,
    mask: number
  ): number {
    switch (node.type) {
      case 'repeat':
      case 'separated':
      case 'andNot':
      case 'as':
      case 'declaration': {
        const expr = node.attributes.get('Expression') as Node;
        return this.determineExpressionRecursiveness(rootName, expr, groups, visited, references, mask);
      }

      case 'or': {
        const expressions = node.attributes.get('Expressions') as List;
        let result = Recursiveness.IsExclusive;
        for (const expr of expressions.items) {
          const expressionResult = this.determineExpressionRecursiveness(
            rootName,
            expr as Node,
            groups,
            visited,
            references,
            mask
          );
          result = (result | (expressionResult & ~Recursiveness.IsExclusive)) &
                   (expressionResult | ~Recursiveness.IsExclusive);
        }
        return result;
      }

      case 'group': {
        const sequence = node.attributes.get('Sequence') as List;
        return this.determineSequenceRecursiveness(rootName, sequence, groups, visited, references, mask);
      }

      case 'optional': {
        const sequence = node.attributes.get('Sequence') as List;
        return this.determineSequenceRecursiveness(rootName, sequence, groups, visited, references, mask) &
               ~Recursiveness.IsExclusive;
      }

      case 'reference': {
        const name = (node.attributes.get('Name') as Node).attributes.get('Value') as Text;
        if (name.value === rootName) {
          references.add(node);
          return mask | Recursiveness.IsExclusive;
        }

        if (visited.has(name.value)) {
          return this.returnTerminal(mask);
        }

        visited.add(name.value);
        const targetGroup = groups.get(name.value);
        if (!targetGroup) {
          return this.returnTerminal(mask);
        }

        let result = Recursiveness.IsExclusive;
        for (const definition of Array.from(targetGroup.definitions)) {
          if (name.value === rootName || definition.precedence === Number.MAX_SAFE_INTEGER) {
            const sequence = definition.instance.attributes.get('Sequence') as List;
            const sequenceResult = this.determineSequenceRecursiveness(
              rootName,
              sequence,
              groups,
              visited,
              references,
              mask
            );
            result = (result | (sequenceResult & ~Recursiveness.IsExclusive)) &
                     (sequenceResult | ~Recursiveness.IsExclusive);
          }
        }
        return result;
      }

      default:
        return this.returnTerminal(mask);
    }
  }

  private static returnTerminal(mask: number): number {
    return Recursiveness.IsExclusive |
      ((mask === (RecurseMask.Left | RecurseMask.Right)) ? Recursiveness.Non : Recursiveness.None);
  }

  private static adjustedMinPrecedence(definition: Definition, definitions: Set<Definition>): number {
    return definition.precedence +
      (Array.from(definitions).some(d =>
        d.precedence === definition.precedence &&
        d.associativity === Associativity.Left) ? 1 : 0);
  }

  private static findDeclarationValue(node: Node, name: string): Text | List | null {
    if (node.type === 'declaration') {
      const nameAttr = node.attributes.get('name');
      if (nameAttr && 'value' in nameAttr && nameAttr.value === name) {
        const valueAttr = node.attributes.get('value');
        if (valueAttr && (this.isText(valueAttr) || isList(valueAttr))) {
          return valueAttr;
        }
      }
    }

    for (const [_, value] of Array.from(node.attributes.entries())) {
      if (isNode(value)) {
        const result = this.findDeclarationValue(value, name);
        if (result) return result;
      } else if (isList(value)) {
        const list = value as List;
        for (const item of list.items) {
          if (isNode(item)) {
            const result = this.findDeclarationValue(item, name);
            if (result) return result;
          }
        }
      }
    }

    return null;
  }

  private static isText(value: any): value is Text {
    return value && typeof value === 'object' && 'value' in value && typeof value.value === 'string';
  }
}

