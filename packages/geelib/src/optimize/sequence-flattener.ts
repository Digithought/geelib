import type { Node, List } from "../ast/ast.js";
import { isNode } from "../ast/ast-helpers.js";
import type { VisitorRule, VisitorContext } from '../visitor.js';


export class SequenceFlattener implements VisitorRule {
	name = 'SequenceFlattener';
	nodeType = 'expression';

	visit(node: Node, context: VisitorContext): Node | null {
		const sequence = node.attributes['Sequence'] as List;
		if (!sequence) return null;

		const expressions = sequence.items;
		const hasGroup = expressions.some(item => isNode(item) && item.type === 'group');
		if (!hasGroup) return null;

		// Expand direct child groups
		const newExpressions = expressions.flatMap(e => {
			if (isNode(e) && e.type === 'group') {
				return (e.attributes['Sequence'] as List).items;
			}
			return [e];
		});

		return { ...node, attributes: { ...node.attributes, Sequence: { type: 'list', items: newExpressions } as List } };
	}
}
