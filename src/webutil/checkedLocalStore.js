// @flow

import deepEqual from "lodash.isequal";

import {LocalStore} from "./localStore";

/*
 * A wrapper for a `LocalStore` that adds contract checking. This
 * implementation verifies that all provided keys are strings and all
 * provided values are plain old JSON values.
 */
export default class CheckedLocalStore implements LocalStore {
  _base: LocalStore;

  constructor(base: LocalStore): void {
    this._base = base;
  }

  get<T>(key: string, whenUnavailable: T): T {
    this._validateKey(key);
    return this._base.get(key, whenUnavailable);
  }

  set(key: string, data: mixed): void {
    this._validateKey(key);
    this._validateValue(data);
    return this._base.set(key, data);
  }

  del(key: string): void {
    this._validateKey(key);
    return this._base.del(key);
  }

  _validateKey(key: string) {
    if (typeof key !== "string") {
      throw new Error(`bad key (${typeof key}): ${key}`);
    }
  }

  _validateValue(data: any) {
    try {
      if (deepEqual(data, JSON.parse(JSON.stringify(data)))) {
        return;
      }
    } catch (_) {} // eslint-disable-line no-empty
    throw new Error(`bad value: ${data}`);
  }
}
