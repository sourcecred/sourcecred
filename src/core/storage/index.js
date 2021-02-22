// @flow

/**
 * Data Storage allows the implementation of a uniform abstraction for I/O
 */
export interface DataStorage {
  /**
   * If the value for the key entered cannot be found, an error should be thrown.
   */
  get(key: string): Promise<Uint8Array>;
}

/**
 * keys should be file-system friendly
 */
export interface WritableDataStorage extends DataStorage {
  set(key: string, value: Uint8Array): Promise<void>;
}
