// @flow

export interface DataStorage {
  get(key: string): Promise<string>;
}

export interface WritableDataStorage extends DataStorage {
  set(key: string, value: string): Promise<void>;
}
