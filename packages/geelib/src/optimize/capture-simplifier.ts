import type { Node, List } from "../ast/ast.js";
import type { VisitorRule, VisitorContext } from '../visitor.js';

/**
 * Simplifies capture nodes in the AST.
 *
 * Current optimizations:
 * - Removes redundant nested captures: capture(capture(x)) -> capture(x)
 *
 * Potential future optimizations:
 * 1. Combine adjacent captures in a sequence:
 *    sequence[capture(x), capture(y)] -> capture(sequence[x, y])
 *    Note: This would require a rule on sequences to combine adjacent captures
 *
 * 2. Remove redundant captures of already-captured references
 *    Note: This would require analysis of which rules always produce captured output
 */
export class CaptureSimplifier implements VisitorRule {
	name = 'CaptureSimplifier';
	memberName = 'capture';

	visit(node: Node, context: VisitorContext): Node | null {
		const expr = node.attributes['Expression'] as Node;

		// Remove redundant nested captures
		if (expr.type === 'capture') {
			return expr;
		}

		// Case 3: Capture of a string/char literal - could potentially optimize but need more context
		// Left as a TODO since we'd need to know if the capture is actually needed by the parser

		return null;
	}
}
