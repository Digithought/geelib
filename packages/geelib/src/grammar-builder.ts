import { isNode, isList } from "./ast/ast.js";
import type { Definition, DefinitionGroup, DefinitionGroups } from "./definition.js";
import { Associativity, RecurseMask, Recursiveness, createDefinition } from "./definition.js";
import type { List, Node, Text } from "./ast/ast.js";
import { Grammar } from "./grammar.js";

/** Build a grammar from an AST */
export function buildGrammar(unit: Node): Grammar {
	const groups: DefinitionGroups = {};

	// Process all definitions
	const definitions = unit.attributes['Definitions'] as List;
	if (!definitions || !definitions.items) {
		throw new Error('No definitions found in grammar');
	}

	// First pass: Create groups
	for (const def of definitions.items) {
		const definition = def as Node;
		const name = definition.attributes['Name'] as Text;
		if (!name || !('value' in name)) continue;

		let group = groups[name.value];
		if (!group) {
			group = {
				definitions: [],
				referenceMinPrecedents: new Map(),
				isLeftRecursive: () => false // Will be updated later
			};
			groups[name.value] = group;
		}

		group.definitions.push(buildDefinition(definition));
	}

	// Second pass: Determine recursiveness and precedence
	for (const [name, group] of Object.entries(groups)) {
		determineGroupRecursiveness(name, group, groups);
	}

	// Third pass: Validate recursiveness
	validateRecursiveness(groups);

	const whitespace = unit.attributes['whitespace'] as Text | undefined;
	if (whitespace && !Object.hasOwn(groups, whitespace.value)) {
		throw new Error(`Whitespace rule ${whitespace.value} not found in grammar`);
	}
	const whitespaceRule = whitespace?.value ?? (Object.hasOwn(groups, '_') ? '_' : undefined);

	const comparer = unit.attributes['comparer'] as Text | undefined;
	const caseSensitive = comparer && comparer.value === 'sensitive';

	const rootName = (definitions.items[0] as Node).attributes['Name'] as Text;

	return new Grammar(groups, rootName.value, { caseSensitive, whitespaceRule });
}

function buildDefinition(node: Node): Definition {
	const name = node.attributes['Name'] as Text;
	const precedence = node.attributes['Precedence'] as Text | undefined;
	const associativity = node.attributes['Associativity'] as Text | undefined;

	const definition = createDefinition(
		name.value,
		precedence ? parseInt(precedence.value) : Number.MAX_SAFE_INTEGER,
		node
	);

	if (associativity) {
		definition.associativity = associativity.value === 'R' ? Associativity.Right : Associativity.Left;
	}

	return definition;
}

function determineGroupRecursiveness(name: string, group: DefinitionGroup, groups: DefinitionGroups): void {
	// Initialize group recursiveness
	group.recursiveness = Recursiveness.None;
	group.referenceMinPrecedents = new Map<Node, number>();

	// Determine recursiveness for each definition in the group
	for (const definition of group.definitions) {
		// Determine recursiveness for this definition
		const references = determineDefinitionRecursiveness(name, definition, groups);

		// Update group recursiveness
		group.recursiveness! |= definition.recursiveness!;

		// Add to the list of incoming recursive reference list with the appropriate minimum precedence
		for (const reference of Array.from(references)) {
			if (!group.referenceMinPrecedents.has(reference)) {
				group.referenceMinPrecedents.set(reference, adjustedMinPrecedence(definition, group.definitions));
			}
		}
	}
}

/**
 * Determines the recursiveness of a single definition
 * @returns A set of references found during recursiveness determination
 */
function determineDefinitionRecursiveness(rootName: string, definition: Definition, groups: DefinitionGroups): Set<Node> {
	const sequence = definition.instance.attributes['Sequence'] as List;
	const visited = new Set<string>();
	const references = new Set<Node>();

	// Determine recursiveness for this definition
	const recursiveness = determineSequenceRecursiveness(rootName, sequence, groups, visited, references);

	// Store recursiveness state
	definition.recursiveness = recursiveness;

	return references;
}

/**
 * Validates the recursiveness of all definitions in all groups
 */
function validateRecursiveness(groups: DefinitionGroups): void {
	for (const [groupName, group] of Object.entries(groups)) {
		for (const definition of group.definitions) {
			// Validate recursiveness based on precedence
			if (definition.precedence === Number.MAX_SAFE_INTEGER) {
				if ((definition.recursiveness! & (Recursiveness.Left | Recursiveness.Right | Recursiveness.Full)) !== Recursiveness.None) {
					throw new Error(`Invalid grammar for definition ${groupName}. Recursive definitions must be given explicit precedence.`);
				}
			} else {
				// Check if this definition is part of a group where any definition is recursive
				const isGroupRecursive = (group.recursiveness! & (Recursiveness.Left | Recursiveness.Right | Recursiveness.Full)) !== Recursiveness.None;

				// Only throw an error if the group is not recursive at all
				if (!isGroupRecursive) {
					throw new Error(`Invalid grammar for definition ${groupName} (precedence ${definition.precedence}). Only recursive definitions may be in an explicit precedence definition.`);
				}
			}
		}
	}
}

function determineSequenceRecursiveness(
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
			left = determineExpressionRecursiveness(
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
			right = determineExpressionRecursiveness(
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

function determineExpressionRecursiveness(
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
			const expr = node.attributes['Expression'] as Node;
			return determineExpressionRecursiveness(rootName, expr, groups, visited, references, mask);
		}

		case 'or': {
			const expressions = node.attributes['Expressions'] as List;
			let result = Recursiveness.IsExclusive;
			for (const expr of expressions.items) {
				const expressionResult = determineExpressionRecursiveness(
					rootName,
					expr as Node,
					groups,
					visited,
					references,
					mask
				);
				result = (result | (expressionResult & ~Recursiveness.IsExclusive))
					& (expressionResult | ~Recursiveness.IsExclusive);
			}
			return result;
		}

		case 'group': {
			const sequence = node.attributes['Sequence'] as List;
			return determineSequenceRecursiveness(rootName, sequence, groups, visited, references, mask);
		}

		case 'optional': {
			const sequence = node.attributes['Sequence'] as List;
			return determineSequenceRecursiveness(rootName, sequence, groups, visited, references, mask) &
						 ~Recursiveness.IsExclusive;
		}

		case 'reference': {
			const name = node.attributes['Name'] as Text;
			if (name.value === rootName) {
				references.add(node);
				return mask | Recursiveness.IsExclusive;
			}

			if (visited.has(name.value)) {
				return returnTerminal(mask);
			}

			visited.add(name.value);
			const targetGroup = groups[name.value];
			if (!targetGroup) {
				return returnTerminal(mask);
			}

			let result = Recursiveness.IsExclusive;
			for (const definition of targetGroup.definitions) {
				if (name.value === rootName || definition.precedence === Number.MAX_SAFE_INTEGER) {
					const sequence = definition.instance.attributes['Sequence'] as List;
					const sequenceResult = determineSequenceRecursiveness(
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
			return returnTerminal(mask);
	}
}

function returnTerminal(mask: number): number {
	return Recursiveness.IsExclusive |
		((mask === (RecurseMask.Left | RecurseMask.Right)) ? Recursiveness.Non : Recursiveness.None);
}

function adjustedMinPrecedence(definition: Definition, definitions: Definition[]): number {
	return definition.precedence +
		(definitions.some(d =>
			d.precedence === definition.precedence &&
			d.associativity === Associativity.Left) ? 1 : 0);
}
