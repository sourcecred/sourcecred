// @flow

/**
 * An append-only ordered log, though those are inherent properties of a log, so
 * it's simply called Log.
 */
export interface Log<T> {
  /**
   * Appends several items to the log. Acts as a transaction, either all or none
   * of the items are appended.
   */
  append(items: $ReadOnlyArray<T>): void;

  /**
   * Implements the Iterable interface as Flow wants to see it.
   * Note: in reality we should implement [Symbol.iterator] as well to be
   * considered Iterable by javascript at runtime. This is a Flow bug.
   */
  @@iterator(): Iterator<T>;

  /**
   * Creates an Iterator of the values in this log. Because of the Flow bug this
   * is much more convenient when you do need direct access to the Iterator.
   */
  values(): Iterator<T>;
}

// Internal properties to use for the array implementation.
type _ArrayLog<T> = {|
  // Note: this is a read-write property of a read only array. Rather than
  // mutating the internal array, we'll update to reference a new array.
  _items: $ReadOnlyArray<T>,
  append(items: $ReadOnlyArray<T>): void,
  @@iterator(): Iterator<T>,
  values(): Iterator<T>,
|};

// Factory for this "class". Initialize with `ArrayLog()` or `new ArrayLog()`.
export function ArrayLog<T>(): _ArrayLog<T> {
  function append(items: $ReadOnlyArray<T>): void {
    this._items = [...this._items, ...items];
  }

  function iterator(): Iterator<T> {
    return this._items.values();
  }

  return {
    _items: [],
    append,
    // This is to satify the Flow type.
    "@@iterator": iterator,
    // This is to actually comply with the ES standard.
    [Symbol.iterator]: iterator,
    // This is for user convenience.
    values: iterator,
  };
}
