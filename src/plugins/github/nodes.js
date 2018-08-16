// @flow

import {NodeAddress, type NodeAddressT} from "../../core/graph";

export opaque type RawAddress: NodeAddressT = NodeAddressT;

const GITHUB_PREFIX = NodeAddress.fromParts(["sourcecred", "github"]);
export function _githubAddress(...parts: string[]): RawAddress {
  return NodeAddress.append(GITHUB_PREFIX, ...parts);
}

export const REPO_TYPE: "REPO" = "REPO";
export const ISSUE_TYPE: "ISSUE" = "ISSUE";
export const PULL_TYPE: "PULL" = "PULL";
export const REVIEW_TYPE: "REVIEW" = "REVIEW";
export const COMMENT_TYPE: "COMMENT" = "COMMENT";
export const USERLIKE_TYPE: "USERLIKE" = "USERLIKE";

export const _Prefix = Object.freeze({
  base: GITHUB_PREFIX,
  repo: _githubAddress(REPO_TYPE),
  issue: _githubAddress(ISSUE_TYPE),
  pull: _githubAddress(PULL_TYPE),
  review: _githubAddress(REVIEW_TYPE),
  comment: _githubAddress(COMMENT_TYPE),
  userlike: _githubAddress(USERLIKE_TYPE),
  reviewComment: _githubAddress(COMMENT_TYPE, REVIEW_TYPE),
  issueComment: _githubAddress(COMMENT_TYPE, ISSUE_TYPE),
  pullComment: _githubAddress(COMMENT_TYPE, PULL_TYPE),
});

export type RepoAddress = {|
  +type: typeof REPO_TYPE,
  +owner: string,
  +name: string,
|};
export type IssueAddress = {|
  +type: typeof ISSUE_TYPE,
  +repo: RepoAddress,
  +number: string,
|};
export type PullAddress = {|
  +type: typeof PULL_TYPE,
  +repo: RepoAddress,
  +number: string,
|};
export type ReviewAddress = {|
  +type: typeof REVIEW_TYPE,
  +pull: PullAddress,
  +id: string,
|};
export type CommentAddress = {|
  +type: typeof COMMENT_TYPE,
  +parent: CommentableAddress,
  +id: string,
|};
export type UserlikeAddress = {|
  +type: typeof USERLIKE_TYPE,
  +login: string,
|};

export type StructuredAddress =
  | RepoAddress
  | IssueAddress
  | PullAddress
  | ReviewAddress
  | CommentAddress
  | UserlikeAddress;

// Each of these types has 0 or more "AUTHORS" edges, each of which
// leads to a UserlikeAddress.  Note: It is not true that every
// Authorable has at least one author, as when GitHub accounts are
// deleted, they leave behind posts without authors.
export type AuthorableAddress =
  | IssueAddress
  | PullAddress
  | ReviewAddress
  | CommentAddress;

// Each of these types has text content, which means
// it may be the source of a reference to a ReferentAddress.
export type TextContentAddress =
  | IssueAddress
  | PullAddress
  | ReviewAddress
  | CommentAddress;

// Each of these types may be referred to by something
// with text content.
export type ReferentAddress =
  | RepoAddress
  | IssueAddress
  | PullAddress
  | ReviewAddress
  | CommentAddress
  | UserlikeAddress;

// Each of these types is structurally the child of some
// entity with a ParentAddress.
export type ChildAddress =
  | IssueAddress // child of RepoAddress
  | PullAddress // child of RepoAddress
  | ReviewAddress // child of PullAddress
  | CommentAddress; // child of IssueAddress, PullAddress, or ReviewAddress

// Each of these types may have child nodes (see ChildAddress).
export type ParentAddress =
  | RepoAddress
  | IssueAddress
  | PullAddress
  | ReviewAddress;

// Each of these types may have Comments as children
export type CommentableAddress = IssueAddress | PullAddress | ReviewAddress;

// Verify that Commentable is a subtype of Parent
const _unused_static = (_: CommentableAddress): ParentAddress => _;

