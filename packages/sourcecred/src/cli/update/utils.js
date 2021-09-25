// @flow

import cloneDeep from "lodash.clonedeep";

// This is a type-friendly way to add optional attributes to a config.
// Attributes from the `optionals` parameter will only be added if they
// are not undefined.
// It is recommended to define T explicitly when using this.
// Example: `const object = buildObject<MyType>(...);`
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
