import type { Node, List } from "../ast/ast.js";
import type { VisitorRule, VisitorContext } from '../visitor.js';


export class OptionalSimplifier implements VisitorRule {
	name = 'OptionalSimplifier';
	memberName = 'optional';

	visit(node: Node, context: VisitorContext): Node | null {
		const sequence = node.attributes['Sequence'] as List;

		// If single child is optional group, absorb child
		if (sequence.items.length === 1) {
			const child = sequence.items[0] as Node;
			if (child.type === 'optional') {
				return {
					type: 'optional',
					attributes: {
						Sequence: child.attributes['Sequence']
					}
				} as Node;
			}
		}

		// If all children are optional groups, convert to regular group
		if (sequence.items.every(item => (item as Node).type === 'optional')) {
			return {
				type: 'group',
				attributes: {
					Sequence: sequence
				}
			};
		}

		return null;
	}
}
