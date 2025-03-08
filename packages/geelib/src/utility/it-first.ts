/**
 * Returns the first element of an iterable
 * @param iterable The iterable to get the first element from
 * @returns The first element or undefined if the iterable is empty
 */
export function first<T>(iterable: Iterable<T>): T | undefined {
  for (const item of iterable) {
    return item;
  }
  return undefined;
}
