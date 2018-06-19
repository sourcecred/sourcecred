// @flow

import {NodeAddress, type NodeAddressT} from "../../core/graph";
import type {Hash} from "./types";

export opaque type RawAddress: NodeAddressT = NodeAddressT;

const GIT_PREFIX = NodeAddress.fromParts(["sourcecred", "git"]);
export function _gitAddress(...parts: string[]): RawAddress {
  return NodeAddress.append(GIT_PREFIX, ...parts);
}

export const BLOB_TYPE: "BLOB" = "BLOB";
export const COMMIT_TYPE: "COMMIT" = "COMMIT";
export const SUBMODULE_COMMIT_TYPE: "SUBMODULE_COMMIT" = "SUBMODULE_COMMIT";
export const TREE_TYPE: "TREE" = "TREE";
export const TREE_ENTRY_TYPE: "TREE_ENTRY" = "TREE_ENTRY";

export const _Prefix = Object.freeze({
  base: GIT_PREFIX,
  blob: _gitAddress(BLOB_TYPE),
  commit: _gitAddress(COMMIT_TYPE),
  submoduleCommit: _gitAddress(SUBMODULE_COMMIT_TYPE),
  tree: _gitAddress(TREE_TYPE),
  treeEntry: _gitAddress(TREE_ENTRY_TYPE),
});

export type BlobAddress = {|
  +type: typeof BLOB_TYPE,
  +hash: Hash,
|};
export type CommitAddress = {|
  +type: typeof COMMIT_TYPE,
  +hash: Hash,
|};
export type SubmoduleCommitAddress = {|
  +type: typeof SUBMODULE_COMMIT_TYPE,
  +submoduleUrl: string,
  +commitHash: Hash,
|};
export type TreeAddress = {|
  +type: typeof TREE_TYPE,
  +hash: Hash,
|};
export type TreeEntryAddress = {|
  +type: typeof TREE_ENTRY_TYPE,
  +treeHash: Hash,
  +name: string,
|};

// A tree entry has contents with one of the following types of
// addresses.
export type TreeEntryContentsAddress =
  | BlobAddress
  | TreeAddress
  | SubmoduleCommitAddress;

export type StructuredAddress =
  | BlobAddress
  | CommitAddress
  | SubmoduleCommitAddress
  | TreeAddress
  | TreeEntryAddress;

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
    case "BLOB": {
      if (rest.length !== 1) throw fail();
      const [hash] = rest;
      return {type: BLOB_TYPE, hash};
    }
    case "COMMIT": {
      if (rest.length !== 1) throw fail();
      const [hash] = rest;
      return {type: COMMIT_TYPE, hash};
    }
    case "SUBMODULE_COMMIT": {
      if (rest.length !== 2) throw fail();
      const [submoduleUrl, commitHash] = rest;
      return {type: SUBMODULE_COMMIT_TYPE, submoduleUrl, commitHash};
    }
    case "TREE": {
      if (rest.length !== 1) throw fail();
      const [hash] = rest;
      return {type: TREE_TYPE, hash};
    }
    case "TREE_ENTRY": {
      if (rest.length !== 2) throw fail();
      const [treeHash, name] = rest;
      return {type: TREE_ENTRY_TYPE, treeHash, name};
    }
    default:
      // eslint-disable-next-line no-unused-expressions
      (type: empty);
      throw fail();
  }
}

export function toRaw(x: StructuredAddress): RawAddress {
  switch (x.type) {
    case BLOB_TYPE:
      return NodeAddress.append(_Prefix.blob, x.hash);
    case COMMIT_TYPE:
      return NodeAddress.append(_Prefix.commit, x.hash);
    case SUBMODULE_COMMIT_TYPE:
      return NodeAddress.append(
        _Prefix.submoduleCommit,
        x.submoduleUrl,
        x.commitHash
      );
    case TREE_TYPE:
      return NodeAddress.append(_Prefix.tree, x.hash);
    case TREE_ENTRY_TYPE:
      return NodeAddress.append(_Prefix.treeEntry, x.treeHash, x.name);
    default:
      // eslint-disable-next-line no-unused-expressions
      (x.type: empty);
      throw new Error(`Unexpected type ${x.type}`);
  }
}
