// @flow

/**
 * Convert a string-keyed map to an object. Useful for conversion to
 * JSON. If a map's keys are not strings, consider invoking `mapKeys`
 * first.
 */
export function toObject<K: string, V, InK: K, InV: V>(
  map: $ReadOnlyMap<InK, InV>
): {|[K]: V|} {
  const result: {|[K]: V|} = ({}: any);
  for (const [k, v] of map.entries()) {
    result[k] = v;
  }
  return result;
}

/**
 * Convert an object to a map. The resulting map will have key-value
 * pairs corresponding to the enumerable own properties of the object in
 * iteration order, as returned by `Object.keys`.
 */
export function fromObject<K, V, InK: K & string, InV: V>(object: {
  +[InK]: InV,
}): Map<K, V> {
  const result = new Map();
  const keys = (((Object.keys(object): string[]): any): InK[]);
  for (const key of keys) {
    const val: InV = object[(key: any)];
    result.set(key, val);
  }
  return result;
}

/**
 * Shallow-copy a map, allowing upcasting its type parameters.
 *
 * The `Map` type constructor is not covariant in its type parameters,
 * which means that (e.g.) `Map<string, Dog>` is not a subtype of
 * `Map<string, Animal>` even if `Dog` is a subtype of `Animal`. This is
 * because, given a `Map<string, Animal>`, one can insert a `Cat`, which
 * would break invariants of existing references to the variable as a
 * map containing only `Dog`s.
 *
 *     declare class Animal {};
 *     declare class Dog extends Animal {};
 *     declare class Cat extends Animal {};
 *     declare var dogMap: Map<string, Dog>;
 *     const animalMap: Map<string, Animal> = dogMap;  // must fail
 *     animalMap.set("tabby", new Cat());  // or we could do this...
 *     (dogMap.values(): Iterator<Dog>);  // ...now contains a `Cat`!
 *
 * This problem only exists when a map with existing references is
 * mutated. Therefore, when we shallow-copy a map, we have the
 * opportunity to upcast its type parameters: `copy(dogMap)` _can_ be a
 * `Map<string, Animal>`.
 */
export function copy<K, V, InK: K, InV: V>(
  map: $ReadOnlyMap<InK, InV>
): Map<K, V> {
  const entries = map.entries();
  return new Map((((entries: Iterator<[InK, InV]>): any): Iterator<[K, V]>));
}

/**
 * Map across the keys of a map. Note that the key-mapping function is
 * provided both the key and the value for each entry.
 *
 * The key-mapping function must be injective on the map's key set. If
 * it maps two distinct input keys to the same output key, an error may
 * be thrown.
 */
export function mapKeys<K, V, InK, InV: V>(
  map: $ReadOnlyMap<InK, InV>,
  f: (InK, InV) => K
): Map<K, V> {
  const result = new Map();
  for (const [k, v] of map.entries()) {
    const outK = f(k, v);
    if (result.has(outK)) {
      throw new Error("duplicate key: " + String(outK));
    }
    result.set(outK, v);
  }
  return result;
}

/**
 * Map across the values of a map. Note that the value-mapping function
 * is provided both the key and the value for each entry.
 *
 * There are no restrictions on the value-mapping function (in
 * particular, it need not be injective).
 */
export function mapValues<K, V, InK: K, InV>(
  map: $ReadOnlyMap<InK, InV>,
  g: (InK, InV) => V
): Map<K, V> {
  const result = new Map();
  for (const [k, v] of map.entries()) {
    result.set(k, g(k, v));
  }
  return result;
}

/**
 * Map simultaneously across the keys and values of a map.
 *
 * The key-mapping function must be injective on the map's key set. If
 * it maps two distinct input keys to the same output key, an error may
 * be thrown. There are no such restrictions on the value-mapping
 * function.
 */
export function mapEntries<K, V, InK, InV>(
  map: $ReadOnlyMap<InK, InV>,
  h: (InK, InV) => [K, V]
): Map<K, V> {
  const result = new Map();
  for (const [k, v] of map.entries()) {
    const [outK, outV] = h(k, v);
    if (result.has(outK)) {
      throw new Error("duplicate key: " + String(outK));
    }
    result.set(outK, outV);
  }
  return result;
}

/**
 * Merge maps without mutating the arguments.
 *
 * Merges multiple maps, returning a new map which has every key from
 * the source maps, with their corresponding values. None of the inputs
 * are mutated. In the event that multiple maps have the same key, an
 * error will be thrown.
 */
export function merge<K, V>(
  maps: $ReadOnlyArray<$ReadOnlyMap<K, V>>
): Map<K, V> {
  const result = new Map();
  let updates = 0;
  for (const map of maps) {
    for (const [key, value] of map.entries()) {
      result.set(key, value);
      if (result.size !== ++updates) {
        throw new Error(`Maps have duplicate key: ${String(key)}`);
      }
    }
  }
  return result;
}

/**
 * Given a map whose values are arrays, push an element onto the array
 * corresponding to the given key. If the key is not in the map, first
 * insert it with value a new empty array.
 *
 * If the key is already in the map, its value will be mutated, not
 * replaced.
 */
export function pushValue<K, V>(map: Map<K, V[]>, key: K, value: V): V[] {
  let arr = map.get(key);
  if (arr == null) {
    map.set(key, (arr = []));
  }
  arr.push(value);
  return arr;
}

/**
 * Given a Map, transform its entries into an Array using a
 * provided transformer function.
 */
export function mapToArray<K, V, R>(
  map: $ReadOnlyMap<K, V>,
  fn: (pair: [K, V], index: number) => R
): R[] {
  return Array.from(map.entries()).map(fn);
}
