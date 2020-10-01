// @flow

import {type AddressModule} from "./address";
import {
  NodeAddress,
  type NodeAddressT,
  EdgeAddress,
  type EdgeAddressT,
} from "./graph";
import * as NullUtil from "../util/null";

const EMPTY_ENTRY_SYMBOL: symbol = Symbol("EMPTY");

type Entry<V> = {|+map: RecursiveMap<V>, value: V | typeof EMPTY_ENTRY_SYMBOL|};
type RecursiveMap<V> = Map<string, Entry<V>>;
class BaseTrie<K: string, V> {
  addressModule: AddressModule<K>;
  entry: Entry<V>;

  /**
   * Create an empty trie backed by the given address module.
   */
  constructor(m: AddressModule<K>) {
    this.addressModule = m;
    this.entry = {value: EMPTY_ENTRY_SYMBOL, map: new Map()};
  }

  /**
   * Add key `k` to this trie with value `v`. Return `this`.
   */
  add(k: K, val: V): this {
    const parts = this.addressModule.toParts(k);
    let entry = this.entry;
    for (const part of parts) {
      if (!entry.map.has(part)) {
        entry.map.set(part, {map: new Map(), value: EMPTY_ENTRY_SYMBOL});
      }
      entry = NullUtil.get(entry.map.get(part));
    }
    if (entry.value !== EMPTY_ENTRY_SYMBOL) {
      throw new Error(
        `Tried to overwrite entry at ${this.addressModule.toString(k)}`
      );
    }
    entry.value = val;
    return this;
  }

  /**
   * Get the values in this trie along the path to `k`.
   *
   * More specifically, this method has the following observable
   * behavior. Let `inits` be the list of all prefixes of `k`, ordered
   * by length (shortest to longest). Observe that the length of `inits`
   * is `n + 1`, where `n` is the number of parts of `k`; `inits` begins
   * with the empty address and ends with `k` itself. Initialize the
   * result to an empty array. For each prefix `p` in `inits`, if `p`
   * was added to this trie with value `v`, then append `v` to
   * `result`. Return `result`.
   */
  get(k: K): V[] {
    const parts = this.addressModule.toParts(k);
    const result: V[] = [];
    let entry: Entry<V> = this.entry;
    // nb: if parts has length `n`, there are `n+1` opportunities to add a
    // value to the resultant array, which is correct as there may be `n+1`
    // appropriate values to return: one for each part, and another for the
    // empty address.
    for (const part of parts) {
      if (entry.value !== EMPTY_ENTRY_SYMBOL) {
        const value: V = (entry.value: any);
        result.push(value);
      }
      const tmpEntry = entry.map.get(part);
      if (tmpEntry == null) {
        return result;
      } else {
        entry = tmpEntry;
      }
    }
    if (entry.value !== EMPTY_ENTRY_SYMBOL) {
      const value: V = (entry.value: any);
      result.push(value);
    }
    return result;
  }

  /**
   * Get the last stored value `v` in the path to key `k`.
   * Returns undefined if no value is available.
   */
  getLast(k: K): ?V {
    const path = this.get(k);
    return path[path.length - 1];
  }
}

export class NodeTrie<V> extends BaseTrie<NodeAddressT, V> {
  constructor() {
    super(NodeAddress);
  }
}

export class EdgeTrie<V> extends BaseTrie<EdgeAddressT, V> {
  constructor() {
    super(EdgeAddress);
  }
}
