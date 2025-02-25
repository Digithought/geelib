import type { Node, Text } from '../types';
import type { VisitorRule, VisitorContext } from '../visitor';

// Rule implementations

export class QuoteExpander implements VisitorRule {
	name = 'QuoteExpander';
	nodeType = 'quote';

	visit(node: Node, context: VisitorContext): Node | null {
		const text = (node.attributes.get('Text') as Text).value;

		// Create the string/char node
		const stringNode: Node = text.length === 1 ? {
			type: 'char',
			attributes: new Map([['Char', { type: 'text', value: text, attributes: new Map() }]])
		} : {
			type: 'string',
			attributes: new Map([['Value', { type: 'text', value: text, attributes: new Map() }]])
		};

		// If no whitespace rule, just return the captured string/char
		if (!context.whitespaceRule) {
			return {
				type: 'capture',
				attributes: new Map([['Expression', stringNode]])
			};
		}

		// Create sequence: whitespace + captured string + whitespace
		return {
			type: 'group',
			attributes: new Map([
				['Sequence', {
					type: 'list',
					items: [
						{
							type: 'reference',
							attributes: new Map([
								['Name', { type: 'text', value: context.whitespaceRule, attributes: new Map() }]
							])
						},
						{
							type: 'capture',
							attributes: new Map([['Expression', stringNode]])
						},
						{
							type: 'reference',
							attributes: new Map([
								['Name', { type: 'text', value: context.whitespaceRule, attributes: new Map() }]
							])
						}
					],
					attributes: new Map()
				}]
			])
		};
	}
}
