//@flow

export type PluckFn<T> = (T) => any;

const identity = (x) => x;

/**
 * Sorting utility. Accepts an array and optionally any number of "pluck"
 * functions to get the value to sort by. Will create a shallow copy, and sort in ascending order.
 * - `arr`: The input array to sort
 * - `pluckArgs`: (0...n) Functions to get the value to sort by. Defaults to identity.
 */
export default function sortBy<T>(
  arr: $ReadOnlyArray<T>,
  ...pluckArgs: PluckFn<T>[]
): T[] {
  const plucks: PluckFn<T>[] = pluckArgs.length === 0 ? [identity] : pluckArgs;

  function sortByCompare(a: T, b: T) {
    for (const pluck of plucks) {
      const valA = pluck(a);
      const valB = pluck(b);
      if (valA > valB) return 1;
      if (valA < valB) return -1;
    }
    return 0;
  }

  return [...arr].sort(sortByCompare);
}
