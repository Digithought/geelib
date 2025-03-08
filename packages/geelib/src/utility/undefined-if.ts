export function undefinedIf<T>(value: T, match: (a: T) => boolean): T | undefined {
	return match(value) ? undefined : value;
}
