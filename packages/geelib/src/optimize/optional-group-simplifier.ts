import type { Node, List, Item, Member } from "../ast/ast.js";
import { isNode, isList } from "../ast/ast.js";
import type { VisitorRule, VisitorContext } from '../visitor.js';


export class OptionalSimplifier implements VisitorRule {
	name = 'OptionalSimplifier';
	memberName = 'optional';

	visit(member: Member, context: VisitorContext): Member | undefined {
		const [name, item] = member;

		if (!isNode(item)) {
			return undefined;
		}

		const sequence = item.value['Sequence'] as Item;

		if (!isList(sequence)) {
			return undefined;
		}

		const sequenceItems = sequence.value as Item[];

		// If single child is optional group, absorb child
		if (sequenceItems.length === 1) {
			const child = sequenceItems[0];
			if (isNode(child) && 'type' in child && child.type === 'optional') {
				const childSequence = child.value['Sequence'];
				if (childSequence) {
					const optionalNode: Node = {
						value: {
							Sequence: childSequence
						}
					};
					return [name, optionalNode];
				}
			}
		}

		// If all children are optional groups, convert to regular group
		if (sequenceItems.every((childItem: Item) => isNode(childItem) && 'type' in childItem && childItem.type === 'optional')) {
			const groupNode: Node = {
				value: {
					Sequence: sequence
				}
			};
			return [name, groupNode];
		}

		return undefined;
	}
}
