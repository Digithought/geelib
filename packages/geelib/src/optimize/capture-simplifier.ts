import type { Node } from "../ast/ast.js";
import type { VisitorRule, VisitorContext } from '../visitor.js';


export class CaptureSimplifier implements VisitorRule {
	name = 'CaptureSimplifier';
	nodeType = 'capture';

	visit(node: Node, context: VisitorContext): Node | null {
		const expr = node.attributes['Expression'] as Node;
		if (expr.type === 'capture') {
			return expr;
		}

		return null;
	}
}
