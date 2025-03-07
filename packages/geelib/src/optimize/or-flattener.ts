import type { Node, List, Item } from "../ast/ast.js";
import type { VisitorRule, VisitorContext } from '../visitor.js';


export class OrFlattener implements VisitorRule {
	name = 'OrFlattener';
	memberName = 'or';

	visit(node: Node, context: VisitorContext): Node | null {
		const expressions = node.attributes['Expressions'] as List;
		const hasNestedOr = expressions.items.some(item => (item as Node).type === 'or');
		if (!hasNestedOr) return null;

		// Flatten nested ORs
		const flattened: Item[] = [];
		for (const item of expressions.items) {
			const expr = item as Node;
			if (expr.type === 'or') {
				const nestedExpr = expr.attributes['Expressions'] as List;
				flattened.push(...nestedExpr.items);
			} else {
				flattened.push(expr);
			}
		}

		return {
			type: 'or',
			attributes: {
				Expressions: { type: 'list', items: flattened } as List
			}
		};
	}
}
