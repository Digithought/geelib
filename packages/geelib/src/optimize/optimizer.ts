import type { Node, List, Item, Text } from "../ast/ast.js";
import { isNode, isList } from "../ast/ast-helpers.js";
import type { DefinitionGroups } from '../definition.js';
import type { Definition } from '../definition.js';
import { NodeVisitor } from '../visitor.js';
import { QuoteExpander } from './quote-expander.js';
import { CaptureSimplifier } from './capture-simplifier.js';
import { SequenceFlattener, GroupFlattener } from './sequence-flattener.js';
import { OrFlattener } from './or-flattener.js';
import { OptionalGroupSimplifier } from './optional-group-simplifier.js';
import { GroupSimplifier } from './group-simplifier.js';
import { Grammar, OptimizedGrammar } from '../grammar.js';
import type { GrammarOptions } from '../grammar.js';

interface OptimizerContext {
  originals: DefinitionGroups;
  optimized: DefinitionGroups;
  root: string;
  referenceReplacements: Map<string, Node>;
  options: GrammarOptions;
}

/**
 * Process a grammar to optimize it
 *
 * @param grammar The grammar to optimize
 * @returns Optimized grammar
 */
export function optimize(grammar: Grammar): OptimizedGrammar {
	if (grammar instanceof OptimizedGrammar) {
		return grammar;
	}

	let context: OptimizerContext = {
		originals: grammar.definitions,
		optimized: {},
		root: grammar.root,
		referenceReplacements: new Map(),
		options: grammar.options || {}
	};

	// Create and configure visitor
	const visitor = new NodeVisitor();
	visitor.addRule(new QuoteExpander());
	visitor.addRule(new GroupSimplifier());
	visitor.addRule(new OptionalGroupSimplifier());
	visitor.addRule(new OrFlattener());
	visitor.addRule(new CaptureSimplifier());
	visitor.addRule(new GroupFlattener());
	visitor.addRule(new SequenceFlattener());

	// First pass: Canonicalize and optimize
	for (const [groupName, group] of Object.entries(context.originals)) {
		const optimizedDefinitions: Definition[] = [];

		for (const definition of group.definitions) {
			// Apply visitor transformations
			const transformed = visitor.visit(definition.instance, {
				whitespaceRule: context.options.whitespaceRule
			});

			// Create optimized definition
			const optimizedDef = {
				...definition,
				instance: transformed
			};
			optimizedDefinitions.push(optimizedDef);
		}

		// Update the group with optimized definitions
		context.optimized[groupName] = {
			definitions: optimizedDefinitions,
			referenceMinPrecedents: group.referenceMinPrecedents,
			isLeftRecursive: group.isLeftRecursive
		};
	}

	// Second pass with optimized definitions
	context = {
		originals: context.optimized,
		optimized: {},
		root: grammar.root,
		referenceReplacements: new Map(),
		options: context.options
	};

	// Second pass: Handle reference replacements and final optimizations
	for (const [groupName, group] of Object.entries(context.originals)) {
		const optimizedDefinitions: Definition[] = [];
		const performPushUps = groupName !== context.root && group.definitions.length === 1;

		for (const definition of group.definitions) {
			if (performPushUps) {
				const sequence = definition.instance.attributes['Sequence'] as List;
				// Only compute push-ups if there are no optional nodes
				if (!sequence.items.some(item => isNode(item) && item.type === 'optional')) {
					context.referenceReplacements.set(
						definition.name,
						computePushUps(context, definition.name, sequence)
					);
				}
			}
			optimizedDefinitions.push(definition);
		}

		context.optimized[groupName] = {
			definitions: optimizedDefinitions,
			referenceMinPrecedents: group.referenceMinPrecedents,
			isLeftRecursive: group.isLeftRecursive
		};
	}

	return new OptimizedGrammar(
		context.optimized,
		grammar.root,
		grammar.options
	);
}

function computePushUps(context: OptimizerContext, definitionName: string, sequence: List): Node {
	const pushedUp: Item[] = [];

	// Push up all non-declarations
	let i = 0;
	for (; i < sequence.items.length; i++) {
		const expression = sequence.items[i] as Node;
		if (containsDeclaration(expression) || expression.type === 'optional') break;
		pushedUp.push(expression);
	}

	// Remove pushed up nodes from sequence
	sequence.items.splice(0, pushedUp.length);

	// If there are pushed up nodes, create appropriate structure
	if (pushedUp.length > 0) {
		if (sequence.items.length > 0) {
			pushedUp.push({
				type: 'reference',
				attributes: {
					Name: { type: 'text', value: definitionName }
				}
			} as Node);
		}

		return pushedUp.length === 1
			? pushedUp[0] as Node
			: {
					type: 'group',
					attributes: {
						Sequence: { type: 'list', items: pushedUp } as List
					}
				};
	}

	return {
		type: 'reference',
		attributes: {
			Name: { type: 'text', value: definitionName } as Text
		}
	};
}

function containsDeclaration(node: Node): boolean {
	if (node.type === 'declaration') return true;

	const values = Object.values(node.attributes);
	for (const value of values) {
		if (isNode(value)) {
			if (containsDeclaration(value)) return true;
		} else if (isList(value)) {
			const list = value as List;
			for (const item of list.items) {
				if (isNode(item) && containsDeclaration(item)) return true;
			}
		}
	}

	return false;
}
