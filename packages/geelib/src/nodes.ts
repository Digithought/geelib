import type { Comparer } from "./comparer";

export type Unit<T> = T & {
	name?: string;
	root: DefinitionGroup<T>;
	comparer: Comparer;
	whitespace?: DefinitionGroup<T>;
	groups: Record<string, DefinitionGroup<T>>;
}

export type DefinitionGroup<T> = T & {
	name: string;
	definitions: Definition<T>[];
}

export type Definition<T> = T & {
	precedence: number;
	associativity: 'L' | 'R';
	isDeclaration: boolean;
	sequence: Expression<T>[];
}

export type Expression<T> = T & {
	type: 'Range' | 'Char' | 'String' | 'Quote' | 'CharSet' | 'Reference' | 'Group' | 'Optional'
		| 'Declaration' | 'Or' | 'Repeat' | 'As' | 'AndNot' | 'Separated' | 'Capture';
}

export type Declaration<T> = T & Expression<T> & {
	type: 'Declaration';
	name: string;
	expression: Expression<T>;
}

export type Or<T> = T & Expression<T> & {
	type: 'Or';
	expressions: Expression<T>[];
}

export type Repeat<T> = T & Expression<T> & {
	type: 'Repeat';
	expression: Expression<T>;
	min?: number;
	max?: number;
}

export type Separated<T> = T & Expression<T> & {
	type: 'Separated';
	expression: Expression<T>;
	separator: Expression<T>;
}

export type Capture<T> = T & Expression<T> & {
	type: 'Capture';
	expression: Expression<T>;
}

export type AndNot<T> = T & Expression<T> & {
	type: 'AndNot';
	expression: Expression<T>;
	not: Expression<T>;
}

export type As<T> = T & Expression<T> & {
	type: 'As';
	expression: Expression<T>;
	value: string;
}

export type Group<T> = T & Expression<T> & {
	type: 'Group';
	sequence: Expression<T>[];
}

export type Optional<T> = T & Expression<T> & {
	type: 'Optional';
	sequence: Expression<T>[];
}

export type Reference<T> = T & Expression<T> & {
	type: 'Reference';
	group: DefinitionGroup<T>;
}

export type Quote<T> = T & Expression<T> & {
	type: 'Quote';
	match: string;
}

export type String<T> = T & Expression<T> & {
	type: 'String';
	match: string;
}

export type Range<T> = T & Expression<T> & {
	type: 'Range';
	from: string;
	to: string;
}

export type Char<T> = T & Expression<T> & {
	type: 'Char';
	match: string;
}

export type CharSet<T> = T & Expression<T> & {
	type: 'CharSet';
	not: boolean;
	all: boolean;
	entries: (Range<T> | Char<T>)[];
}



