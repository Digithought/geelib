import type { Item, List, Node, Text } from "../ast/ast";
import type { VisitorRule, VisitorContext } from '../visitor';

// Rule implementations

export class QuoteExpander implements VisitorRule {
	name = 'QuoteExpander';
	nodeType = 'quote';

	visit(node: Node, context: VisitorContext): Node | null {
		const text = (node.attributes['Text'] as Text).value;

		// Create the string/char node
		const stringNode: Node = text.length === 1 ? {
			type: 'char',
			attributes: { Char: { type: 'text', value: text } as Text }
		} : {
			type: 'string',
			attributes: { Value: { type: 'text', value: text } as Text }
		};

		// If no whitespace rule, just return the captured string/char
		if (!context.whitespaceRule) {
			return { type: 'capture', attributes: { Expression: stringNode } };
		}

		// Create sequence: whitespace + captured string + whitespace
		return {
			type: 'group',
			attributes: {
				Sequence: {
					type: 'list',
					items: [
						{
							type: 'reference',
							attributes: {
								Name: { type: 'text', value: context.whitespaceRule } as Text
							}
						},
						{
							type: 'capture',
							attributes: { Expression: stringNode }
						} as Node,
						{
							type: 'reference',
							attributes: new Map([
								['Name', { type: 'text', value: context.whitespaceRule }]
							])
						}
					] as Item[]
				} as List
			}
		};
	}
}
