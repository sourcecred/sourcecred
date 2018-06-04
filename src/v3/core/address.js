// @flow
// This module implements Address functionality for the Graph module
// This module should not be directly imported by clients; rather, all public
// parts of this module are re-exported via Graph

import stringify from "json-stable-stringify";

export opaque type _NodeAddress = string;
export opaque type _EdgeAddress = string;
type GenericAddress = _NodeAddress | _EdgeAddress;

export const _Address = {
  toParts,
  nodeAddress,
  edgeAddress,
};

const NODE_PREFIX = "N";
const EDGE_PREFIX = "E";
const SEPARATOR = "\0";

const NODE = Symbol("NODE");
const EDGE = Symbol("EDGE");
type AddressType = typeof NODE | typeof EDGE;

function addressType(x: string): ?AddressType {
  if (x != null && x.endsWith(SEPARATOR)) {
    if (x.startsWith(NODE_PREFIX)) {
      return NODE;
    }
    if (x.startsWith(EDGE_PREFIX)) {
      return EDGE;
    }
  }
}

export function assertNodeAddress(x: _NodeAddress) {
  const type = addressType(x);
  switch (type) {
    case NODE:
      return;
    case EDGE:
      throw new Error(`Expected NodeAddress, got EdgeAddress: ${x}`);
    default:
      throw new Error(`Bad address: ${x}`);
  }
}

export function assertEdgeAddress(x: _EdgeAddress) {
  const type = addressType(x);
  switch (type) {
    case NODE:
      throw new Error(`Expected EdgeAddress, got NodeAddress: ${x}`);
    case EDGE:
      return;
    default:
      throw new Error(`Bad address: ${x}`);
  }
}
function assertAddress(x: GenericAddress) {
  if (addressType(x) == null) {
    throw new Error(`Expected Address, got: ${x}`);
  }
}

function assertAddressArray(arr: $ReadOnlyArray<string>) {
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

function nodeAddress(arr: $ReadOnlyArray<string> | void): _NodeAddress {
  if (arr === undefined) {
    return NODE_PREFIX + SEPARATOR;
  } else {
    assertAddressArray(arr);
    return [NODE_PREFIX, ...arr, ""].join(SEPARATOR);
  }
}

function edgeAddress(arr: $ReadOnlyArray<string> | void): _EdgeAddress {
  if (arr === undefined) {
    return EDGE_PREFIX + SEPARATOR;
  } else {
    assertAddressArray(arr);
    return [EDGE_PREFIX, ...arr, ""].join(SEPARATOR);
  }
}

function toParts(a: GenericAddress): string[] {
  assertAddress(a);
  const parts = a.split(SEPARATOR);
  return parts.slice(1, parts.length - 1);
}
