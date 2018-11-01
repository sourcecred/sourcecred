// @flow

/**
 * An abstraction over the browser's `localStorage` API. This enables
 * persistently storing and retrieving JSON-serializable values by a
 * string key.
 */
export interface LocalStore {
  /**
   * Get the value stored under the given key, or `whenUnavailable` if
   * this API is unavailable or the key does not exist or is corrupt.
   */
  get<T>(key: string, whenUnavailable: T): T;

  /**
   * Store the given value under the given key. The value must be a
   * plain old JSON object: i.e., `data` and
   * `JSON.parse(JSON.stringify(data))` must be deep-equal.
   */
  set(key: string, data: mixed): void;

  /**
   * Remove any value with the given key. If none exists, do nothing.
   */
  del(key: string): void;
}
