// @flow

/**
 * Finds elements in the array which are included twice or more.
 * Uses a === comparison, not deep equality.
 */
export function findDuplicates<T>(items: $ReadOnlyArray<T>): Set<T> {
  const encountered: Set<T> = new Set();
  const duplicates: Set<T> = new Set();
  for (const item of items) {
    if (!encountered.has(item)) {
      encountered.add(item);
    } else {
      duplicates.add(item);
    }
  }
  return duplicates;
}
