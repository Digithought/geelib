import type { Node, List, Item } from "../ast/ast.js";
import { isNode } from "../ast/ast-helpers.js";
import type { VisitorRule, VisitorContext } from '../visitor.js';

export class SequenceFlattener implements VisitorRule {
	name = 'SequenceFlattener';
	nodeType = ['definition', 'group'];

	visit(node: Node, context: VisitorContext): Node | null {
		if (node.type === 'definition' || node.type === 'group') {
			const sequence = node.attributes['Sequence'] as List;
			if (!sequence) return null;

			const expressions = sequence.items;
			const hasGroup = expressions.some(item => isNode(item) && (
				item.type === 'group' ||
				(item.type === 'optional' && (item.attributes['Sequence'] as List).items.some(i =>
					isNode(i) && i.type === 'group'
				))
			));
			if (!hasGroup) return null;

			// Recursively expand all groups, but preserve optional nodes
			const newExpressions = expressions.flatMap(e => {
				if (isNode(e)) {
					if (e.type === 'group') {
						const groupSequence = e.attributes['Sequence'] as List;
						return this.flattenSequence(groupSequence.items);
					} else if (e.type === 'optional') {
						const optionalSequence = e.attributes['Sequence'] as List;
						const flattened = this.flattenSequence(optionalSequence.items);
						return [{
							type: 'optional' as const,
							attributes: {
								Sequence: { type: 'list', items: flattened } as List
							}
						}];
					}
				}
				return [e];
			});

			return { ...node, attributes: { ...node.attributes, Sequence: { type: 'list', items: newExpressions } as List } };
		}
		return null;
	}

	private flattenSequence(items: Item[]): Item[] {
		return items.flatMap(item => {
			if (isNode(item)) {
				if (item.type === 'group') {
					const groupSequence = item.attributes['Sequence'] as List;
					return this.flattenSequence(groupSequence.items);
				} else if (item.type === 'optional') {
					// Don't flatten optional nodes, just their inner groups
					const optionalSequence = item.attributes['Sequence'] as List;
					return [{
						type: 'optional' as const,
						attributes: {
							Sequence: { type: 'list', items: this.flattenSequence(optionalSequence.items) } as List
						}
					}];
				}
			}
			return [item];
		});
	}
}

export class GroupFlattener implements VisitorRule {
	name = 'GroupFlattener';
	nodeType = 'group';

	visit(node: Node, context: VisitorContext): Node | null {
		if (node.type === 'group') {
			const sequence = node.attributes['Sequence'] as List;
			if (!sequence) return null;

			const expressions = sequence.items;
			const hasGroup = expressions.some(item => isNode(item) && item.type === 'group');
			if (!hasGroup) return null;

			// Recursively expand all groups
			const newExpressions = expressions.flatMap(e => {
				if (isNode(e) && e.type === 'group') {
					const groupSequence = e.attributes['Sequence'] as List;
					return groupSequence.items;
				}
				return [e];
			});

			return { ...node, attributes: { ...node.attributes, Sequence: { type: 'list', items: newExpressions } as List } };
		}
		return null;
	}
}
