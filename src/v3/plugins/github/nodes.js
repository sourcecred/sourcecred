// @flow

import {NodeAddress, type NodeAddressT} from "../../core/graph";

export opaque type RawAddress: NodeAddressT = NodeAddressT;

const GITHUB_PREFIX = NodeAddress.fromParts(["sourcecred", "github"]);
function githubAddress(...parts: string[]): RawAddress {
  return NodeAddress.append(GITHUB_PREFIX, ...parts);
}

export type RepoAddress = {|
  +type: "REPO",
  +owner: string,
  +name: string,
|};
export type IssueAddress = {|
  +type: "ISSUE",
  +repo: RepoAddress,
  +number: string,
|};
export type PullAddress = {|
  +type: "PULL",
  +repo: RepoAddress,
  +number: string,
|};
export type ReviewAddress = {|
  +type: "REVIEW",
  +pull: PullAddress,
  +fragment: string,
|};
export type CommentAddress = {|
  +type: "COMMENT",
  +parent: IssueAddress | PullAddress | ReviewAddress,
  +fragment: string,
|};
export type UserlikeAddress = {|
  +type: "USERLIKE",
  +login: string,
|};

export type StructuredAddress =
  | RepoAddress
  | IssueAddress
  | PullAddress
  | ReviewAddress
  | CommentAddress
  | UserlikeAddress;

export function fromRaw(x: RawAddress): StructuredAddress {
  function fail() {
    return new Error(`Bad address: ${NodeAddress.toString(x)}`);
  }
  if (!NodeAddress.hasPrefix(x, GITHUB_PREFIX)) {
    throw fail();
  }
  const [_unused_sc, _unused_gh, kind, ...rest] = NodeAddress.toParts(x);
  switch (kind) {
    case "repo": {
      if (rest.length !== 2) {
        throw fail();
      }
      const [owner, name] = rest;
      return {type: "REPO", owner, name};
    }
    case "issue": {
      if (rest.length !== 3) {
        throw fail();
      }
      const [owner, name, number] = rest;
      const repo = {type: "REPO", owner, name};
      return {type: "ISSUE", repo, number};
    }
    case "pull": {
      if (rest.length !== 3) {
        throw fail();
      }
      const [owner, name, number] = rest;
      const repo = {type: "REPO", owner, name};
      return {type: "PULL", repo, number};
    }
    case "review": {
      if (rest.length !== 4) {
        throw fail();
      }
      const [owner, name, pullNumber, fragment] = rest;
      const repo = {type: "REPO", owner, name};
      const pull = {type: "PULL", repo, number: pullNumber};
      return {type: "REVIEW", pull, fragment};
    }
    case "comment": {
      if (rest.length < 1) {
        throw fail();
      }
      const [subkind, ...subrest] = rest;
      switch (subkind) {
        case "issue": {
          if (subrest.length !== 4) {
            throw fail();
          }
          const [owner, name, issueNumber, fragment] = subrest;
          const repo = {type: "REPO", owner, name};
          const issue = {type: "ISSUE", repo, number: issueNumber};
          return {type: "COMMENT", parent: issue, fragment};
        }
        case "pull": {
          if (subrest.length !== 4) {
            throw fail();
          }
          const [owner, name, pullNumber, fragment] = subrest;
          const repo = {type: "REPO", owner, name};
          const pull = {type: "PULL", repo, number: pullNumber};
          return {type: "COMMENT", parent: pull, fragment};
        }
        case "review": {
          if (subrest.length !== 5) {
            throw fail();
          }
          const [owner, name, pullNumber, reviewFragment, fragment] = subrest;
          const repo = {type: "REPO", owner, name};
          const pull = {type: "PULL", repo, number: pullNumber};
          const review = {type: "REVIEW", pull, fragment: reviewFragment};
          return {type: "COMMENT", parent: review, fragment};
        }
        default:
          throw fail();
      }
    }
    case "userlike": {
      if (rest.length !== 1) {
        throw fail();
      }
      const [login] = rest;
      return {type: "USERLIKE", login};
    }
    default:
      throw fail();
  }
}

export function toRaw(x: StructuredAddress): RawAddress {
  switch (x.type) {
    case "REPO":
      return githubAddress("repo", x.owner, x.name);
    case "ISSUE":
      return githubAddress("issue", x.repo.owner, x.repo.name, x.number);
    case "PULL":
      return githubAddress("pull", x.repo.owner, x.repo.name, x.number);
    case "REVIEW":
      return githubAddress(
        "review",
        x.pull.repo.owner,
        x.pull.repo.name,
        x.pull.number,
        x.fragment
      );
    case "COMMENT":
      switch (x.parent.type) {
        case "ISSUE":
          return githubAddress(
            "comment",
            "issue",
            x.parent.repo.owner,
            x.parent.repo.name,
            x.parent.number,
            x.fragment
          );
        case "PULL":
          return githubAddress(
            "comment",
            "pull",
            x.parent.repo.owner,
            x.parent.repo.name,
            x.parent.number,
            x.fragment
          );
        case "REVIEW":
          return githubAddress(
            "comment",
            "review",
            x.parent.pull.repo.owner,
            x.parent.pull.repo.name,
            x.parent.pull.number,
            x.parent.fragment,
            x.fragment
          );
        default:
          // eslint-disable-next-line no-unused-expressions
          (x.parent.type: empty);
          throw new Error(`Bad comment parent type: ${x.parent.type}`);
      }
    case "USERLIKE":
      return githubAddress("userlike", x.login);
    default:
      // eslint-disable-next-line no-unused-expressions
      (x.type: empty);
      throw new Error(`Unexpected type ${x.type}`);
  }
}
