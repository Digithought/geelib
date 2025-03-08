import { isNode, isList, singleMember, getTextValue } from "./ast/ast.js";
import type { Definition, DefinitionGroup, DefinitionGroups } from "./definition.js";
import { Associativity, RecurseMask, Recursiveness, createDefinition } from "./definition.js";
import type { List, Node, Text, Item } from "./ast/ast.js";
import { Grammar } from "./grammar.js";

/** Build a grammar from an AST */
export function buildGrammar(unit: Node): Grammar {
	const groups: DefinitionGroups = {};

	// Process all definitions
	const definitions = unit.value['Definitions'] as List;
	if (!definitions || !isList(definitions) || definitions.value.length === 0) {
		throw new Error('No definitions found in grammar');
	}

	// First pass: Create groups
	for (const def of definitions.value) {
		if (!isNode(def)) continue;

		const definition = def;
		const nameValue = getTextValue(definition, 'Name');
		if (!nameValue) continue;

		let group = groups[nameValue];
		if (!group) {
			group = {
				definitions: [],
				referenceMinPrecedents: new Map(),
				isLeftRecursive: () => false // Will be updated later
			};
			groups[nameValue] = group;
		}

		group.definitions.push(buildDefinition(definition));
	}

	// Second pass: Determine recursiveness and precedence
	for (const [name, group] of Object.entries(groups)) {
		determineGroupRecursiveness(name, group, groups);
	}

	// Third pass: Validate recursiveness
	validateRecursiveness(groups);

	const whitespaceValue = getTextValue(unit, 'whitespace');
	if (whitespaceValue && !Object.hasOwn(groups, whitespaceValue)) {
		throw new Error(`Whitespace rule ${whitespaceValue} not found in grammar`);
	}
	const whitespaceRule = whitespaceValue ?? (Object.hasOwn(groups, '_') ? '_' : undefined);

	const comparerValue = getTextValue(unit, 'comparer');
	const caseSensitive = comparerValue === 'sensitive';

	const firstDef = definitions.value[0];
	if (!isNode(firstDef)) {
		throw new Error('First definition is not a node');
	}
	const rootName = getTextValue(firstDef, 'Name');
	if (!rootName) {
		throw new Error('First definition has no name');
	}

	return new Grammar(groups, rootName, { caseSensitive, whitespaceRule });
}

function buildDefinition(node: Node): Definition {
	const nameValue = getTextValue(node, 'Name');
	if (!nameValue) {
		throw new Error('Definition has no name');
	}

	const precedenceValue = getTextValue(node, 'Precedence');
	const associativityValue = getTextValue(node, 'Associativity');

	const definition = createDefinition(
		nameValue,
		precedenceValue ? parseInt(precedenceValue) : Number.MAX_SAFE_INTEGER,
		node
	);

	if (associativityValue) {
		definition.associativity = associativityValue === 'R' ? Associativity.Right : Associativity.Left;
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
	const sequence = definition.instance.value['Sequence'] as List;
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
	if (!sequence || !isList(sequence)) {
		return Recursiveness.None;
	}

	let result = Recursiveness.None;
	let leftIndex = -1;

	// Check left recursion
	if ((mask & RecurseMask.Left) !== 0) {
		leftIndex++;
		let left = Recursiveness.None;
		for (; !(left & Recursiveness.IsExclusive) && leftIndex < sequence.value.length; leftIndex++) {
			const item = sequence.value[leftIndex];
			if (!isNode(item)) continue;

			left = determineExpressionRecursiveness(
				rootName,
				item,
				groups,
				visited,
				references,
				RecurseMask.Left
			);
			result |= left;
		}
	}

	// Check right recursion
	let rightIndex = sequence.value.length;
	if ((mask & RecurseMask.Right) !== 0) {
		rightIndex--;
		let right = Recursiveness.None;
		for (; !(right & Recursiveness.IsExclusive) && rightIndex >= 0; rightIndex--) {
			const item = sequence.value[rightIndex];
			if (!isNode(item)) continue;

			right = determineExpressionRecursiveness(
				rootName,
				item,
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
	// Get the node type from the first member
	const member = singleMember(node);
	if (!member) return Recursiveness.None;

	const nodeType = member[0];

	switch (nodeType) {
		case 'Repeat':
		case 'Separated':
		case 'AndNot':
		case 'As':
		case 'Declaration': {
			const expr = node.value['Expression'] as Node;
			if (!expr) return Recursiveness.None;
			return determineExpressionRecursiveness(rootName, expr, groups, visited, references, mask);
		}

		case 'Or': {
			const expressions = node.value['Expressions'] as List;
			if (!expressions || !isList(expressions)) return Recursiveness.None;

			let result = Recursiveness.IsExclusive;
			for (const expr of expressions.value) {
				if (!isNode(expr)) continue;

				const expressionResult = determineExpressionRecursiveness(
					rootName,
					expr,
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

		case 'Group': {
			const sequence = node.value['Sequence'] as List;
			if (!sequence) return Recursiveness.None;
			return determineSequenceRecursiveness(rootName, sequence, groups, visited, references, mask);
		}

		case 'Optional': {
			const sequence = node.value['Sequence'] as List;
			if (!sequence) return Recursiveness.None;
			return determineSequenceRecursiveness(rootName, sequence, groups, visited, references, mask) &
						 ~Recursiveness.IsExclusive;
		}

		case 'Reference': {
			const nameValue = getTextValue(node.value['Name'] as Node, 'Value');
			if (!nameValue) return Recursiveness.None;

			if (nameValue === rootName) {
				// Found a recursive reference
				references.add(node);
				if ((mask & RecurseMask.Left) !== 0) {
					return Recursiveness.Left | Recursiveness.IsExclusive;
				} else if ((mask & RecurseMask.Right) !== 0) {
					return Recursiveness.Right | Recursiveness.IsExclusive;
				} else {
					return Recursiveness.None;
				}
			}

			// If we've already visited this group, don't recurse
			if (visited.has(nameValue)) {
				return Recursiveness.None;
			}

			// Get the referenced group
			const group = groups[nameValue];
			if (!group) {
				return returnTerminal(mask);
			}

			// Mark as visited to prevent infinite recursion
			visited.add(nameValue);

			// Determine recursiveness for the referenced group
			let result = Recursiveness.None;
			for (const definition of group.definitions) {
				const sequence = definition.instance.value['Sequence'] as List;
				if (!sequence) continue;

				result |= determineSequenceRecursiveness(rootName, sequence, groups, visited, references, mask);
			}

			// Remove from visited set
			visited.delete(nameValue);

			return result;
		}

		default:
			return returnTerminal(mask);
	}
}

function returnTerminal(mask: number): number {
	return ((mask & RecurseMask.Left) !== 0 ? Recursiveness.IsExclusive : Recursiveness.None) |
				 ((mask & RecurseMask.Right) !== 0 ? Recursiveness.IsExclusive : Recursiveness.None);
}

function adjustedMinPrecedence(definition: Definition, definitions: Definition[]): number {
	// Find the minimum precedence of all definitions with the same name
	let minPrecedence = definition.precedence;
	for (const def of definitions) {
		if (def.name === definition.name && def.precedence < minPrecedence) {
			minPrecedence = def.precedence;
		}
	}
	return minPrecedence;
}
