import type { Node, List, Item } from '../types';
import type { VisitorRule, VisitorContext } from '../visitor';


export class OrFlattener implements VisitorRule {
	name = 'OrFlattener';
	nodeType = 'or';

	visit(node: Node, context: VisitorContext): Node | null {
		const expressions = node.attributes.get('Expressions') as List;
		const hasNestedOr = expressions.items.some(item => (item as Node).type === 'or');
		if (!hasNestedOr) return null;

		// Flatten nested ORs
		const flattened: Item[] = [];
		for (const item of expressions.items) {
			const expr = item as Node;
			if (expr.type === 'or') {
				const nestedExpr = expr.attributes.get('Expressions') as List;
				flattened.push(...nestedExpr.items);
			} else {
				flattened.push(expr);
			}
		}

		return {
			type: 'or',
			attributes: new Map([
				['Expressions', { type: 'list', items: flattened, attributes: new Map() }]
			])
		};
	}
}
