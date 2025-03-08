import type { Node, List, Item, Member } from "../ast/ast.js";
import { isNode, isList } from "../ast/ast.js";
import type { VisitorRule, VisitorContext } from '../visitor.js';

export class SequenceFlattener implements VisitorRule {
	name = 'SequenceFlattener';
	memberName = ['Definition', 'Group'];

	visit(member: Member, context: VisitorContext): Member | undefined {
		const [name, item] = member;

		if (!isNode(item)) {
			return undefined;
		}

		if (!('type' in item && (item.type === 'definition' || item.type === 'group'))) {
			return undefined;
		}

		const sequence = item.value['Sequence'] as Item;
		if (!sequence || !isList(sequence)) {
			return undefined;
		}

		const expressions = sequence.value as Item[];
		const hasGroup = expressions.some(expr =>
			isNode(expr) && 'type' in expr && (
				expr.type === 'group' ||
				(expr.type === 'optional' && (() => {
					const optSeq = expr.value['Sequence'] as Item;
					if (!isList(optSeq)) return false;
					return (optSeq.value as Item[]).some(i =>
						isNode(i) && 'type' in i && i.type === 'group'
					);
				})())
			)
		);

		if (!hasGroup) {
			return undefined;
		}

		// Recursively expand all groups, but preserve optional nodes
		const newExpressions = expressions.flatMap(e => {
			if (isNode(e) && 'type' in e) {
				if (e.type === 'group') {
					const groupSequence = e.value['Sequence'] as Item;
					if (isList(groupSequence)) {
						return this.flattenSequence(groupSequence.value as Item[]);
					}
				} else if (e.type === 'optional') {
					const optionalSequence = e.value['Sequence'] as Item;
					if (isList(optionalSequence)) {
						const flattened = this.flattenSequence(optionalSequence.value as Item[]);
						return [{
							value: {
								Sequence: { type: 'list', value: flattened } as List
							}
						} as Node];
					}
				}
			}
			return [e];
		});

		const newNode: Node = {
			...item,
			value: {
				...item.value,
				Sequence: { type: 'list', value: newExpressions } as List
			}
		};

		return [name, newNode];
	}

	private flattenSequence(items: Item[]): Item[] {
		return items.flatMap(item => {
			if (isNode(item) && 'type' in item) {
				if (item.type === 'group') {
					const groupSequence = item.value['Sequence'] as Item;
					if (isList(groupSequence)) {
						return this.flattenSequence(groupSequence.value as Item[]);
					}
				} else if (item.type === 'optional') {
					// Don't flatten optional nodes, just their inner groups
					const optionalSequence = item.value['Sequence'] as Item;
					if (isList(optionalSequence)) {
						return [{
							value: {
								Sequence: {
									type: 'list',
									value: this.flattenSequence(optionalSequence.value as Item[])
								} as List
							}
						} as Node];
					}
				}
			}
			return [item];
		});
	}
}

export class GroupFlattener implements VisitorRule {
	name = 'GroupFlattener';
	memberName = 'group';

	visit(member: Member, context: VisitorContext): Member | undefined {
		const [name, item] = member;

		if (!isNode(item)) {
			return undefined;
		}

		if (!('type' in item && item.type === 'group')) {
			return undefined;
		}

		const sequence = item.value['Sequence'] as Item;
		if (!sequence || !isList(sequence)) {
			return undefined;
		}

		const expressions = sequence.value as Item[];
		const hasGroup = expressions.some(expr =>
			isNode(expr) && 'type' in expr && expr.type === 'group'
		);

		if (!hasGroup) {
			return undefined;
		}

		// Recursively expand all groups
		const newExpressions = expressions.flatMap(e => {
			if (isNode(e) && 'type' in e && e.type === 'group') {
				const groupSequence = e.value['Sequence'] as Item;
				if (isList(groupSequence)) {
					return groupSequence.value as Item[];
				}
			}
			return [e];
		});

		const newNode: Node = {
			...item,
			value: {
				...item.value,
				Sequence: { type: 'list', value: newExpressions } as List
			}
		};

		return [name, newNode];
	}
}
