// @flow

import deepEqual from "lodash.isequal";
import stringify from "json-stable-stringify";

import {toCompat, fromCompat} from "../../v1/util/compat";
import type {Compatible} from "../../v1/util/compat";

export type PluginType = {|+plugin: string, +type: string|};

export type Address = {|
  +owner: PluginType,
  +id: string,
|};

export interface Addressable {
  +address: Address;
}

export type SansAddress<T: Addressable> = $Exact<$Diff<T, {+address: Address}>>;

export type AddressMapJSON<T: Addressable> = Compatible<{
  [serializedAddress: string]: SansAddress<T>,
}>;

export const COMPAT_TYPE = "sourcecred/sourcecred/AddressMap";
export const COMPAT_VERSION = "0.2.0";

/**
 * A data structure for storing addressable objects, keyed by their
 * addresses.
 */
export class AddressMap<T: Addressable> {
  /*
   * Nested structure for fast access.
   *
   * It is an representation invariant that there are no empty objects
   * in this structure (except possibly the top-level object). In
   * particular, if `_data[somePlugin]` is not `undefined`, then it
   * is a non-empty object. This is required so that two `AddressMap`s
   * are logically equal exactly if their `_data` fields are deep-equal.
   *
   * This nested structure is significantly more performant than a
   * simpler version using a flat object keyed by `stringify(address)`.
   * For basic performance tests, see:
   *     https://jsperf.com/address-string-302039074
   */
  _data: {[plugin: string]: {[type: string]: {[id: string]: T}}};

  /**
   * Create an empty `AddressMap`.
   */
  constructor() {
    this._data = {};
  }

  /**
   * Test whether this map logically equals another map. Two maps are
   * logically equal if they contain the same keys and the values at
   * each key are deep-equal.
   */
  equals(that: AddressMap<T>): boolean {
    return deepEqual(this._data, that._data);
  }

  toJSON(): AddressMapJSON<T> {
    const result = {};
    Object.keys(this._data).forEach((plugin) => {
      const dataForPlugin = this._data[plugin];
      Object.keys(dataForPlugin).forEach((type) => {
        const dataForType = dataForPlugin[type];
        Object.keys(dataForType).forEach((id) => {
          const owner = {plugin, type};
          const address = {owner, id};
          const datum = {...dataForType[id]};
          delete datum.address;
          result[toString(address)] = datum;
        });
      });
    });
    return toCompat(
      {
        type: COMPAT_TYPE,
        version: COMPAT_VERSION,
      },
      result
    );
  }

  static fromJSON(json: AddressMapJSON<T>): AddressMap<T> {
    const decompat = fromCompat(
      {
        type: COMPAT_TYPE,
        version: COMPAT_VERSION,
      },
      json
    );
    const result: AddressMap<T> = new AddressMap();
    Object.keys(decompat).forEach((key) => {
      result.add({...decompat[key], address: JSON.parse(key)});
    });
    return result;
  }

  /**
   * Add the given object to the map, replacing any existing value for
   * the same address.
   *
   * Returns `this` for easy chaining.
   */
  add(t: T): this {
    const {address} = t;
    if (address == null) {
      throw new Error(`address is ${String(t.address)}`);
    }
    let dataForPlugin = this._data[address.owner.plugin];
    if (dataForPlugin === undefined) {
      this._data[address.owner.plugin] = dataForPlugin = {};
    }
    let dataForType = dataForPlugin[address.owner.type];
    if (dataForType === undefined) {
      dataForPlugin[address.owner.type] = dataForType = {};
    }
    dataForType[address.id] = t;
    return this;
  }

  /**
   * Get the object at the given address, if it exists, or `undefined`
   * otherwise.
   */
  get(address: Address): T {
    if (address == null) {
      throw new Error(`address is ${String(address)}`);
    }
    const dataForPlugin = this._data[address.owner.plugin];
    if (dataForPlugin === undefined) {
      return (undefined: any);
    }
    const dataForType = dataForPlugin[address.owner.type];
    if (dataForType === undefined) {
      return (undefined: any);
    }
    return dataForType[address.id];
  }

  /**
   * Get all objects stored in the map, in some unspecified order.
   */
  getAll(): T[] {
    const result = [];
    Object.keys(this._data).forEach((plugin) => {
      const dataForPlugin = this._data[plugin];
      Object.keys(dataForPlugin).forEach((type) => {
        const dataForType = dataForPlugin[type];
        Object.keys(dataForType).forEach((id) => {
          result.push(dataForType[id]);
        });
      });
    });
    return result;
  }

  /**
   * Remove any object with the given address. If none exists, this
   * method does nothing.
   */
  remove(address: Address): this {
    if (address == null) {
      throw new Error(`address is ${String(address)}`);
    }
    const dataForPlugin = this._data[address.owner.plugin];
    if (dataForPlugin === undefined) {
      return this;
    }
    const dataForType = dataForPlugin[address.owner.type];
    if (dataForType === undefined) {
      return this;
    }
    delete dataForType[address.id];
    if (Object.keys(dataForType).length === 0) {
      delete dataForPlugin[address.owner.type];
      if (Object.keys(dataForPlugin).length === 0) {
        delete this._data[address.owner.plugin];
      }
    }
    return this;
  }
}

export function toString(x: Address): string {
  return stringify(x);
}

export function fromString(s: string): Address {
  return JSON.parse(s);
}
