// @flow

import {type AddressModule} from "./address";
import {
  NodeAddress,
  type NodeAddressT,
  EdgeAddress,
  type EdgeAddressT,
} from "./graph";
import * as NullUtil from "../util/null";

type Entry<V> = {|+map: RecursiveMap<V>, values: V[]|};
type RecursiveMap<V> = Map<string, Entry<V>>;
class BaseTrie<K, V> {
  addressModule: AddressModule<K>;
  entry: Entry<V>;

  /**
   * Create an empty trie backed by the given address module.
   */
  constructor(m: AddressModule<K>) {
    this.addressModule = m;
    this.entry = {values: [], map: new Map()};
  }

  /**
   * Add key `k` to this trie with value `v`. Return `this`.
   * Note that multiple values may be added for the same key.
   * They will be returned in insertion order.
   */
  add(k: K, val: V): this {
    const parts = this.addressModule.toParts(k);
    let entry = this.entry;
    for (const part of parts) {
      if (!entry.map.has(part)) {
        entry.map.set(part, {map: new Map(), values: []});
      }
      entry = NullUtil.get(entry.map.get(part));
    }
    entry.values.push(val);
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
   * `result`. Note that for any `p`, multiple values may have been
   * added, in which case they are appended in insertion order.
   * Return `result`.
   */
  get(k: K): V[] {
    const parts = this.addressModule.toParts(k);
    let result: V[] = [];
    let entry: Entry<V> = this.entry;
    // nb: if parts has length `n`, there are `n+1` opportunities to add values
    // to the resultant array, which is correct as there may be `n+1` parts
    // containing appropriate values: one for each part, and another for the
    // empty address.
    for (const part of parts) {
      result = result.concat(entry.values);
      const tmpEntry = entry.map.get(part);
      if (tmpEntry == null) {
        return result;
      } else {
        entry = tmpEntry;
      }
    }
    result = result.concat(entry.values);
    return result;
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
