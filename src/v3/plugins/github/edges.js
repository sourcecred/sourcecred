// @flow

import {
  type Edge,
  type EdgeAddressT,
  type NodeAddressT,
  EdgeAddress,
  NodeAddress,
} from "../../core/graph";
import * as GithubNode from "./nodes";

export opaque type RawAddress: EdgeAddressT = EdgeAddressT;

export type AuthorsAddress = {|
  +type: "AUTHORS",
  +author: GithubNode.UserlikeAddress,
  +content: GithubNode.AuthorableAddress,
|};
export type MergedAsAddress = {|
  +type: "MERGED_AS",
  +pull: GithubNode.PullAddress,
|};
export type HasParentAddress = {|
  +type: "HAS_PARENT",
  +child: GithubNode.ChildAddress,
|};
export type ReferencesAddress = {|
  +type: "REFERENCES",
  +referrer: GithubNode.TextContentAddress,
  +referent: GithubNode.ReferentAddress,
|};

export type StructuredAddress =
  | AuthorsAddress
  | MergedAsAddress
  | HasParentAddress
  | ReferencesAddress;

export const createEdge = Object.freeze({
  authors: (
    author: GithubNode.UserlikeAddress,
    content: GithubNode.AuthorableAddress
  ): Edge => ({
    address: toRaw({type: "AUTHORS", author, content}),
    src: GithubNode.toRaw(author),
    dst: GithubNode.toRaw(content),
  }),
  mergedAs: (
    pull: GithubNode.PullAddress,
    commitAddress: NodeAddressT /* TODO: Make this a Git commit node address. */
  ): Edge => ({
    address: toRaw({type: "MERGED_AS", pull}),
    src: GithubNode.toRaw(pull),
    dst: commitAddress,
  }),
  hasParent: (
    child: GithubNode.ChildAddress,
    parent: GithubNode.ParentAddress
  ): Edge => ({
    address: toRaw({type: "HAS_PARENT", child}),
    src: GithubNode.toRaw(child),
    dst: GithubNode.toRaw(parent),
  }),
  references: (
    referrer: GithubNode.TextContentAddress,
    referent: GithubNode.ReferentAddress
  ): Edge => ({
    address: toRaw({type: "REFERENCES", referrer, referent}),
    src: GithubNode.toRaw(referrer),
    dst: GithubNode.toRaw(referent),
  }),
});

const NODE_PREFIX_LENGTH = NodeAddress.toParts(GithubNode._githubAddress())
  .length;

const GITHUB_PREFIX = EdgeAddress.fromParts(["sourcecred", "github"]);
function githubEdgeAddress(...parts: string[]): RawAddress {
  return EdgeAddress.append(GITHUB_PREFIX, ...parts);
}
function lengthEncode(x: GithubNode.RawAddress): $ReadOnlyArray<string> {
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
  if (!EdgeAddress.hasPrefix(x, GITHUB_PREFIX)) {
    throw fail();
  }
  const [_unused_sc, _unused_gh, kind, ...rest] = EdgeAddress.toParts(x);
  switch (kind) {
    case "AUTHORS": {
      const parts = multiLengthDecode(rest, fail);
      if (parts.length !== 2) {
        throw fail();
      }
      const [authorParts, contentParts] = parts;
      const author: GithubNode.UserlikeAddress = (GithubNode.fromRaw(
        GithubNode._githubAddress(...authorParts)
      ): any);
      const content: GithubNode.AuthorableAddress = (GithubNode.fromRaw(
        GithubNode._githubAddress(...contentParts)
      ): any);
      return ({type: "AUTHORS", author, content}: AuthorsAddress);
    }
    case "MERGED_AS": {
      const parts = multiLengthDecode(rest, fail);
      if (parts.length !== 1) {
        throw fail();
      }
      const [pullParts] = parts;
      const pull: GithubNode.PullAddress = (GithubNode.fromRaw(
        GithubNode._githubAddress(...pullParts)
      ): any);
      return ({type: "MERGED_AS", pull}: MergedAsAddress);
    }
    case "HAS_PARENT": {
      const parts = multiLengthDecode(rest, fail);
      if (parts.length !== 1) {
        throw fail();
      }
      const [childParts] = parts;
      const child: GithubNode.ChildAddress = (GithubNode.fromRaw(
        GithubNode._githubAddress(...childParts)
      ): any);
      return ({type: "HAS_PARENT", child}: HasParentAddress);
    }
    case "REFERENCES": {
      const parts = multiLengthDecode(rest, fail);
      if (parts.length !== 2) {
        throw fail();
      }
      const [referrerParts, referentParts] = parts;
      const referrer: GithubNode.TextContentAddress = (GithubNode.fromRaw(
        GithubNode._githubAddress(...referrerParts)
      ): any);
      const referent: GithubNode.ReferentAddress = (GithubNode.fromRaw(
        GithubNode._githubAddress(...referentParts)
      ): any);
      return ({type: "REFERENCES", referrer, referent}: ReferencesAddress);
    }
    default:
      throw fail();
  }
}

export function toRaw(x: StructuredAddress): RawAddress {
  switch (x.type) {
    case "AUTHORS":
      return githubEdgeAddress(
        "AUTHORS",
        ...lengthEncode(GithubNode.toRaw(x.author)),
        ...lengthEncode(GithubNode.toRaw(x.content))
      );
    case "MERGED_AS":
      return githubEdgeAddress(
        "MERGED_AS",
        ...lengthEncode(GithubNode.toRaw(x.pull))
      );
    case "HAS_PARENT":
      return githubEdgeAddress(
        "HAS_PARENT",
        ...lengthEncode(GithubNode.toRaw(x.child))
      );
    case "REFERENCES":
      return githubEdgeAddress(
        "REFERENCES",
        ...lengthEncode(GithubNode.toRaw(x.referrer)),
        ...lengthEncode(GithubNode.toRaw(x.referent))
      );
    default:
      // eslint-disable-next-line no-unused-expressions
      (x.type: empty);
      throw new Error(x.type);
  }
}
