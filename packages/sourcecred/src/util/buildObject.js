// @flow

import cloneDeep from "lodash.clonedeep";

/**
A type-friendly way to add optional attributes to an object.
Useful for building minimal objects for clean output, such as when transforming
and writing configs.

Attributes from the `optionals` parameter will only be added if their value
is not in the `exclusions` parameter.
It is recommended to define T explicitly when using this.

Examples:
buildObject<{| s: string, n?: number}>({s: "test"}, {n: 1})
  returns {s: "test", n: 1}
buildObject<{| s: string, n?: number}>({s: "test"}, {n: undefined})
  returns {s: "test"}
buildObject<{| s: string, n?: number}>({s: "test"}, {n: 1}, [1])
  returns {s: "test"}
*/
export function buildObject<T: {}>(
  required: T,
  optionals: $Shape<T>,
  exclusions: $ReadOnlyArray<$Values<T> | typeof undefined> = [undefined]
): T {
  let config: T = cloneDeep(required);
  for (const [key, value] of Object.entries(optionals)) {
    if (!exclusions.includes(value))
      config = {
        ...config,
        [key]: cloneDeep(value),
      };
  }
  return config;
}
