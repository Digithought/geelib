import type { Node, List, Item, Member } from "../ast/ast.js";
import { isNode, isList } from "../ast/ast.js";
import type { VisitorRule, VisitorContext } from '../visitor.js';


export class OrFlattener implements VisitorRule {
	name = 'OrFlattener';
	memberName = 'or';

	visit(member: Member, context: VisitorContext): Member | undefined {
		const [name, item] = member;

		if (!isNode(item)) {
			return undefined;
		}

		const expressions = item.value['Expressions'] as Item;

		if (!isList(expressions)) {
			return undefined;
		}

		const expressionItems = expressions.value as Item[];
		const hasNestedOr = expressionItems.some(expr =>
			isNode(expr) && 'type' in expr && expr.type === 'or'
		);

		if (!hasNestedOr) {
			return undefined;
		}

		// Flatten nested ORs
		const flattened: Item[] = [];
		for (const expr of expressionItems) {
			if (isNode(expr) && 'type' in expr && expr.type === 'or') {
				const nestedExpr = expr.value['Expressions'] as Item;
				if (isList(nestedExpr)) {
					flattened.push(...(nestedExpr.value as Item[]));
				}
			} else {
				flattened.push(expr);
			}
		}

		const orNode: Node = {
			value: {
				Expressions: {
					type: 'list',
					value: flattened
				} as List
			}
		};

		return [name, orNode];
	}
}
