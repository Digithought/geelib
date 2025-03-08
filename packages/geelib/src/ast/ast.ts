import { undefinedIf } from "../utility/undefined-if.js";
import { GrammarError } from "../errors.js";

export type Span = {
	start: number;
	end: number;
}

export type Component = {
	span?: Span;
	grammarName?: string;
};

export type Node = Component & {
	value: Record<string, Item>;
}

export type Text = Component & {
	value: string;
}

export type List = Component & {
	value: Array<Item>;
}

export type Item = Node | Text | List;

/** A single node attribute */
export type Member = [string, Item];

export function item(value: string, span?: Span, grammarName?: string): Text
export function item(value: Array<Item>, span?: Span, grammarName?: string): List
export function item(value: Record<string, Item>, span?: Span, grammarName?: string): Node
export function item(value: Record<string, Item> | string | Array<Item>, span?: Span, grammarName?: string): Item {
	return { value, span, grammarName } as Item;
}

export function isNode(item: Item | undefined): item is Node {
	return item !== undefined && typeof item.value === 'object' && !Array.isArray(item.value);
}

export function isList(item: Item | undefined): item is List {
	return item !== undefined && Array.isArray(item.value);
}

export function isText(item: Item | undefined): item is Text {
	return item !== undefined && typeof item.value === 'string';
}

/** Returns the singleton attribute from the given item, if it's a node and has exactly one attribute */
export function singleMember(item: Item | undefined): Member | undefined {
	if (!isNode(item) || Object.keys(item.value).length !== 1) return undefined;
	return Object.entries(item.value)[0];
}

/** Safely gets an attribute from an item's value as a record
 * @returns The attribute value or undefined if not found
 */
export function getAttribute(item: Item | undefined, key: string): Member | undefined {
	if (!isNode(item)) return undefined;
	const attr = item.value[key];
	if (attr === undefined) return undefined;
	return [key, attr];
}

/** Safely gets an attribute from an item's value as a record and ensures it exists
 * @param errorMessage Optional error message if attribute is missing
 * @throws Error if the attribute is not found
 * @returns The attribute value
 */
export function getRequiredAttribute(item: Item | undefined, key: string, errorMessage?: string): Member {
	const attr = getAttribute(item, key);
	if (attr === undefined) {
		throw new GrammarError(errorMessage ?? `Required attribute '${key}' not found`);
	}
	return attr;
}

/** Safely gets a text value from an item's attribute
 * @returns The text value or undefined if not found or not a text
 */
export function getTextValue(item: Item | undefined, key: string): string | undefined {
	if (!isNode(item)) return undefined;
	return item.value[key]?.value as string;
}

/** Safely gets a required text value from an item's attribute
 * @param errorMessage Optional error message if attribute is missing or not a text
 * @throws Error if the attribute is not found or not a text
 */
export function getRequiredTextValue(item: Item | undefined, key: string, errorMessage?: string): string {
	const text = getTextValue(item, key);
	if (text === undefined) {
		throw new GrammarError(errorMessage ?? `Required text value for attribute '${key}' not found`);
	}
	return text;
}

/** Safely gets a number value from an item's attribute
 * @returns The number value or undefined if not found or not a number
 */
export function getNumberValue(item: Item | undefined, key: string): number | undefined {
	return undefinedIf(parseInt(getTextValue(item, key)!), isNaN);
}

/** Safely gets a required number value from an item's attribute
 * @param errorMessage Optional error message if attribute is missing or not a number
 * @throws Error if the attribute is not found or not a number
 * @returns The number value
 */
export function getRequiredNumberValue(item: Item | undefined, key: string, errorMessage?: string): number {
	const number = getNumberValue(item, key);
	if (number === undefined) {
		throw new GrammarError(errorMessage ?? `Required number value for attribute '${key}' not found`);
	}
	return number;
}

/** Returns the start and end of two items */
export function mergeSpan(left: Span | undefined, right: Span | undefined): Span | undefined {
	const result = {
		start: Math.min(left?.start ?? Infinity, right?.start ?? Infinity),
		end: Math.max(left?.end ?? -Infinity, right?.end ?? -Infinity)
	};
	return result.start === Infinity || result.end === -Infinity ? undefined : result as Span;
}

/** Returns the span of an array of items */
export function mergeSpans(items: (Span | undefined)[]): Span | undefined {
	return items.reduce((acc, item) => mergeSpan(acc, item), undefined as Span | undefined);
}
