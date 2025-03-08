import type { Item, List, Node, Text, Member } from "../ast/ast.js";
import { isNode, isList, isText } from "../ast/ast.js";
import type { VisitorRule, VisitorContext } from '../visitor.js';

// Rule implementations

export class QuoteExpander implements VisitorRule {
	name = 'QuoteExpander';
	memberName = 'Quote';

	visit(member: Member, context: VisitorContext): Member | undefined {
		const [name, item] = member;

		if (!isNode(item)) {
			return undefined;
		}

		const textItem = item.value['Text'] as Item;
		if (!isText(textItem)) {
			return undefined;
		}

		const text = textItem.value as string;

		// Create the string/char node
		const stringNode: Node = text.length === 1 ? {
			value: {
				Char: { type: 'text', value: text } as Text
			}
		} : {
			value: {
				String: { type: 'text', value: text } as Text
			}
		};

		// If no whitespace rule, just return the captured string/char
		if (!context.whitespaceRule) {
			const captureNode: Node = {
				value: {
					Expression: stringNode
				}
			};
			return [name, captureNode];
		}

		// Create sequence: whitespace + captured string + whitespace
		const groupNode: Node = {
			value: {
				Sequence: {
					type: 'list',
					value: [
						{
							value: {
								Name: { type: 'text', value: context.whitespaceRule } as Text
							}
						} as Node,
						{
							value: {
								Expression: stringNode
							}
						} as Node,
						{
							value: {
								Name: { type: 'text', value: context.whitespaceRule } as Text
							}
						} as Node
					] as Item[]
				} as List
			}
		};

		return [name, groupNode];
	}
}
