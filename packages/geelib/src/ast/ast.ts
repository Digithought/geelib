export type Item = {
	value: string | Array<Item> | Record<string, Item>;
	start?: number;
	end?: number;
	grammarName?: string;
};

export type Node = Item & {
	value: Record<string, Item>;
}

export type Text = Item & {
	value: string;
}

export type List = Item & {
	value: Array<Item>;
}

/** A single node attribute */
export type Member = [string, Item];

export function item(value: string, start?: number, end?: number, grammarName?: string): Text;
export function item(value: Array<Item>, start?: number, end?: number, grammarName?: string): List;
export function item(value: Record<string, Item>, start?: number, end?: number, grammarName?: string): Node;
export function item(value: string | Array<Item> | Record<string, Item>, start?: number, end?: number, grammarName?: string): Item {
	return { value, start, end, grammarName };
}

export function isNode(item: Item): item is Node {
	return item && typeof item.value === 'object' && !Array.isArray(item.value) && item.value !== null;
}

export function isList(item: Item): item is List {
	return item && Array.isArray(item.value);
}

export function isText(item: Item): item is Text {
	return item && typeof item.value === 'string';
}

/** Safely gets an attribute from an item's value as a record
 * @returns The attribute value or undefined if not found
 */
export function getAttribute(item: Item, key: string): Member | undefined {
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
export function getRequiredAttribute(item: Item, key: string, errorMessage?: string): Member {
	const attr = getAttribute(item, key);
	if (attr === undefined) {
		throw new Error(errorMessage ?? `Required attribute '${key}' not found`);
	}
	return attr;
}

/** Safely gets a text value from an item's attribute
 * @returns The text value or undefined if not found or not a text
 */
export function getTextValue(item: Item, key: string): string | undefined {
	if (!isNode(item)) return undefined;
	return item.value[key]?.value as string;
}

/** Safely gets a required text value from an item's attribute
 * @param errorMessage Optional error message if attribute is missing or not a text
 * @throws Error if the attribute is not found or not a text
 */
export function getRequiredTextValue(item: Item, key: string, errorMessage?: string): string {
	const text = getTextValue(item, key);
	if (text === undefined) {
		throw new Error(errorMessage ?? `Required text value for attribute '${key}' not found`);
	}
	return text;
}
