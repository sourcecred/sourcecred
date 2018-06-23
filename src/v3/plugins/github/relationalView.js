// @flow

import * as N from "./nodes";
import * as Q from "./graphql";
import * as GitNode from "../git/nodes";

import {
  reviewUrlToId,
  issueCommentUrlToId,
  pullCommentUrlToId,
  reviewCommentUrlToId,
} from "./urlIdParse";

export type RepoEntry = {|
  +address: N.RepoAddress,
  +url: string,
  +issues: N.IssueAddress[],
  +pulls: N.PullAddress[],
|};

export type IssueEntry = {|
  +address: N.IssueAddress,
  +title: string,
  +body: string,
  +url: string,
  +comments: N.CommentAddress[],
  +nominalAuthor: ?N.UserlikeAddress,
|};

export type PullEntry = {|
  +address: N.PullAddress,
  +title: string,
  +body: string,
  +url: string,
  +comments: N.CommentAddress[],
  +reviews: N.ReviewAddress[],
  +mergedAs: ?GitNode.CommitAddress,
  +nominalAuthor: ?N.UserlikeAddress,
|};

export type ReviewEntry = {|
  +address: N.ReviewAddress,
  +body: string,
  +url: string,
  +comments: N.CommentAddress[],
  +state: Q.ReviewState,
  +nominalAuthor: ?N.UserlikeAddress,
|};

export type CommentEntry = {|
  +address: N.CommentAddress,
  +body: string,
  +url: string,
  +nominalAuthor: ?N.UserlikeAddress,
|};

export type UserlikeEntry = {|
  +address: N.UserlikeAddress,
  +url: string,
|};

export class RelationalView {
  _repos: Map<N.RawAddress, RepoEntry>;
  _issues: Map<N.RawAddress, IssueEntry>;
  _pulls: Map<N.RawAddress, PullEntry>;
  _comments: Map<N.RawAddress, CommentEntry>;
  _reviews: Map<N.RawAddress, ReviewEntry>;
  _userlikes: Map<N.RawAddress, UserlikeEntry>;

  constructor(data: Q.GithubResponseJSON) {
    this._repos = new Map();
    this._issues = new Map();
    this._pulls = new Map();
    this._comments = new Map();
    this._reviews = new Map();
    this._userlikes = new Map();
    this._addRepo(data.repository);
  }

  repos(): Iterator<RepoEntry> {
    return this._repos.values();
  }

  repo(address: N.RepoAddress): ?RepoEntry {
    return this._repos.get(N.toRaw(address));
  }

  issue(address: N.IssueAddress): ?IssueEntry {
    return this._issues.get(N.toRaw(address));
  }
  pull(address: N.PullAddress): ?PullEntry {
    return this._pulls.get(N.toRaw(address));
  }
  comment(address: N.CommentAddress): ?CommentEntry {
    return this._comments.get(N.toRaw(address));
  }
  review(address: N.ReviewAddress): ?ReviewEntry {
    return this._reviews.get(N.toRaw(address));
  }
  userlike(address: N.UserlikeAddress): ?UserlikeEntry {
    return this._userlikes.get(N.toRaw(address));
  }

  _addRepo(json: Q.RepositoryJSON) {
    const address: N.RepoAddress = {
      type: N.REPO_TYPE,
      owner: json.owner.login,
      name: json.name,
    };
    const entry: RepoEntry = {
      address,
      url: json.url,
      issues: json.issues.nodes.map((x) => this._addIssue(address, x)),
      pulls: json.pulls.nodes.map((x) => this._addPull(address, x)),
    };
    const raw = N.toRaw(address);
    this._repos.set(raw, entry);
  }

  _addIssue(repo: N.RepoAddress, json: Q.IssueJSON): N.IssueAddress {
    const address: N.IssueAddress = {
      type: N.ISSUE_TYPE,
      number: String(json.number),
      repo,
    };
    const entry: IssueEntry = {
      address,
      url: json.url,
      comments: json.comments.nodes.map((x) => this._addComment(address, x)),
      nominalAuthor: this._addNullableAuthor(json.author),
      body: json.body,
      title: json.title,
    };
    this._issues.set(N.toRaw(address), entry);
    return address;
  }

  _addPull(repo: N.RepoAddress, json: Q.PullJSON): N.PullAddress {
    const address: N.PullAddress = {
      type: N.PULL_TYPE,
      number: String(json.number),
      repo,
    };
    const mergedAs =
      json.mergeCommit == null
        ? null
        : {
            type: GitNode.COMMIT_TYPE,
            hash: json.mergeCommit.oid,
          };

    const entry: PullEntry = {
      address,
      url: json.url,
      comments: json.comments.nodes.map((x) => this._addComment(address, x)),
      reviews: json.reviews.nodes.map((x) => this._addReview(address, x)),
      nominalAuthor: this._addNullableAuthor(json.author),
      body: json.body,
      title: json.title,
      mergedAs,
    };
    this._pulls.set(N.toRaw(address), entry);
    return address;
  }

  _addReview(pull: N.PullAddress, json: Q.ReviewJSON): N.ReviewAddress {
    const address: N.ReviewAddress = {
      type: N.REVIEW_TYPE,
      id: reviewUrlToId(json.url),
      pull,
    };
    const entry: ReviewEntry = {
      address,
      url: json.url,
      state: json.state,
      comments: json.comments.nodes.map((x) => this._addComment(address, x)),
      body: json.body,
      nominalAuthor: this._addNullableAuthor(json.author),
    };
    this._reviews.set(N.toRaw(address), entry);
    return address;
  }

  _addComment(
    parent: N.IssueAddress | N.PullAddress | N.ReviewAddress,
    json: Q.CommentJSON
  ): N.CommentAddress {
    const id = (function() {
      switch (parent.type) {
        case N.ISSUE_TYPE:
          return issueCommentUrlToId(json.url);
        case N.PULL_TYPE:
          return pullCommentUrlToId(json.url);
        case N.REVIEW_TYPE:
          return reviewCommentUrlToId(json.url);
        default:
          // eslint-disable-next-line no-unused-expressions
          (parent.type: empty);
          throw new Error(`Unexpected comment parent type: ${parent.type}`);
      }
    })();
    const address: N.CommentAddress = {type: N.COMMENT_TYPE, id, parent};
    const entry: CommentEntry = {
      address,
      url: json.url,
      nominalAuthor: this._addNullableAuthor(json.author),
      body: json.body,
    };
    this._comments.set(N.toRaw(address), entry);
    return address;
  }

  _addNullableAuthor(json: Q.NullableAuthorJSON): ?N.UserlikeAddress {
    if (json == null) {
      return null;
    } else {
      const address: N.UserlikeAddress = {
        type: N.USERLIKE_TYPE,
        login: json.login,
      };
      const entry: UserlikeEntry = {address, url: json.url};
      this._userlikes.set(N.toRaw(address), entry);
      return address;
    }
  }
}
