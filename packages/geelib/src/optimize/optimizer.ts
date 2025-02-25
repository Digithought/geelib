import type { Node, List, Item, Text } from '../types.js';
import { isNode, isList } from '../types.js';
import { DefinitionGroups } from '../definition.js';
import type { Definition } from '../definition.js';
import { NodeVisitor } from '../visitor.js';
import { QuoteExpander } from './quote-expander.js';
import { CaptureSimplifier } from './capture-simplifier.js';
import { SequenceFlattener } from './sequence-flattener.js';
import { OrFlattener } from './or-flattener.js';
import { OptionalGroupSimplifier } from './optional-group-simplifier.js';
import { GroupSimplifier } from './group-simplifier.js';

interface OptimizerContext {
  originals: DefinitionGroups;
  optimized: DefinitionGroups;
  root: string;
  referenceReplacements: Map<string, Node>;
}

export class Optimizer {
  static process(definitions: DefinitionGroups, root: string): DefinitionGroups {
    let context: OptimizerContext = {
      originals: definitions,
      optimized: new DefinitionGroups(),
      root,
      referenceReplacements: new Map()
    };

    // Create and configure visitor
    const visitor = new NodeVisitor();
    visitor.addRule(new QuoteExpander());
    visitor.addRule(new GroupSimplifier());
    visitor.addRule(new OptionalGroupSimplifier());
    visitor.addRule(new OrFlattener());
    visitor.addRule(new SequenceFlattener());
    visitor.addRule(new CaptureSimplifier());

    // First pass: Canonicalize and optimize
    for (const [groupName, group] of context.originals.entries()) {
      const optimizedDefinitions = new Set<Definition>();

      for (const definition of group.definitions) {
        // Apply visitor transformations
        const transformed = visitor.visit(definition.instance, {
          whitespaceRule: context.originals.has('_') ? '_' : undefined
        });

        // Create optimized definition
        const optimizedDef = {
          ...definition,
          instance: transformed
        };
        optimizedDefinitions.add(optimizedDef);
      }

      // Update the group with optimized definitions
      context.optimized.set(groupName, {
        definitions: optimizedDefinitions,
        referenceMinPrecedents: group.referenceMinPrecedents,
        isLeftRecursive: group.isLeftRecursive
      });
    }

    // Second pass with optimized definitions
    context = {
      originals: context.optimized,
      optimized: new DefinitionGroups(),
      root,
      referenceReplacements: new Map()
    };

    // Second pass: Handle reference replacements and final optimizations
    for (const [groupName, group] of context.originals.entries()) {
      const optimizedDefinitions = new Set<Definition>();
      const performPushUps = groupName !== context.root && group.definitions.size === 1;

      for (const definition of group.definitions) {
        if (performPushUps) {
          const sequence = definition.instance.attributes.get('Sequence') as List;
          context.referenceReplacements.set(
            definition.name,
            this.computePushUps(context, definition.name, sequence)
          );
        }
        optimizedDefinitions.add(definition);
      }

      context.optimized.set(groupName, {
        definitions: optimizedDefinitions,
        referenceMinPrecedents: group.referenceMinPrecedents,
        isLeftRecursive: group.isLeftRecursive
      });
    }

    return context.optimized;
  }

  private static computePushUps(context: OptimizerContext, definitionName: string, sequence: List): Node {
    const pushedUp: Item[] = [];

    // Push up all non-declarations
    let i = 0;
    for (; i < sequence.items.length; i++) {
      const expression = sequence.items[i] as Node;
      if (this.containsDeclaration(expression)) break;
      pushedUp.push(expression);
    }

    // Remove pushed up nodes from sequence
    sequence.items.splice(0, pushedUp.length);

    // If there are pushed up nodes, create appropriate structure
    if (pushedUp.length > 0) {
      if (sequence.items.length > 0) {
        pushedUp.push({
          type: 'reference',
          attributes: new Map([
            ['Name', { type: 'text', value: definitionName, attributes: new Map() }]
          ])
        });
      }

      return pushedUp.length === 1
        ? pushedUp[0] as Node
        : {
            type: 'group',
            attributes: new Map([
              ['Sequence', { type: 'list', items: pushedUp, attributes: new Map() }]
            ])
          };
    }

    return {
      type: 'reference',
      attributes: new Map([
        ['Name', { type: 'text', value: definitionName, attributes: new Map() }]
      ])
    };
  }

  private static containsDeclaration(node: Node): boolean {
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
}
