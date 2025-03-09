import { isNode, isList, singleMember, getTextValue } from "./ast/ast.js";
import type { Associativity, Definition, DefinitionGroup, DefinitionGroups } from "./definition.js";
import { RecurseMask, Recursiveness, createDefinition } from "./definition.js";
import type { List, Node, Text, Item } from "./ast/ast.js";
import { Grammar } from "./grammar.js";

/** Build a grammar from an AST */
export function buildGrammar(node: Item): Grammar {
	const groups: DefinitionGroups = {};

	// Check if the AST has a Unit property
	if (!isNode(node) || node.value['Unit'] === undefined) {
		throw new Error('Grammar must be a Node with a Unit property');
	}

	const unit = node.value['Unit'] as Node;
	if (!isNode(unit)) throw new Error('Unit must be a Node');

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

	// Get whitespace rule
	let whitespaceRule: string | undefined;
	const whitespaceValue = getTextValue(unit, 'Whitespace');
	if (whitespaceValue) {
		if (!Object.hasOwn(groups, whitespaceValue)) {
			throw new Error(`Whitespace rule ${whitespaceValue} not found in grammar`);
		}
		whitespaceRule = whitespaceValue;
	} else if (Object.hasOwn(groups, '_')) {
		whitespaceRule = '_';
	}

	// Get case sensitivity
	const comparerValue = getTextValue(unit, 'Comparer');
	const caseSensitive = comparerValue === 'sensitive';

	// Get the root name
	let rootName: string;
	const rootValue = getTextValue(unit, 'Root');
	if (rootValue) {
		rootName = rootValue;
	} else {
		// Use the first definition if no root is specified
		const firstDef = definitions.value[0];
		if (!isNode(firstDef)) {
			throw new Error('First definition is not a node');
		}
		const name = getTextValue(firstDef, 'Name');
		if (!name) {
			throw new Error('First definition has no name');
		}
		rootName = name;
	}

	return new Grammar(groups, rootName, { caseSensitive, whitespaceRule });
}

/** Build a definition from an AST node */
export function buildDefinition(node: Node): Definition {
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
		// Validate associativity value
		if (associativityValue !== 'L' && associativityValue !== 'R') {
			throw new Error(
				`Invalid associativity '${associativityValue}' for definition '${nameValue}'.\n` +
				`Associativity must be 'L' (left) or 'R' (right).`
			);
		}
		definition.associativity = associativityValue;
	}
	// Default is 'L' (set in createDefinition)

	return definition;
}

/** Determine the recursiveness of a definition group */
export function determineGroupRecursiveness(name: string, group: DefinitionGroup, groups: DefinitionGroups): void {
	// Initialize group recursiveness
	group.recursiveness = Recursiveness.None;
	group.referenceMinPrecedents = new Map<Node, number>();

	// Determine recursiveness for each definition in the group
	for (const definition of group.definitions) {
		// Determine recursiveness for this definition (without validation)
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
		validateGroupRecursiveness(groupName, group);
	}
}

/**
 * Validates the recursiveness of a definition group
 */
function validateGroupRecursiveness(groupName: string, group: DefinitionGroup): void {
	const isGroupRecursive = (group.recursiveness! & (Recursiveness.Left | Recursiveness.Right | Recursiveness.Full)) !== Recursiveness.None;

	for (const definition of group.definitions) {
		validateDefinitionRecursiveness(definition, isGroupRecursive);
	}
}

/**
 * Validates the recursiveness of a single definition
 */
function validateDefinitionRecursiveness(definition: Definition, isGroupRecursive: boolean): void {
	const isRecursive = (definition.recursiveness! & (Recursiveness.Left | Recursiveness.Right | Recursiveness.Full)) !== Recursiveness.None;
	const hasExplicitPrecedence = definition.precedence !== Number.MAX_SAFE_INTEGER;

	if (isRecursive && !hasExplicitPrecedence) {
		throw new Error(
			`Invalid grammar for definition '${definition.name}'. Recursive definitions must have explicit precedence.\n` +
			`Add a precedence value after the definition name, e.g., '${definition.name} 0 :='`
		);
	}

	if (!isRecursive && hasExplicitPrecedence) {
		throw new Error(
			`Invalid grammar for definition '${definition.name}' (precedence ${definition.precedence}). Only recursive definitions may have explicit precedence.\n` +
			`Remove the precedence value, e.g., change '${definition.name} ${definition.precedence} :=' to '${definition.name} :='`
		);
	}
}

/**
 * Determines the recursiveness of a sequence
 * This function analyzes a sequence to determine if it contains recursive references
 * and classifies the recursion as left, right, or full.
 * It handles optional elements by tracking exclusivity.
 */
