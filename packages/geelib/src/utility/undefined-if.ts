export function undefinedIf<T>(value: T, matches: T): T | undefined {
	return value === matches ? undefined : value;
}
