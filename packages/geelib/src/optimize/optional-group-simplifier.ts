import type { Node, List } from '../types';
import type { VisitorRule, VisitorContext } from '../visitor';


export class OptionalGroupSimplifier implements VisitorRule {
	name = 'OptionalGroupSimplifier';
	nodeType = 'optional';

	visit(node: Node, context: VisitorContext): Node | null {
		const sequence = node.attributes.get('Sequence') as List;

		// If single child is optional group, absorb child
		if (sequence.items.length === 1) {
			const child = sequence.items[0] as Node;
			if (child.type === 'optional') {
				return {
					type: 'optional',
					attributes: new Map([
						['Sequence', child.attributes.get('Sequence')!]
					])
				};
			}
		}

		// If all children are optional groups, convert to regular group
		if (sequence.items.every(item => (item as Node).type === 'optional')) {
			return {
				type: 'group',
				attributes: new Map([
					['Sequence', sequence]
				])
			};
		}

		return null;
	}
}
