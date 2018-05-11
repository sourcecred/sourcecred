// @flow

import deepEqual from "lodash.isequal";
import stringify from "json-stable-stringify";

export type Address = {|
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
  /*
   * Nested structure for fast access.
   *
   * It is an representation invariant that there are no empty objects
   * in this structure (except possibly the top-level object). In
   * particular, if `_data[somePluginName]` is not `undefined`, then it
   * is a non-empty object. This is required so that two `AddressMap`s
   * are logically equal exactly if their `_data` fields are deep-equal.
   *
   * This nested structure is significantly more performant than a
   * simpler version using a flat object keyed by `stringify(address)`.
   * For basic performance tests, see:
   *     https://jsperf.com/address-string-302039074
   */
  _data: {[pluginName: string]: {[type: string]: {[id: string]: T}}};

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
    Object.keys(this._data).forEach((pluginName) => {
      const dataForPluginName = this._data[pluginName];
      Object.keys(dataForPluginName).forEach((type) => {
        const dataForType = dataForPluginName[type];
        Object.keys(dataForType).forEach((id) => {
          const address = {pluginName, id, type};
          const datum = {...dataForType[id]};
          delete datum.address;
          result[toString(address)] = datum;
        });
      });
    });
    return result;
  }

  static fromJSON(json: AddressMapJSON<T>): AddressMap<T> {
    const result: AddressMap<T> = new AddressMap();
    Object.keys(json).forEach((key) => {
      result.add({...json[key], address: JSON.parse(key)});
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
    let dataForPluginName = this._data[address.pluginName];
    if (dataForPluginName === undefined) {
      this._data[address.pluginName] = dataForPluginName = {};
    }
    let dataForType = dataForPluginName[address.type];
    if (dataForType === undefined) {
      dataForPluginName[address.type] = dataForType = {};
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
    const dataForPluginName = this._data[address.pluginName];
    if (dataForPluginName === undefined) {
      return (undefined: any);
    }
    const dataForType = dataForPluginName[address.type];
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
    Object.keys(this._data).forEach((pluginName) => {
      const dataForPluginName = this._data[pluginName];
      Object.keys(dataForPluginName).forEach((type) => {
        const dataForType = dataForPluginName[type];
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
    const dataForPluginName = this._data[address.pluginName];
    if (dataForPluginName === undefined) {
      return this;
    }
    const dataForType = dataForPluginName[address.type];
    if (dataForType === undefined) {
      return this;
    }
    delete dataForType[address.id];
    if (Object.keys(dataForType).length === 0) {
      delete dataForPluginName[address.type];
      if (Object.keys(dataForPluginName).length === 0) {
        delete this._data[address.pluginName];
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
