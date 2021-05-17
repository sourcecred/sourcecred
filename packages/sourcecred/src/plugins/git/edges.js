// @flow

import deepFreeze from "deep-freeze";
import {
  type Edge,
  type EdgeAddressT,
  EdgeAddress,
  NodeAddress,
} from "../../core/graph";
import * as GitNode from "./nodes";
import {type TimestampMs} from "../../util/timestamp";

export opaque type RawAddress: EdgeAddressT = EdgeAddressT;

export const HAS_TREE_TYPE: "HAS_TREE" = "HAS_TREE";
export const HAS_PARENT_TYPE: "HAS_PARENT" = "HAS_PARENT";
export const INCLUDES_TYPE: "INCLUDES" = "INCLUDES";
export const BECOMES_TYPE: "BECOMES" = "BECOMES";
export const HAS_CONTENTS_TYPE: "HAS_CONTENTS" = "HAS_CONTENTS";

const GIT_PREFIX = EdgeAddress.fromParts(["sourcecred", "git"]);
function gitEdgeAddress(...parts: string[]): RawAddress {
  return EdgeAddress.append(GIT_PREFIX, ...parts);
}

export const Prefix: {|base: EdgeAddressT, hasParent: RawAddress|} = deepFreeze(
  {
    base: GIT_PREFIX,
    hasParent: gitEdgeAddress(HAS_PARENT_TYPE),
  }
);

export type HasParentAddress = {|
  type: typeof HAS_PARENT_TYPE,
  child: GitNode.CommitAddress,
  parent: GitNode.CommitAddress,
|};

export type StructuredAddress = HasParentAddress;

export const createEdge: {|
  hasParent: (
    child: GitNode.CommitAddress,
    parent: GitNode.CommitAddress,
    timestampMs: TimestampMs
  ) => Edge,
|} = deepFreeze({
  hasParent: (
    child: GitNode.CommitAddress,
    parent: GitNode.CommitAddress,
    timestampMs: TimestampMs
  ): Edge => ({
    address: toRaw({type: HAS_PARENT_TYPE, child, parent}),
    src: GitNode.toRaw(child),
    dst: GitNode.toRaw(parent),
    timestampMs,
  }),
});

const NODE_PREFIX_LENGTH = NodeAddress.toParts(GitNode._gitAddress()).length;

function lengthEncode(x: GitNode.RawAddress): $ReadOnlyArray<string> {
  const baseParts = NodeAddress.toParts(x).slice(NODE_PREFIX_LENGTH);
  return [String(baseParts.length), ...baseParts];
}
function lengthDecode(
  x: $ReadOnlyArray<string>,
  fail: () => Error
): {|+parts: $ReadOnlyArray<string>, +rest: $ReadOnlyArray<string>|} {
  if (x.length === 0) {
    // Not length-encoded.
    throw fail();
  }
  const [lengthString, ...allParts] = x;
  const length = parseInt(lengthString, 10);
  if (isNaN(length)) {
    throw fail();
  }
  if (length > allParts.length) {
    // Not enough elements.
    throw fail();
  }
  return {parts: allParts.slice(0, length), rest: allParts.slice(length)};
}
function multiLengthDecode(x: $ReadOnlyArray<string>, fail: () => Error) {
  let remaining = x;
  const partses = [];
  while (remaining.length > 0) {
    const {parts, rest} = lengthDecode(remaining, fail);
    partses.push(parts);
    remaining = rest;
  }
  return partses;
}

export function fromRaw(x: RawAddress): StructuredAddress {
  function fail() {
    return new Error(`Bad address: ${EdgeAddress.toString(x)}`);
  }
  if (!EdgeAddress.hasPrefix(x, GIT_PREFIX)) {
    throw fail();
  }
  const [_unused_sc, _unused_git, _type, ...rest] = EdgeAddress.toParts(x);
  const type: $ElementType<StructuredAddress, "type"> = (_type: any);
  switch (type) {
    case "HAS_PARENT": {
      const parts = multiLengthDecode(rest, fail);
      if (parts.length !== 2) throw fail();
      const [childParts, parentParts] = parts;
      const child: GitNode.CommitAddress = (GitNode.fromRaw(
        GitNode._gitAddress(...childParts)
      ): any);
      const parent: GitNode.CommitAddress = (GitNode.fromRaw(
        GitNode._gitAddress(...parentParts)
      ): any);
      return {type: HAS_PARENT_TYPE, child, parent};
    }
    default:
      // eslint-disable-next-line no-unused-expressions
      (type: empty);
      throw fail();
  }
}

export function toRaw(x: StructuredAddress): RawAddress {
  switch (x.type) {
    case HAS_PARENT_TYPE:
      return EdgeAddress.append(
        Prefix.hasParent,
        ...lengthEncode(GitNode.toRaw(x.child)),
        ...lengthEncode(GitNode.toRaw(x.parent))
      );
    default:
      throw new Error((x.type: empty));
  }
}
