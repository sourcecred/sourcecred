// @flow

/**
Returns an array of arrays that contains all of the items in the original
array parameter, but batched into arrays no larger than the batchSize.
Example:
  batch([1,2,3,4,5], 2) = [[1,2], [3,4], [5]]
*/
export function batchArray<T>(
  array: $ReadOnlyArray<T>,
  batchSize: number
): $ReadOnlyArray<$ReadOnlyArray<T>> {
  if (batchSize < 1) throw new Error("BatchSize must be 1 or more.");
  const result = [];
  const backlog = array.slice();
  while (backlog.length) {
    result.push(backlog.splice(0, batchSize));
  }
  return result;
}

export type BatchIterator<T> = Iterator<T> & {
  hasNext: () => boolean,
  numBatchesCompleted: () => number,
};

/**
Returns an iterator that will stop upon reaching the batchSize, and then can be
reused again for more batches. Use the provided hasNext() method to know when
there are no more batches available.
Example:
  const result = [];
  while (iterator.hasNext()) {
    for (const item of iterator) {
      // code to process item
    }
    // code to finalize batch
  }
 */
export function batchIterator<T>(
  iterator: Iterator<T> | Generator<T, void, void>,
  batchSize: number
): BatchIterator<T> {
  if (batchSize < 1) throw new Error("BatchSize must be 1 or more.");
  let itemsCompletedInCurrentBatch = 0;
  let queue = iterator.next();
  let hasNext = !queue.done;
  let batchesCompleted = 0;

  const next = () => {
    if (queue.done) return queue;
    if (itemsCompletedInCurrentBatch >= batchSize) {
      itemsCompletedInCurrentBatch = 0;
      batchesCompleted++;
      return {value: undefined, done: true};
    }
    itemsCompletedInCurrentBatch++;
    const current = queue;
    queue = iterator.next();
    hasNext = !queue.done;
    if (queue.done) batchesCompleted++;
    return current;
  };

  const result = {
    next,
    hasNext: () => hasNext,
    numBatchesCompleted: () => batchesCompleted,
    ["@@iterator"]: () => this,
    *[Symbol.iterator]() {
      for (let r; !(r = next()).done; ) yield r.value;
    },
  };
  return result;
}
