// @flow

import deepFreeze from "deep-freeze";
import {
  type Edge,
  type EdgeAddressT,
  EdgeAddress,
  NodeAddress,
} from "../../core/graph";
import * as GithubNode from "./nodes";
import * as GitNode from "../git/nodes";
import {
  type ReactionContent,
  ReactionContent$Values as Reactions,
} from "./graphqlTypes";
import {type TimestampMs} from "../../util/timestamp";

export opaque type RawAddress: EdgeAddressT = EdgeAddressT;

export const AUTHORS_TYPE = "AUTHORS";
export const MERGED_AS_TYPE = "MERGED_AS";
export const HAS_PARENT_TYPE = "HAS_PARENT";
export const REFERENCES_TYPE = "REFERENCES";
export const REACTS_TYPE = "REACTS";
// GitHub tracks its own notion of a commit, which has a particular
// database id, is scoped to a particular repository, and has a canonical url
// on GitHub. The CORRESPONDS_TO_COMMIT_TYPE edges connect the GitHub commits
// to the corresponding Git commit.
export const CORRESPONDS_TO_COMMIT_TYPE = "CORRESPONDS_TO_COMMIT_TYPE";

const GITHUB_PREFIX = EdgeAddress.fromParts(["sourcecred", "github"]);
function githubEdgeAddress(...parts: string[]): RawAddress {
  return EdgeAddress.append(GITHUB_PREFIX, ...parts);
}

export const Prefix: {|
  authors: RawAddress,
  base: EdgeAddressT,
  correspondsToCommit: RawAddress,
  hasParent: RawAddress,
  mergedAs: RawAddress,
  reacts: RawAddress,
  reactsHeart: RawAddress,
  reactsHooray: RawAddress,
  reactsRocket: RawAddress,
  reactsThumbsUp: RawAddress,
  references: RawAddress,
|} = deepFreeze({
  base: GITHUB_PREFIX,
  authors: githubEdgeAddress(AUTHORS_TYPE),
  mergedAs: githubEdgeAddress(MERGED_AS_TYPE),
  references: githubEdgeAddress(REFERENCES_TYPE),
  hasParent: githubEdgeAddress(HAS_PARENT_TYPE),
  reacts: githubEdgeAddress(REACTS_TYPE),
  reactsThumbsUp: githubEdgeAddress(REACTS_TYPE, Reactions.THUMBS_UP),
  reactsHeart: githubEdgeAddress(REACTS_TYPE, Reactions.HEART),
  reactsHooray: githubEdgeAddress(REACTS_TYPE, Reactions.HOORAY),
  reactsRocket: githubEdgeAddress(REACTS_TYPE, Reactions.ROCKET),
  correspondsToCommit: githubEdgeAddress(CORRESPONDS_TO_COMMIT_TYPE),
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
export type ReactsAddress = {|
  +type: typeof REACTS_TYPE,
  +reactionType: ReactionContent,
  +user: GithubNode.UserlikeAddress,
  +reactable: GithubNode.ReactableAddress,
|};
export type CorrespondsToCommitAddress = {|
  +type: typeof CORRESPONDS_TO_COMMIT_TYPE,
  +githubCommit: GithubNode.CommitAddress,
|};

export type StructuredAddress =
  | AuthorsAddress
  | MergedAsAddress
  | HasParentAddress
  | ReferencesAddress
  | ReactsAddress
  | CorrespondsToCommitAddress;

export const createEdge: {|
  authors: (
    author: GithubNode.UserlikeAddress,
    content: GithubNode.AuthorableAddress,
    timestampMs: TimestampMs
  ) => Edge,
  correspondsToCommit: (
    githubCommit: GithubNode.CommitAddress,
    gitCommit: GitNode.CommitAddress,
    timestampMs: TimestampMs
  ) => Edge,
  hasParent: (
    child: GithubNode.ChildAddress,
    parent: GithubNode.ParentAddress,
    timestampMs: TimestampMs
  ) => Edge,
  mergedAs: (
    pull: GithubNode.PullAddress,
    commit: GithubNode.CommitAddress,
    timestampMs: TimestampMs
  ) => Edge,
  reacts: (
    reactionType: ReactionContent,
    user: GithubNode.UserlikeAddress,
    reactable: GithubNode.ReactableAddress,
    timestampMs: TimestampMs
  ) => Edge,
  references: (
    referrer: GithubNode.TextContentAddress,
    referent: GithubNode.ReferentAddress,
    timestampMs: TimestampMs
  ) => Edge,
|} = deepFreeze({
  authors: (
    author: GithubNode.UserlikeAddress,
    content: GithubNode.AuthorableAddress,
    timestampMs: TimestampMs
  ): Edge => ({
    address: toRaw({type: AUTHORS_TYPE, author, content}),
    src: GithubNode.toRaw(author),
    dst: GithubNode.toRaw(content),
    timestampMs,
  }),
  mergedAs: (
    pull: GithubNode.PullAddress,
    commit: GithubNode.CommitAddress,
    timestampMs: TimestampMs
  ): Edge => ({
    address: toRaw({type: MERGED_AS_TYPE, pull}),
    src: GithubNode.toRaw(pull),
    dst: GithubNode.toRaw(commit),
    timestampMs,
  }),
  correspondsToCommit: (
    githubCommit: GithubNode.CommitAddress,
    gitCommit: GitNode.CommitAddress,
    timestampMs: TimestampMs
  ): Edge => ({
    address: toRaw({type: CORRESPONDS_TO_COMMIT_TYPE, githubCommit}),
    src: GithubNode.toRaw(githubCommit),
    dst: GitNode.toRaw(gitCommit),
    timestampMs,
  }),
  hasParent: (
    child: GithubNode.ChildAddress,
    parent: GithubNode.ParentAddress,
    timestampMs: TimestampMs
  ): Edge => ({
    address: toRaw({type: HAS_PARENT_TYPE, child}),
    src: GithubNode.toRaw(child),
    dst: GithubNode.toRaw(parent),
    timestampMs,
  }),
  references: (
    referrer: GithubNode.TextContentAddress,
    referent: GithubNode.ReferentAddress,
    timestampMs: TimestampMs
  ): Edge => ({
    address: toRaw({type: REFERENCES_TYPE, referrer, referent}),
    src: GithubNode.toRaw(referrer),
    dst: GithubNode.toRaw(referent),
    timestampMs,
  }),
  reacts: (
    reactionType: ReactionContent,
    user: GithubNode.UserlikeAddress,
    reactable: GithubNode.ReactableAddress,
    timestampMs: TimestampMs
  ): Edge => ({
    address: toRaw({
      type: REACTS_TYPE,
      user,
      reactionType,
      reactable,
    }),
    src: GithubNode.toRaw(user),
    dst: GithubNode.toRaw(reactable),
    timestampMs,
  }),
});

function lengthEncode(x: GithubNode.RawAddress): $ReadOnlyArray<string> {
  const parts = NodeAddress.toParts(x);
  return [String(parts.length), ...parts];
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
        (NodeAddress.fromParts(authorParts): any)
      ): any);
      const content: GithubNode.AuthorableAddress = (GithubNode.fromRaw(
        (NodeAddress.fromParts(contentParts): any)
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
        (NodeAddress.fromParts(pullParts): any)
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
        (NodeAddress.fromParts(childParts): any)
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
        (NodeAddress.fromParts(referrerParts): any)
      ): any);
      const referent: GithubNode.ReferentAddress = (GithubNode.fromRaw(
        (NodeAddress.fromParts(referentParts): any)
      ): any);
      return ({type: REFERENCES_TYPE, referrer, referent}: ReferencesAddress);
    }
    case REACTS_TYPE: {
      const [rawReactionType, ...rest2] = rest;
      const reactionType = Reactions[rawReactionType];
      if (reactionType == null) {
        throw fail();
      }
      const parts = multiLengthDecode(rest2, fail);
      if (parts.length !== 2) {
        throw fail();
      }
      const [userParts, reactableParts] = parts;
      const user: GithubNode.UserlikeAddress = (GithubNode.fromRaw(
        (NodeAddress.fromParts(userParts): any)
      ): any);
      const reactable: GithubNode.ReactableAddress = (GithubNode.fromRaw(
        (NodeAddress.fromParts(reactableParts): any)
      ): any);
      return {type: REACTS_TYPE, reactionType, user, reactable};
    }
    default:
      throw fail();
  }
}

