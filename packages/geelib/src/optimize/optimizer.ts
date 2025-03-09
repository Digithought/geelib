import type { Grammar, GrammarOptions } from '../grammar.js';
import type { Node, List, Item, Text, Member } from "../ast/ast.js";
import { isNode, isList, item } from "../ast/ast.js";
import { NodeVisitor } from '../visitor.js';
import type { VisitorContext } from '../visitor.js';

// Import optimizers
import { CaptureSimplifier } from './capture-simplifier.js';
import { GroupSimplifier } from './group-simplifier.js';
import { OptionalSimplifier } from './optional-group-simplifier.js';
import { OrFlattener } from './or-flattener.js';
import { QuoteExpander } from './quote-expander.js';
import { SequenceFlattener, GroupFlattener } from './sequence-flattener.js';

// Import from definition.js instead of redefining
import type { Definition, DefinitionGroups, DefinitionGroup, Associativity } from '../definition.js';

// Define OptimizedGrammar class
export class OptimizedGrammar implements Grammar {
	definitions: DefinitionGroups;
	root: string;
	options: GrammarOptions;

	constructor(definitions: DefinitionGroups, root: string, options: GrammarOptions) {
		this.definitions = definitions;
		this.root = root;
		this.options = options;
	}

	withDefinitions(definitions: DefinitionGroups): Grammar {
		return new OptimizedGrammar(definitions, this.root, this.options);
	}
}

interface OptimizerContext {
	originals: DefinitionGroups;
	optimized: DefinitionGroups;
	root: string;
	referenceReplacements: Map<string, Node>;
	options: GrammarOptions;
}

/**
 * Optimizes a grammar by applying various transformations.
 * @param grammar The grammar to optimize
 * @returns Optimized grammar
 */
export function optimize(grammar: Grammar): OptimizedGrammar {
	if (grammar instanceof OptimizedGrammar) {
		return grammar;
	}

	const context: OptimizerContext = {
		originals: grammar.definitions,
		optimized: {},
		root: grammar.root,
		referenceReplacements: new Map(),
		options: grammar.options
	};

	// Create visitor with all optimization rules
	const visitor = new NodeVisitor();
	visitor.addRule(new CaptureSimplifier());
	visitor.addRule(new GroupSimplifier());
	visitor.addRule(new OptionalSimplifier());
	visitor.addRule(new OrFlattener());
	visitor.addRule(new QuoteExpander());
	visitor.addRule(new GroupFlattener());
	visitor.addRule(new SequenceFlattener());

	// First pass: Canonicalize and optimize
	for (const [groupName, group] of Object.entries(context.originals)) {
		const optimizedDefinitions: Definition[] = [];

		for (const definition of group.definitions) {
			// Apply visitor transformations
			const memberName = 'definition';
			const member: Member = [memberName, definition.instance];
			const transformed = visitor.visit(member, {
				whitespaceRule: context.options.whitespaceRule
			});

			// Create optimized definition
			const optimizedDef = {
				...definition,
				instance: transformed ? transformed[1] as Node : definition.instance
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

	// Second pass: Compute push-ups for non-root, single-definition groups
	// This helps with left-recursion elimination
	for (const [groupName, group] of Object.entries(context.originals)) {
		const optimizedDefinitions: Definition[] = [];
		const performPushUps = groupName !== context.root && group.definitions.length === 1;

		for (const definition of group.definitions) {
			if (performPushUps) {
				const sequence = definition.instance.value['Sequence'] as List;
				// Only compute push-ups if there are no optional nodes
				if (!sequence.value.some(item =>
					isNode(item) && 'Optional' in item.value
				)) {
					context.referenceReplacements.set(
						definition.name,
						computePushUps(context, definition.name, sequence as List)
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
	// Find all items that can be pushed up (i.e., items before any optional or declaration)
	const pushedUp: Item[] = [];

	for (const expression of sequence.value) {
		if (isNode(expression) && ('Optional' in expression.value || containsDeclaration(expression))) break;
		pushedUp.push(expression);
	}

	// If nothing to push up, return the original node
	if (pushedUp.length === 0) {
		return item({});
	}

	// Remove the pushed up items from the original sequence
	sequence.value.splice(0, pushedUp.length);

	// If the sequence is now empty, add a reference to the definition
	// This prevents infinite recursion
	if (sequence.value.length === 0) {
		pushedUp.push(item({ Reference: item({ Name: item(definitionName) }) }));
	}

	// Create a new group node with the pushed up items
	return item({ Sequence: item(pushedUp) });
}

function containsDeclaration(node: Node): boolean {
	if (!isNode(node)) return false;
	if ('Declaration' in node.value) return true;

	const values = Object.values(node.value);
	for (const value of values) {
		if (isNode(value)) {
			if (containsDeclaration(value)) return true;
		} else if (isList(value)) {
			const list = value;
			for (const item of list.value as Item[]) {
				if (isNode(item) && containsDeclaration(item)) return true;
			}
		}
	}
	return false;
}
