export function first<T>(iterable: Iterable<T>): T | undefined {
  for (const item of iterable) {
    return item;
  }
  return undefined;
}

