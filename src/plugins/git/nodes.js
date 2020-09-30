// @flow

import deepFreeze from "deep-freeze";
import {NodeAddress, type NodeAddressT} from "../../core/graph";
import type {Hash} from "./types";

export opaque type RawAddress: NodeAddressT = NodeAddressT;

const GIT_PREFIX = NodeAddress.fromParts(["sourcecred", "git"]);
export function _gitAddress(...parts: string[]): RawAddress {
  return NodeAddress.append(GIT_PREFIX, ...parts);
}

export const COMMIT_TYPE: "COMMIT" = "COMMIT";

export const Prefix: {|base: NodeAddressT, commit: RawAddress|} = deepFreeze({
  base: GIT_PREFIX,
  commit: _gitAddress(COMMIT_TYPE),
});

export type CommitAddress = {|
  +type: typeof COMMIT_TYPE,
  +hash: Hash,
|};

export type StructuredAddress = CommitAddress;

export function fromRaw(x: RawAddress): StructuredAddress {
  function fail() {
    return new Error(`Bad address: ${NodeAddress.toString(x)}`);
  }
  if (!NodeAddress.hasPrefix(x, GIT_PREFIX)) {
    throw fail();
  }
  const [_unused_sc, _unused_git, _type, ...rest] = NodeAddress.toParts(x);
  const type: $ElementType<StructuredAddress, "type"> = (_type: any);
  switch (type) {
    case "COMMIT": {
      if (rest.length !== 1) throw fail();
      const [hash] = rest;
      return {type: COMMIT_TYPE, hash};
    }
    default:
      // eslint-disable-next-line no-unused-expressions
      (type: empty);
      throw fail();
  }
}

export function toRaw(x: StructuredAddress): RawAddress {
  switch (x.type) {
    case COMMIT_TYPE:
      return NodeAddress.append(Prefix.commit, x.hash);
    default:
      throw new Error(`Unexpected type ${(x.type: empty)}`);
  }
}
