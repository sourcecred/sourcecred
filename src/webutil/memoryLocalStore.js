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
    this._data.set(key, JSON.stringify(data));
  }

  del(key: string): void {
    this._data.delete(key);
  }
}
