import { isList, isNode, isText, item, mergeSpan } from "./ast/ast.js";
import type { Item, Text } from "./ast/ast.js";

/** A text with a captured flag */
export type Trap<Text> = Text & {
	captured?: boolean;
};

/** Mark item as captured if it is a text */
export function captured(item: undefined): undefined;
export function captured(item: Item): Item;
export function captured(item: Item | undefined): Item | undefined;
export function captured(item: Item | undefined): Item | undefined {
	if (item === undefined) {
		return undefined!;
	}
	return isText(item) ? ({ ...item, captured: true } as Trap<Text>) : item;
}

/** Mark item as uncaptured if it is a text */
export function uncaptured(item: undefined): undefined;
export function uncaptured(item: Item): Item;
export function uncaptured(item: Item | undefined): Item | undefined;
export function uncaptured(item: Item | undefined): Item | undefined {
	if (item === undefined) {
		return undefined;
	}
	const { captured, ...rest } = item as Trap<Text>;
	return rest;
}

/** Check if a text is captured */
export function isCaptured<Text>(trap: Trap<Text>): boolean {
	return Boolean(trap.captured);
}

/** Check if two objects intersect */
function intersects(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
	return Object.keys(a).some(k => Object.hasOwn(b, k));
}

/** Merge a list of captured results */
export function mergeResults(results: Trap<Item>[]): Trap<Item> | undefined {
	let result: Trap<Item> | undefined;
	for (const r of results) {
		result = mergeResult(result, r);
	}
	return result;
}

/** Merge two captured results */
export function mergeResult(a: Trap<Item> | undefined, b: Trap<Item>): Trap<Item> {
	// Case 1: If 'a' is undefined, return 'b'
	if (!a) {
		return b;
	}

	// Case 2: Both are nodes
	if (isNode(a) && isNode(b)) {
		if (intersects(b.value, a.value)) {
			// Intersecting objects -> list [a, b]
			return item([a, b], mergeSpan(b.span, a.span));
		} else {
			// Non-intersecting objects -> merged object {a, b}
			return item({
				...(b.value as Record<string, Item>),
				...(a.value as Record<string, Item>)
			}, mergeSpan(b.span, a.span));
		}
	}

	// Case 3: 'b' is a node
	if (isNode(b)) {
		if (isCaptured(a) || isList(a)) {
			// 'a' is list or captured text -> list [a, b]
			return item([isList(a) ? a : uncaptured(a), b], mergeSpan(a.span, b.span));
		} else {
			// 'a' is text -> b
			return b;
		}
	}

	// Case 4: 'b' is captured or a list
	if (isCaptured(b) || isList(b)) {
		if (isNode(a)) {
			// 'a' is object + 'b' is list or captured text -> list [a, b]
			return item([a, isList(b) ? b : uncaptured(b)], mergeSpan(a.span, b.span));
		}

		if (isCaptured(a)) {
			if (isText(a) && isText(b)) {
				// Both are captured text -> concatenate
				return captured(item(a.value + b.value, mergeSpan(a.span, b.span)));
			}

			if (isText(a)) {
				// 'a' is captured text, 'b' is list -> list [a, b]
				return item([uncaptured(a), b], mergeSpan(a.span, b.span));
			}

			if (isText(b)) {
				// 'a' is list, 'b' is captured text -> list [a, b]
				return item([a, uncaptured(b)], mergeSpan(a.span, b.span));
			}

			// Both are lists -> flatten
			return item([...(a.value as Item[]), ...(b.value as Item[])], mergeSpan(a.span, b.span));
		}

		// 'a' is non-captured text or list -> 'b'
		return b;
	}

	// Case 5: 'b' is plain text
	if (!isCaptured(a) && !isList(a)) {
		// Both are plain text -> concatenate
		return item(a.value + b.value, mergeSpan(a.span, b.span));
	}

	// Default: 'a' is list, object or captured text + 'b' is plain text -> 'a'
	return a;
}
