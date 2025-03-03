import type { Node, List, Item } from "./ast.js";

export function isNode(value: any): value is Node {
	return value && typeof value === 'object' && 'attributes' in value;
}

export function isList(value: any): value is List {
	return value && typeof value === 'object' && 'items' in value;
}

export function isText(value: any): value is Text {
	return value && typeof value === 'object' && 'value' in value;
}

