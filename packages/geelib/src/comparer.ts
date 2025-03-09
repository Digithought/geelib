export type Comparer = (a: string, b: string) => number;

export function caseSensitiveComparer(a: string, b: string): number {
	return a.localeCompare(b);
}

export function caseInsensitiveComparer(a: string, b: string): number {
	return a.localeCompare(b, undefined, { sensitivity: 'accent' });
}
