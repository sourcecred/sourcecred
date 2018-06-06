// @flow
// This module implements Address functionality for the Graph module
// This module should not be directly imported by clients; rather, all public
// parts of this module are re-exported via Graph

import stringify from "json-stable-stringify";

export opaque type NodeAddress: string = string;
export opaque type EdgeAddress: string = string;
type GenericAddress = NodeAddress | EdgeAddress;

const NODE_PREFIX = "N";
const EDGE_PREFIX = "E";
const NODE_CODE_POINT = NODE_PREFIX.charCodeAt(0);
const EDGE_CODE_POINT = EDGE_PREFIX.charCodeAt(0);
const SEPARATOR = "\0";

const NODE: "NODE" = "NODE";
const EDGE: "EDGE" = "EDGE";
type AddressType = typeof NODE | typeof EDGE;

function addressType(x: string): ?AddressType {
  if (x != null && x.endsWith(SEPARATOR)) {
    if (x.charCodeAt(0) === NODE_CODE_POINT && x.charCodeAt(1) === 0) {
      return NODE;
    }
    if (x.charCodeAt(0) === EDGE_CODE_POINT && x.charCodeAt(1) === 0) {
      return EDGE;
    }
  }
}

export function assertNodeAddress(x: NodeAddress, what: string = "node") {
  const type = addressType(x);
  switch (type) {
    case "NODE":
      return;
    case "EDGE":
      throw new Error(
        `${what}: expected NodeAddress, got EdgeAddress: ${stringify(x)}`
      );
    case null:
    case undefined:
      throw new Error(`${what}: bad address: ${stringify(x)}`);
    default:
      // eslint-disable-next-line no-unused-expressions
      (type: empty);
      throw new Error(`${what}: invariant violation: ${stringify(x)}`);
  }
}

export function assertEdgeAddress(x: EdgeAddress, what: string = "edge") {
  const type = addressType(x);
  switch (type) {
    case "NODE":
      throw new Error(
        `${what}: expected EdgeAddress, got NodeAddress: ${stringify(x)}`
      );
    case "EDGE":
      return;
    case null:
    case undefined:
      throw new Error(`${what}: bad address: ${stringify(x)}`);
    default:
      // eslint-disable-next-line no-unused-expressions
      (type: empty);
      throw new Error(`${what}: invariant violation: ${stringify(x)}`);
  }
}

export function assertAddress(x: GenericAddress, what: string = "address") {
  if (addressType(x) == null) {
    throw new Error(
      `${what}: expected NodeAddress or EdgeAddress, got: ${stringify(x)}`
    );
  }
}

export function assertAddressArray(
  arr: $ReadOnlyArray<string>,
  what: string = "address array"
) {
  if (arr == null) {
    throw new Error(String(arr));
  }
  arr.forEach((s: string) => {
    if (s == null) {
      throw new Error(`${what}: ${String(s)} in ${stringify(arr)}`);
    }
    if (s.indexOf(SEPARATOR) !== -1) {
      throw new Error(`${what}: NUL char: ${stringify(arr)}`);
    }
  });
}

function nullDelimited(components: $ReadOnlyArray<string>): string {
  return [...components, ""].join(SEPARATOR);
}

export function nodeAddress(arr: $ReadOnlyArray<string>): NodeAddress {
  assertAddressArray(arr);
  return NODE_PREFIX + SEPARATOR + nullDelimited(arr);
}

export function edgeAddress(arr: $ReadOnlyArray<string>): EdgeAddress {
  assertAddressArray(arr);
  return EDGE_PREFIX + SEPARATOR + nullDelimited(arr);
}

export function toParts(a: GenericAddress): string[] {
  assertAddress(a);
  const parts = a.split(SEPARATOR);
  return parts.slice(1, parts.length - 1);
}

export function nodeAppend(
  base: NodeAddress,
  ...components: string[]
): NodeAddress {
  assertNodeAddress(base);
  assertAddressArray(components);
  return base + nullDelimited(components);
}

export function edgeAppend(
  base: EdgeAddress,
  ...components: string[]
): EdgeAddress {
  assertEdgeAddress(base);
  assertAddressArray(components);
  return base + nullDelimited(components);
}

export function nodeToString(a: NodeAddress): string {
  assertNodeAddress(a);
  const parts = toParts(a);
  return `nodeAddress(${stringify(parts)})`;
}

export function edgeToString(a: EdgeAddress): string {
  assertEdgeAddress(a);
  const parts = toParts(a);
  return `edgeAddress(${stringify(parts)})`;
}

/**
 * Determine whether the parts of `prefix` form a prefix of the parts of
 * `address`. That is, determine whether there exists an `i` such that
 * `toParts(prefix)` equals `toParts(address).slice(0, i)`.
 */
export function nodeHasPrefix(
  address: NodeAddress,
  prefix: NodeAddress
): boolean {
  assertNodeAddress(address);
  assertNodeAddress(prefix);
  return address.startsWith(prefix);
}

/**
 * Determine whether the parts of `prefix` form a prefix of the parts of
 * `address`. That is, determine whether there exists an `i` such that
 * `toParts(prefix)` equals `toParts(address).slice(0, i)`.
 */
export function edgeHasPrefix(
  address: EdgeAddress,
  prefix: EdgeAddress
): boolean {
  assertEdgeAddress(address);
  assertEdgeAddress(prefix);
  return address.startsWith(prefix);
}
