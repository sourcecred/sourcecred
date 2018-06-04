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

const NODE = Symbol("NODE");
const EDGE = Symbol("EDGE");
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

export function assertNodeAddress(x: NodeAddress) {
  const type = addressType(x);
  switch (type) {
    case NODE:
      return;
    case EDGE:
      throw new Error(`Expected NodeAddress, got EdgeAddress: ${stringify(x)}`);
    default:
      throw new Error(`Bad address: ${stringify(x)}`);
  }
}

export function assertEdgeAddress(x: EdgeAddress) {
  const type = addressType(x);
  switch (type) {
    case NODE:
      throw new Error(`Expected EdgeAddress, got NodeAddress: ${stringify(x)}`);
    case EDGE:
      return;
    default:
      throw new Error(`Bad address: ${stringify(x)}`);
  }
}

export function assertAddress(x: GenericAddress) {
  if (addressType(x) == null) {
    throw new Error(
      `Expected NodeAddress or EdgeAddress, got: ${stringify(x)}`
    );
  }
}

export function assertAddressArray(arr: $ReadOnlyArray<string>) {
  if (arr == null) {
    throw new Error(String(arr));
  }
  arr.forEach((s: string) => {
    if (s == null) {
      throw new Error(`${String(s)} in ${stringify(arr)}`);
    }
    if (s.indexOf(SEPARATOR) !== -1) {
      throw new Error(`NUL char: ${stringify(arr)}`);
    }
  });
}

export function nodeAddress(arr: $ReadOnlyArray<string>): NodeAddress {
  assertAddressArray(arr);
  return [NODE_PREFIX, ...arr, ""].join(SEPARATOR);
}

export function edgeAddress(arr: $ReadOnlyArray<string>): EdgeAddress {
  assertAddressArray(arr);
  return [EDGE_PREFIX, ...arr, ""].join(SEPARATOR);
}

export function toParts(a: GenericAddress): string[] {
  assertAddress(a);
  const parts = a.split(SEPARATOR);
  return parts.slice(1, parts.length - 1);
}