export function fromRaw(x: RawAddress): StructuredAddress {
  function fail() {
    return new Error(`Bad address: ${NodeAddress.toString(x)}`);
  }
  if (!NodeAddress.hasPrefix(x, GITHUB_PREFIX)) {
    throw fail();
  }
  const [_unused_sc, _unused_gh, kind, ...rest] = NodeAddress.toParts(x);
  switch (kind) {
    case REPO_TYPE: {
      if (rest.length !== 2) {
        throw fail();
      }
      const [owner, name] = rest;
      return {type: REPO_TYPE, owner, name};
    }
    case ISSUE_TYPE: {
      if (rest.length !== 3) {
        throw fail();
      }
      const [owner, name, number] = rest;
      const repo = {type: REPO_TYPE, owner, name};
      return {type: ISSUE_TYPE, repo, number};
    }
    case PULL_TYPE: {
      if (rest.length !== 3) {
        throw fail();
      }
      const [owner, name, number] = rest;
      const repo = {type: REPO_TYPE, owner, name};
      return {type: PULL_TYPE, repo, number};
    }
    case REVIEW_TYPE: {
      if (rest.length !== 4) {
        throw fail();
      }
      const [owner, name, pullNumber, id] = rest;
      const repo = {type: REPO_TYPE, owner, name};
      const pull = {type: PULL_TYPE, repo, number: pullNumber};
      return {type: REVIEW_TYPE, pull, id};
    }
    case COMMENT_TYPE: {
      if (rest.length < 1) {
        throw fail();
      }
      const [subkind, ...subrest] = rest;
      switch (subkind) {
        case ISSUE_TYPE: {
          if (subrest.length !== 4) {
            throw fail();
          }
          const [owner, name, issueNumber, id] = subrest;
          const repo = {type: REPO_TYPE, owner, name};
          const issue = {type: ISSUE_TYPE, repo, number: issueNumber};
          return {type: COMMENT_TYPE, parent: issue, id};
        }
        case PULL_TYPE: {
          if (subrest.length !== 4) {
            throw fail();
          }
          const [owner, name, pullNumber, id] = subrest;
          const repo = {type: REPO_TYPE, owner, name};
          const pull = {type: PULL_TYPE, repo, number: pullNumber};
          return {type: COMMENT_TYPE, parent: pull, id};
        }
        case REVIEW_TYPE: {
          if (subrest.length !== 5) {
            throw fail();
          }
          const [owner, name, pullNumber, reviewFragment, id] = subrest;
          const repo = {type: REPO_TYPE, owner, name};
          const pull = {type: PULL_TYPE, repo, number: pullNumber};
          const review = {type: REVIEW_TYPE, pull, id: reviewFragment};
          return {type: COMMENT_TYPE, parent: review, id};
        }
        default:
          throw fail();
      }
    }
    case USERLIKE_TYPE: {
      if (rest.length !== 1) {
        throw fail();
      }
      const [login] = rest;
      return {type: USERLIKE_TYPE, login};
    }
    default:
      throw fail();
  }
}

export function toRaw(x: StructuredAddress): RawAddress {
  switch (x.type) {
    case REPO_TYPE:
      return NodeAddress.append(_Prefix.repo, x.owner, x.name);
    case ISSUE_TYPE:
      return NodeAddress.append(
        _Prefix.issue,
        x.repo.owner,
        x.repo.name,
        x.number
      );
    case PULL_TYPE:
      return NodeAddress.append(
        _Prefix.pull,
        x.repo.owner,
        x.repo.name,
        x.number
      );
    case REVIEW_TYPE:
      return NodeAddress.append(
        _Prefix.review,
        x.pull.repo.owner,
        x.pull.repo.name,
        x.pull.number,
        x.id
      );
    case COMMENT_TYPE:
      switch (x.parent.type) {
        case ISSUE_TYPE:
          return NodeAddress.append(
            _Prefix.issueComment,
            x.parent.repo.owner,
            x.parent.repo.name,
            x.parent.number,
            x.id
          );
        case PULL_TYPE:
          return NodeAddress.append(
            _Prefix.pullComment,
            x.parent.repo.owner,
            x.parent.repo.name,
            x.parent.number,
            x.id
          );
        case REVIEW_TYPE:
          return NodeAddress.append(
            _Prefix.reviewComment,
            x.parent.pull.repo.owner,
            x.parent.pull.repo.name,
            x.parent.pull.number,
            x.parent.id,
            x.id
          );
        default:
          throw new Error(`Bad comment parent type: ${(x.parent.type: empty)}`);
      }
    case USERLIKE_TYPE:
      return NodeAddress.append(_Prefix.userlike, x.login);
    default:
      throw new Error(`Unexpected type ${(x.type: empty)}`);
  }
}
