export type NodeType = 'unit' | 'definition' | 'sequence' | 'repeat' | 'separated' | 'andNot' | 'as' | 'declaration' |
	'or' | 'group' | 'optional' | 'reference' | 'range' | 'char' | 'string' | 'charSet' | 'text' | 'list' |
	'capture' | 'count' | 'fromTo' | 'quote';

export type Node = Item & {
	attributes: Record<string, Item>;
}

export type Text = Item & {
	type: 'text';
	value: string;
}

export type List = Item & {
	type: 'list';
	items: Item[];
}

export type Item = {
	type: NodeType;
	start?: number;
	end?: number;
	grammarName?: string;
};

export function node(type: NodeType, attributes: Record<string, Item>): Node {
	return { type, attributes };
}

export function text(value: string): Text {
	return { type: 'text', value };
}

export function list(items: Item[]): List {
	return { type: 'list', items };
}
