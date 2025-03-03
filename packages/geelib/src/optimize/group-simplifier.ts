import type { Node, List } from "../ast/ast.js";
import type { VisitorRule, VisitorContext } from '../visitor.js';


export class GroupSimplifier implements VisitorRule {
	name = 'GroupSimplifier';
	nodeType = 'group';

	visit(node: Node, context: VisitorContext): Node | null {
		const sequence = node.attributes['Sequence'] as List;
		if (sequence.items.length === 1) {
			return sequence.items[0] as Node;
		}
		return null;
	}
}
