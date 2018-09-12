// @flow

import {
  type Edge,
  type EdgeAddressT,
  EdgeAddress,
  NodeAddress,
} from "../../core/graph";
import * as GithubNode from "./nodes";
import * as GitNode from "../git/nodes";
import type {MentionsAuthorReference} from "./heuristics/mentionsAuthorReference";

export opaque type RawAddress: EdgeAddressT = EdgeAddressT;

export const AUTHORS_TYPE = "AUTHORS";
export const MERGED_AS_TYPE = "MERGED_AS";
export const HAS_PARENT_TYPE = "HAS_PARENT";
export const REFERENCES_TYPE = "REFERENCES";
export const MENTIONS_AUTHOR_TYPE = "MENTIONS_AUTHOR";

const GITHUB_PREFIX = EdgeAddress.fromParts(["sourcecred", "github"]);
function githubEdgeAddress(...parts: string[]): RawAddress {
  return EdgeAddress.append(GITHUB_PREFIX, ...parts);
}

export const _Prefix = Object.freeze({
  base: GITHUB_PREFIX,
  authors: githubEdgeAddress(AUTHORS_TYPE),
  mergedAs: githubEdgeAddress(MERGED_AS_TYPE),
  references: githubEdgeAddress(REFERENCES_TYPE),
  hasParent: githubEdgeAddress(HAS_PARENT_TYPE),
  mentionsAuthor: githubEdgeAddress(MENTIONS_AUTHOR_TYPE),
});

export type AuthorsAddress = {|
  +type: typeof AUTHORS_TYPE,
  +author: GithubNode.UserlikeAddress,
  +content: GithubNode.AuthorableAddress,
|};
export type MergedAsAddress = {|
  +type: typeof MERGED_AS_TYPE,
  +pull: GithubNode.PullAddress,
|};
export type HasParentAddress = {|
  +type: typeof HAS_PARENT_TYPE,
  +child: GithubNode.ChildAddress,
|};
export type ReferencesAddress = {|
  +type: typeof REFERENCES_TYPE,
  +referrer: GithubNode.TextContentAddress,
  +referent: GithubNode.ReferentAddress,
|};
export type MentionsAuthorAddress = {|
  +type: typeof MENTIONS_AUTHOR_TYPE,
  +reference: MentionsAuthorReference,
|};

export type StructuredAddress =
  | AuthorsAddress
  | MergedAsAddress
  | HasParentAddress
  | ReferencesAddress
  | MentionsAuthorAddress;

export const createEdge = Object.freeze({
  authors: (
    author: GithubNode.UserlikeAddress,
    content: GithubNode.AuthorableAddress
  ): Edge => ({
    address: toRaw({type: AUTHORS_TYPE, author, content}),
    src: GithubNode.toRaw(author),
    dst: GithubNode.toRaw(content),
  }),
  mergedAs: (
    pull: GithubNode.PullAddress,
    commit: GitNode.CommitAddress
  ): Edge => ({
    address: toRaw({type: MERGED_AS_TYPE, pull}),
    src: GithubNode.toRaw(pull),
    dst: GitNode.toRaw(commit),
  }),
  hasParent: (
    child: GithubNode.ChildAddress,
    parent: GithubNode.ParentAddress
  ): Edge => ({
    address: toRaw({type: HAS_PARENT_TYPE, child}),
    src: GithubNode.toRaw(child),
    dst: GithubNode.toRaw(parent),
  }),
  references: (
    referrer: GithubNode.TextContentAddress,
    referent: GithubNode.ReferentAddress
  ): Edge => ({
    address: toRaw({type: REFERENCES_TYPE, referrer, referent}),
    src: GithubNode.toRaw(referrer),
    dst: GithubNode.toRaw(referent),
  }),
  mentionsAuthor: (reference: MentionsAuthorReference): Edge => ({
    address: toRaw({type: MENTIONS_AUTHOR_TYPE, reference}),
    src: GithubNode.toRaw(reference.src),
    dst: GithubNode.toRaw(reference.dst),
  }),
});

const NODE_PREFIX_LENGTH = NodeAddress.toParts(GithubNode._githubAddress())
  .length;

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
    case AUTHORS_TYPE: {
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
      return ({type: AUTHORS_TYPE, author, content}: AuthorsAddress);
    }
    case MERGED_AS_TYPE: {
      const parts = multiLengthDecode(rest, fail);
      if (parts.length !== 1) {
        throw fail();
      }
      const [pullParts] = parts;
      const pull: GithubNode.PullAddress = (GithubNode.fromRaw(
        GithubNode._githubAddress(...pullParts)
      ): any);
      return ({type: MERGED_AS_TYPE, pull}: MergedAsAddress);
    }
    case HAS_PARENT_TYPE: {
      const parts = multiLengthDecode(rest, fail);
      if (parts.length !== 1) {
        throw fail();
      }
      const [childParts] = parts;
      const child: GithubNode.ChildAddress = (GithubNode.fromRaw(
        GithubNode._githubAddress(...childParts)
      ): any);
      return ({type: HAS_PARENT_TYPE, child}: HasParentAddress);
    }
    case REFERENCES_TYPE: {
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
      return ({type: REFERENCES_TYPE, referrer, referent}: ReferencesAddress);
    }
    case MENTIONS_AUTHOR_TYPE: {
      const parts = multiLengthDecode(rest, fail);
      if (parts.length !== 3) {
        throw fail();
      }
      const [srcParts, dstParts, whoParts] = parts;
      const src: GithubNode.TextContentAddress = (GithubNode.fromRaw(
        GithubNode._githubAddress(...srcParts)
      ): any);
      const dst: GithubNode.TextContentAddress = (GithubNode.fromRaw(
        GithubNode._githubAddress(...dstParts)
      ): any);
      const who: GithubNode.UserlikeAddress = (GithubNode.fromRaw(
        GithubNode._githubAddress(...whoParts)
      ): any);
      const reference = {src, dst, who};
      return {type: MENTIONS_AUTHOR_TYPE, reference};
    }
    default:
      throw fail();
  }
}

export function toRaw(x: StructuredAddress): RawAddress {
  switch (x.type) {
    case AUTHORS_TYPE:
      return EdgeAddress.append(
        _Prefix.authors,
        ...lengthEncode(GithubNode.toRaw(x.author)),
        ...lengthEncode(GithubNode.toRaw(x.content))
      );
    case MERGED_AS_TYPE:
      return EdgeAddress.append(
        _Prefix.mergedAs,
        ...lengthEncode(GithubNode.toRaw(x.pull))
      );
    case HAS_PARENT_TYPE:
      return EdgeAddress.append(
        _Prefix.hasParent,
        ...lengthEncode(GithubNode.toRaw(x.child))
      );
    case REFERENCES_TYPE:
      return EdgeAddress.append(
        _Prefix.references,
        ...lengthEncode(GithubNode.toRaw(x.referrer)),
        ...lengthEncode(GithubNode.toRaw(x.referent))
      );
    case MENTIONS_AUTHOR_TYPE:
      return EdgeAddress.append(
        _Prefix.mentionsAuthor,
        ...lengthEncode(GithubNode.toRaw(x.reference.src)),
        ...lengthEncode(GithubNode.toRaw(x.reference.dst)),
        ...lengthEncode(GithubNode.toRaw(x.reference.who))
      );
    default:
      throw new Error((x.type: empty));
  }
}
