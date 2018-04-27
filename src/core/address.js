// @flow

import deepEqual from "lodash.isequal";
import stringify from "json-stable-stringify";

export type Address = {|
  +repositoryName: string,
  +pluginName: string,
  +id: string,
  +type: string,
|};

export interface Addressable {
  +address: Address;
}

export type SansAddress<T: Addressable> = $Exact<$Diff<T, {+address: Address}>>;

export type AddressMapJSON<T: Addressable> = {
  [serializedAddress: string]: SansAddress<T>,
};

/**
 * A data structure for storing addressable objects, keyed by their
 * addresses.
 */
export class AddressMap<T: Addressable> {
  // TODO(@wchargin): Evaluate performance gains from using a nested-map
  // here. Cf. https://jsperf.com/address-string-302039074.
  _data: {[serializedAddress: string]: T};

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
    Object.keys(this._data).forEach((key) => {
      const node = {...this._data[key]};
      delete node.address;
      result[key] = node;
    });
    return result;
  }

  static fromJSON(json: AddressMapJSON<T>): AddressMap<T> {
    const result: AddressMap<T> = new AddressMap();
    Object.keys(json).forEach((key) => {
      result._data[key] = {...json[key], address: JSON.parse(key)};
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
    if (t.address == null) {
      throw new Error(`address is ${String(t.address)}`);
    }
    const key = toString(t.address);
    this._data[key] = t;
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
    const key = toString(address);
    return this._data[key];
  }

  /**
   * Get all objects stored in the map, in some unspecified order.
   */
  getAll(): T[] {
    return Object.keys(this._data).map((k) => this._data[k]);
  }

  /**
   * Remove any object with the given address. If none exists, this
   * method does nothing.
   */
  remove(address: Address): this {
    if (address == null) {
      throw new Error(`address is ${String(address)}`);
    }
    const key = toString(address);
    delete this._data[key];
    return this;
  }
}

export function toString(x: Address): string {
  return stringify(x);
}

export function fromString(s: string): Address {
  return JSON.parse(s);
}
