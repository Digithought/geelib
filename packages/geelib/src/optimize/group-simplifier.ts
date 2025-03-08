import type { Node, List, Item, Member } from "../ast/ast.js";
import { isNode, isList } from "../ast/ast.js";
import type { VisitorRule, VisitorContext } from '../visitor.js';


export class GroupSimplifier implements VisitorRule {
	name = 'GroupSimplifier';
	memberName = 'Group';

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
		if (sequenceItems.length === 1) {
			const firstItem = sequenceItems[0];
			if (firstItem) {
				return [name, firstItem];
			}
		}

		return undefined;
	}
}
