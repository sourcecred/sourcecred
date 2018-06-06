// @flow

import stringify from "json-stable-stringify";

export interface AddressModule<Address> {
  /**
   * Assert at runtime that the provided address is actually a valid
   * address of this kind, throwing an error if it is not. If `what` is
   * provided, it will be included in the error message.
   */
  assertValid(address: Address, what?: string): void;

  /**
   * Assert at runtime that the provided array is a valid array of
   * address parts (i.e., a valid input to `fromParts`), throwing an
   * error if it is not. If `what` is provided, it will be included in
   * the error message.
   */
  assertValidParts(parts: $ReadOnlyArray<string>, what?: string): void;

  /**
   * Convert an array of address parts to an address. The input must be
   * a non-null array of non-null strings, none of which contains the
   * NUL character. This is the inverse of `toParts`.
   */
  fromParts(parts: $ReadOnlyArray<string>): Address;

  /**
   * Convert an address to the array of parts that it represents. This
   * is the inverse of `fromParts`.
   */
  toParts(address: Address): string[];

  /**
   * Pretty-print an address. The result will be human-readable and
   * contain only printable characters. Clients should not make any
   * assumptions about the format.
   */
  toString(address: Address): string;

  /**
   * Construct an address by extending the given address with the given
   * additional components. This function is equivalent to:
   *
   *     return fromParts([...toParts(address), ...components]);
   *
   * but may be more efficient.
   */
  append(address: Address, ...components: string[]): Address;

  /**
   * Test whether the given address has the given prefix. This function
   * is equivalent to:
   *
   *     const prefixParts = toParts(prefix);
   *     const addressParts = toParts(address);
   *     const actualPrefix = addressParts.slice(0, prefixParts.length);
   *     return deepEqual(prefix, actualPrefix);
   *
   * (where `deepEqual` checks value equality on arrays of strings), but
   * may be more efficient.
   *
   * Note that this is an array-wise prefix, not a string-wise-prefix:
   * e.g., `toParts(["ban"])` is not a prefix of `toParts(["banana"])`.
   */
  hasPrefix(address: Address, prefix: Address): boolean;
}

export type Options = {|
  /**
   * The name of this kind of address, like `NodeAddress`.
   */
  +name: string,

  /**
   * A unique nonce for the runtime representation of this address. For
   * compact serialization, this should be short; a single letter
   * suffices.
   */
  +nonce: string,

  /**
   * For the purposes of nice error messages: in response to an address
   * of the wrong kind, we can inform the user what kind of address they
   * passed (e.g., "expected NodeAddress, got EdgeAddress"). This
   * dictionary maps another address module's nonce to the name of that
   * module.
   */
  +otherNonces?: Map<string, string>,
|};

export function makeAddressModule(options: Options): AddressModule<string> {
  type Address = string; // for readability and interface consistency
  const {name, nonce} = options;
  const otherNonces = new Map(options.otherNonces || new Map());

  const separator = "\0";
  if (nonce.indexOf(separator) !== -1) {
    throw new Error(`invalid nonce (contains NUL): ${stringify(nonce)}`);
  }

  const nonceWithSeparator = nonce + separator;
  const otherNoncesWithSeparators = new Map();
  for (const [otherNonce, otherName] of otherNonces.entries()) {
    if (otherNonce === nonce) {
      throw new Error(
        `primary nonce listed as otherNonce: ${stringify(nonce)}`
      );
    }
    if (otherNonce.indexOf(separator) !== -1) {
      throw new Error(
        `invalid otherNonce (contains NUL): ${stringify(otherNonce)}`
      );
    }
    otherNoncesWithSeparators.set(otherNonce + separator, otherName);
  }

  function assertValid(address: Address, what?: string): void {
    // TODO(perf): If this function becomes a bottleneck, consider
    // omitting it entirely in production. If this is undesirable, a
    // number of micro-optimizations can be made.
    const prefix = what == null ? "" : `${what}: `;
    if (address == null) {
      throw new Error(prefix + `expected ${name}, got: ${String(address)}`);
    }
    if (!address.endsWith(separator)) {
      throw new Error(prefix + `expected ${name}, got: ${stringify(address)}`);
    }
    if (!address.startsWith(nonceWithSeparator)) {
      for (const [
        otherNonceWithSeparator,
        otherName,
      ] of otherNoncesWithSeparators) {
        if (address.startsWith(otherNonceWithSeparator)) {
          throw new Error(
            prefix + `expected ${name}, got ${otherName}: ${stringify(address)}`
          );
        }
      }
      throw new Error(prefix + `expected ${name}, got: ${stringify(address)}`);
    }
  }

  function partsString(parts: $ReadOnlyArray<string>): string {
    // This is needed to properly print arrays containing `undefined`.
    return "[" + parts.map((p) => String(stringify(p))).join(",") + "]";
  }

  function assertValidParts(
    parts: $ReadOnlyArray<string>,
    what?: string
  ): void {
    // TODO(perf): If this function becomes a bottleneck, consider
    // omitting it entirely in production. If this is undesirable, a
    // number of micro-optimizations can be made.
    const prefix = what == null ? "" : `${what}: `;
    if (parts == null) {
      throw new Error(
        prefix + `expected array of parts, got: ${String(parts)}`
      );
    }
    parts.forEach((s: string) => {
      if (s == null) {
        throw new Error(
          prefix +
            `expected array of parts, got ${String(s)} in: ${partsString(
              parts
            )}`
        );
      }
      if (s.indexOf(separator) !== -1) {
        const where = `${stringify(s)} in ${partsString(parts)}`;
        throw new Error(prefix + `part contains NUL character: ${where}`);
      }
    });
  }

  function nullDelimited(components: $ReadOnlyArray<string>): string {
    return [...components, ""].join(separator);
  }

  function fromParts(parts: $ReadOnlyArray<string>): Address {
    assertValidParts(parts);
    return nonce + separator + nullDelimited(parts);
  }

  function toParts(address: Address): string[] {
    assertValid(address);
    const parts = address.split(separator);
    return parts.slice(1, parts.length - 1);
  }

  function toString(address: Address): string {
    const parts = toParts(address);
    return `${name}${stringify(parts)}`;
  }

  function append(address: Address, ...parts: string[]): Address {
    assertValid(address);
    assertValidParts(parts);
    return address + nullDelimited(parts);
  }

  function hasPrefix(address: Address, prefix: Address): boolean {
    const _ = {address, prefix};
    throw new Error("hasPrefix");
  }

  const result = {
    assertValid,
    assertValidParts,
    fromParts,
    toParts,
    toString,
    append,
    hasPrefix,
  };
  return Object.freeze(result);
}