function determineSequenceRecursiveness(
	rootName: string,
	sequence: List,
	groups: DefinitionGroups,
	visited: Set<string>,
	references: Set<Node>,
	mask: number = RecurseMask.Left | RecurseMask.Right
): number {
	if (!sequence || !isList(sequence) || sequence.value.length === 0) {
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

			// If we found an exclusive left recursion, stop checking
			if (left & Recursiveness.IsExclusive) {
				break;
			}
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

			// Check for full recursion (both left and right)
			if (rightIndex <= leftIndex && (result & Recursiveness.Left) && (right & Recursiveness.Right)) {
				result = (result | Recursiveness.Full) & ~(Recursiveness.Left | Recursiveness.Right);
			} else {
				result |= right;
			}

			// If we found an exclusive right recursion, stop checking
			if (right & Recursiveness.IsExclusive) {
				break;
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

/**
 * Determines the recursiveness of an expression
 * This function analyzes an expression to determine if it contains recursive references
 * and classifies the recursion as left, right, or full.
 * It tracks exclusivity to handle optional elements correctly.
 */
function determineExpressionRecursiveness(
	rootName: string,
	node: Node,
	groups: DefinitionGroups,
	visited: Set<string>,
	references: Set<Node>,
	mask: number
): number {
	// Get the type of the expression
	const memberTuple = singleMember(node);
	if (!memberTuple) return Recursiveness.None;

	const type = memberTuple[0]; // Extract the string from the Member tuple

	switch (type) {
		case 'Reference': {
			// Get the name of the referenced definition
			const nameValue = getTextValue(node, 'Name');
			if (!nameValue) return Recursiveness.None;

			// Add to references
			references.add(node);

			// Check if this is a recursive reference to the root
			if (nameValue === rootName) {
				// Determine recursion type based on mask
				if (mask === RecurseMask.Left) return Recursiveness.Left | Recursiveness.IsExclusive;
				if (mask === RecurseMask.Right) return Recursiveness.Right | Recursiveness.IsExclusive;
				return Recursiveness.None; // Middle references don't contribute to recursion type
			}

			// Check if we've already visited this definition to prevent infinite recursion
			if (visited.has(nameValue)) return Recursiveness.None;

			// Get the referenced definition group
			const group = groups[nameValue];
			if (!group) return returnTerminal(mask);

			// Add to visited set to prevent infinite recursion
			visited.add(nameValue);

			// Recursively check the referenced definition group
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

		case 'Sequence':
		case 'Group': {
			// Get the sequence
			const sequence = node.value['Sequence'] as List;
			if (!sequence) return Recursiveness.None;

			// Recursively check the sequence
			return determineSequenceRecursiveness(rootName, sequence, groups, visited, references, mask);
		}

		case 'Optional': {
			// Get the sequence
			const sequence = node.value['Sequence'] as List;
			if (!sequence) return Recursiveness.None;

			// Optional elements are non-exclusive
			return determineSequenceRecursiveness(rootName, sequence, groups, visited, references, mask) & ~Recursiveness.IsExclusive;
		}

		case 'Or': {
			// Get the expressions
			const expressions = node.value['Expressions'] as List;
			if (!expressions) return Recursiveness.None;

			// Recursively check each expression
			let result = Recursiveness.None;
			for (const expr of expressions.value) {
				if (!isNode(expr)) continue;

				const expressionResult = determineExpressionRecursiveness(rootName, expr, groups, visited, references, mask);

				// Combine recursiveness flags
				result |= (expressionResult & ~Recursiveness.IsExclusive);

				// If any expression is exclusive, the result is exclusive
				if (expressionResult & Recursiveness.IsExclusive) {
					result |= Recursiveness.IsExclusive;
				}
			}

			return result;
		}

		case 'Repeat':
		case 'Capture':
		case 'Declaration': {
			// Get the expression
			const expression = node.value['Expression'] as Node;
			if (!isNode(expression)) return Recursiveness.None;

			// Recursively check the expression
			return determineExpressionRecursiveness(rootName, expression, groups, visited, references, mask);
		}

		case 'As':
		case 'AndNot': {
			// Get the expression
			const expression = node.value['Expression'] as Node;
			if (!isNode(expression)) return Recursiveness.None;

			// Recursively check the expression
			return determineExpressionRecursiveness(rootName, expression, groups, visited, references, mask);
		}

		case 'Separated': {
			// Get the expression and separator
			const expression = node.value['Expression'] as Node;
			const separator = node.value['Separator'] as Node;

			let result = Recursiveness.None;

			// Recursively check the expression
			if (isNode(expression)) {
				result |= determineExpressionRecursiveness(rootName, expression, groups, visited, references, mask);
			}

			// Recursively check the separator
			if (isNode(separator)) {
				result |= determineExpressionRecursiveness(rootName, separator, groups, visited, references, mask);
			}

			return result;
		}

		// Terminal expressions that don't contain references
		case 'Range':
		case 'Char':
		case 'String':
		case 'CharSet':
			return returnTerminal(mask);

		default:
			// For unknown node types, try to process their children
			for (const [key, value] of Object.entries(node.value)) {
				if (isList(value)) {
					return determineSequenceRecursiveness(rootName, value, groups, visited, references, mask);
				}
			}

			return returnTerminal(mask);
	}
}

/**
 * Returns the appropriate terminal recursiveness value based on the mask
 */
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