export function toRaw(x: StructuredAddress): RawAddress {
  switch (x.type) {
    case AUTHORS_TYPE:
      return EdgeAddress.append(
        Prefix.authors,
        ...lengthEncode(GithubNode.toRaw(x.author)),
        ...lengthEncode(GithubNode.toRaw(x.content))
      );
    case MERGED_AS_TYPE:
      return EdgeAddress.append(
        Prefix.mergedAs,
        ...lengthEncode(GithubNode.toRaw(x.pull))
      );
    case HAS_PARENT_TYPE:
      return EdgeAddress.append(
        Prefix.hasParent,
        ...lengthEncode(GithubNode.toRaw(x.child))
      );
    case REFERENCES_TYPE:
      return EdgeAddress.append(
        Prefix.references,
        ...lengthEncode(GithubNode.toRaw(x.referrer)),
        ...lengthEncode(GithubNode.toRaw(x.referent))
      );
    case REACTS_TYPE:
      return EdgeAddress.append(
        Prefix.reacts,
        x.reactionType,
        ...lengthEncode(GithubNode.toRaw(x.user)),
        ...lengthEncode(GithubNode.toRaw(x.reactable))
      );
    case CORRESPONDS_TO_COMMIT_TYPE:
      return EdgeAddress.append(
        Prefix.correspondsToCommit,
        ...lengthEncode(GithubNode.toRaw(x.githubCommit))
      );
    default:
      throw new Error((x.type: empty));
  }
}
