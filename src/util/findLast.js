// @flow

// This is simply a reverse-order version of Array.prototype.find()
// Returns the last element in the array that satisfies the provided
// testing function.
// Otherwise, it returns undefined, indicating that no element passed the test.
export function findLast<T>(
  array: $ReadOnlyArray<T>,
  testingFunction: (obj: T) => boolean
): ?T {
  return array[findLastIndex(array, testingFunction)];
}

// This is simply a reverse-order version of Array.prototype.findIndex()
// Returns the index of the last element in the array that satisfies the
// provided testing function.
// Otherwise, it returns -1, indicating that no element passed the test.
export function findLastIndex<T>(
  array: $ReadOnlyArray<T>,
  testingFunction: (obj: T) => boolean
): number {
  let index = array.length - 1;
  while (index >= 0 && !testingFunction(array[index])) index--;
  return index;
}
