// @flow

import {
  type Edge,
  type EdgeAddressT,
  EdgeAddress,
  NodeAddress,
} from "../../core/graph";
import * as GitNode from "./nodes";

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

export const _Prefix = Object.freeze({
  base: GIT_PREFIX,
  hasTree: gitEdgeAddress(HAS_TREE_TYPE),
  hasParent: gitEdgeAddress(HAS_PARENT_TYPE),
  includes: gitEdgeAddress(INCLUDES_TYPE),
  becomes: gitEdgeAddress(BECOMES_TYPE),
  hasContents: gitEdgeAddress(HAS_CONTENTS_TYPE),
});

export type HasTreeAddress = {|
  type: typeof HAS_TREE_TYPE,
  commit: GitNode.CommitAddress,
|};
export type HasParentAddress = {|
  type: typeof HAS_PARENT_TYPE,
  child: GitNode.CommitAddress,
  parent: GitNode.CommitAddress,
|};
export type IncludesAddress = {|
  type: typeof INCLUDES_TYPE,
  treeEntry: GitNode.TreeEntryAddress,
|};
export type BecomesAddress = {|
  type: typeof BECOMES_TYPE,
  was: GitNode.TreeEntryAddress,
  becomes: GitNode.TreeEntryAddress,
|};
export type HasContentsAddress = {|
  type: typeof HAS_CONTENTS_TYPE,
  treeEntry: GitNode.TreeEntryAddress,
|};

export type StructuredAddress =
  | HasTreeAddress
  | HasParentAddress
  | IncludesAddress
  | BecomesAddress
  | HasContentsAddress;

export const createEdge = Object.freeze({
  hasTree: (
    commit: GitNode.CommitAddress,
    tree: GitNode.TreeAddress
  ): Edge => ({
    address: toRaw({type: HAS_TREE_TYPE, commit}),
    src: GitNode.toRaw(commit),
    dst: GitNode.toRaw(tree),
  }),
  hasParent: (
    child: GitNode.CommitAddress,
    parent: GitNode.CommitAddress
  ): Edge => ({
    address: toRaw({type: HAS_PARENT_TYPE, child, parent}),
    src: GitNode.toRaw(child),
    dst: GitNode.toRaw(parent),
  }),
  includes: (
    tree: GitNode.TreeAddress,
    treeEntry: GitNode.TreeEntryAddress
  ): Edge => ({
    address: toRaw({type: INCLUDES_TYPE, treeEntry}),
    src: GitNode.toRaw(tree),
    dst: GitNode.toRaw(treeEntry),
  }),
  becomes: (
    was: GitNode.TreeEntryAddress,
    becomes: GitNode.TreeEntryAddress
  ): Edge => ({
    address: toRaw({type: BECOMES_TYPE, was, becomes}),
    src: GitNode.toRaw(was),
    dst: GitNode.toRaw(becomes),
  }),
  hasContents: (
    treeEntry: GitNode.TreeEntryAddress,
    contents: GitNode.TreeEntryContentsAddress
  ): Edge => ({
    address: toRaw({type: HAS_CONTENTS_TYPE, treeEntry}),
    src: GitNode.toRaw(treeEntry),
    dst: GitNode.toRaw(contents),
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
  let partses = [];
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
    case "HAS_TREE": {
      const parts = multiLengthDecode(rest, fail);
      if (parts.length !== 1) throw fail();
      const [commitParts] = parts;
      const commit: GitNode.CommitAddress = (GitNode.fromRaw(
        GitNode._gitAddress(...commitParts)
      ): any);
      return {type: HAS_TREE_TYPE, commit};
    }
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
    case "INCLUDES": {
      const parts = multiLengthDecode(rest, fail);
      if (parts.length !== 1) throw fail();
      const [treeEntryParts] = parts;
      const treeEntry: GitNode.TreeEntryAddress = (GitNode.fromRaw(
        GitNode._gitAddress(...treeEntryParts)
      ): any);
      return {type: INCLUDES_TYPE, treeEntry};
    }
    case "BECOMES": {
      const parts = multiLengthDecode(rest, fail);
      if (parts.length !== 2) throw fail();
      const [wasParts, becomesParts] = parts;
      const was: GitNode.TreeEntryAddress = (GitNode.fromRaw(
        GitNode._gitAddress(...wasParts)
      ): any);
      const becomes: GitNode.TreeEntryAddress = (GitNode.fromRaw(
        GitNode._gitAddress(...becomesParts)
      ): any);
      return {type: BECOMES_TYPE, was, becomes};
    }
    case "HAS_CONTENTS": {
      const parts = multiLengthDecode(rest, fail);
      if (parts.length !== 1) throw fail();
      const [treeEntryParts] = parts;
      const treeEntry: GitNode.TreeEntryAddress = (GitNode.fromRaw(
        GitNode._gitAddress(...treeEntryParts)
      ): any);
      return {type: HAS_CONTENTS_TYPE, treeEntry};
    }
    default:
      // eslint-disable-next-line no-unused-expressions
      (type: empty);
      throw fail();
  }
}

export function toRaw(x: StructuredAddress): RawAddress {
  switch (x.type) {
    case HAS_TREE_TYPE:
      return EdgeAddress.append(
        _Prefix.hasTree,
        ...lengthEncode(GitNode.toRaw(x.commit))
      );
    case HAS_PARENT_TYPE:
      return EdgeAddress.append(
        _Prefix.hasParent,
        ...lengthEncode(GitNode.toRaw(x.child)),
        ...lengthEncode(GitNode.toRaw(x.parent))
      );
    case INCLUDES_TYPE:
      return EdgeAddress.append(
        _Prefix.includes,
        ...lengthEncode(GitNode.toRaw(x.treeEntry))
      );
    case BECOMES_TYPE:
      return EdgeAddress.append(
        _Prefix.becomes,
        ...lengthEncode(GitNode.toRaw(x.was)),
        ...lengthEncode(GitNode.toRaw(x.becomes))
      );
    case HAS_CONTENTS_TYPE:
      return EdgeAddress.append(
        _Prefix.hasContents,
        ...lengthEncode(GitNode.toRaw(x.treeEntry))
      );
    default:
      // eslint-disable-next-line no-unused-expressions
      (x.type: empty);
      throw new Error(x.type);
  }
}
