import type { Node, Item, List } from '../types';
import { isNode, isList } from '../types';
import type { VisitorRule, VisitorContext } from '../visitor';


export class SequenceFlattener implements VisitorRule {
	name = 'SequenceFlattener';
	nodeType = 'sequence';

	visit(node: Node, context: VisitorContext): Node | null {
		const hasDirectGroupChild = Array.from(node.attributes.values()).some(value =>
			isList(value) && value.items.some(item => isNode(item) && item.type === 'group'));

		if (!hasDirectGroupChild) return null;

		// Expand direct child groups
		const newAttributes = new Map();
		for (const [key, value] of node.attributes.entries()) {
			if (isList(value)) {
				const flattened: Item[] = [];
				for (const item of value.items) {
					if (isNode(item) && item.type === 'group') {
						const groupSeq = item.attributes.get('Sequence') as List;
						flattened.push(...groupSeq.items);
					} else {
						flattened.push(item);
					}
				}
				newAttributes.set(key, { type: 'list', items: flattened, attributes: value.attributes });
			} else {
				newAttributes.set(key, value);
			}
		}

		return { ...node, attributes: newAttributes };
	}
}
