// @flow

import {LocalStore} from "./localStore";

/*
 * A completely in-memory `LocalStore` implementation that matches the
 * happy path of browsers' `localStorage`: storage is always enabled and
 * functioning, and there is no storage limit.
 */
export default class MemoryLocalStore implements LocalStore {
  _data: Map<string, string>;

  constructor(): void {
    this._data = new Map();
  }

  get<T>(key: string, whenUnavailable: T): T {
    const raw = this._data.get(key);
    return raw == null ? whenUnavailable : JSON.parse(raw);
  }

  set(key: string, data: mixed): void {
    const stringified = JSON.stringify(data);
    if (stringified === undefined) {
      throw new Error("tried to serialize undefined");
    }
    this._data.set(key, stringified);
  }

  del(key: string): void {
    this._data.delete(key);
  }
}
