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
  +type: typeof N.REPO_TYPE,
  +address: N.RepoAddress,
  +url: string,
  +issues: IssueEntry[],
  +pulls: PullEntry[],
|};

export type IssueEntry = {|
  +type: typeof N.ISSUE_TYPE,
  +address: N.IssueAddress,
  +title: string,
  +body: string,
  +url: string,
  +comments: CommentEntry[],
  +nominalAuthor: ?UserlikeEntry,
|};

export type PullEntry = {|
  +type: typeof N.PULL_TYPE,
  +address: N.PullAddress,
  +title: string,
  +body: string,
  +url: string,
  +comments: CommentEntry[],
  +reviews: ReviewEntry[],
  +mergedAs: ?GitNode.CommitAddress,
  +nominalAuthor: ?UserlikeEntry,
|};

export type ReviewEntry = {|
  +type: typeof N.REVIEW_TYPE,
  +address: N.ReviewAddress,
  +body: string,
  +url: string,
  +comments: CommentEntry[],
  +state: Q.ReviewState,
  +nominalAuthor: ?UserlikeEntry,
|};

export type CommentEntry = {|
  +type: typeof N.COMMENT_TYPE,
  +address: N.CommentAddress,
  +body: string,
  +url: string,
  +nominalAuthor: ?UserlikeEntry,
|};

export type UserlikeEntry = {|
  +type: typeof N.USERLIKE_TYPE,
  +address: N.UserlikeAddress,
  +url: string,
|};

export type Entry =
  | RepoEntry
  | IssueEntry
  | PullEntry
  | ReviewEntry
  | CommentEntry
  | UserlikeEntry;

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

  issues(): Iterator<IssueEntry> {
    return this._issues.values();
  }
  issue(address: N.IssueAddress): ?IssueEntry {
    return this._issues.get(N.toRaw(address));
  }

  pulls(): Iterator<PullEntry> {
    return this._pulls.values();
  }
  pull(address: N.PullAddress): ?PullEntry {
    return this._pulls.get(N.toRaw(address));
  }

  comments(): Iterator<CommentEntry> {
    return this._comments.values();
  }
  comment(address: N.CommentAddress): ?CommentEntry {
    return this._comments.get(N.toRaw(address));
  }

  reviews(): Iterator<ReviewEntry> {
    return this._reviews.values();
  }
  review(address: N.ReviewAddress): ?ReviewEntry {
    return this._reviews.get(N.toRaw(address));
  }

  userlikes(): Iterator<UserlikeEntry> {
    return this._userlikes.values();
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
      type: N.REPO_TYPE,
    };
    const raw = N.toRaw(address);
    this._repos.set(raw, entry);
  }

  _addIssue(repo: N.RepoAddress, json: Q.IssueJSON): IssueEntry {
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
      type: N.ISSUE_TYPE,
    };
    this._issues.set(N.toRaw(address), entry);
    return entry;
  }

  _addPull(repo: N.RepoAddress, json: Q.PullJSON): PullEntry {
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
      type: N.PULL_TYPE,
    };
    this._pulls.set(N.toRaw(address), entry);
    return entry;
  }

  _addReview(pull: N.PullAddress, json: Q.ReviewJSON): ReviewEntry {
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
      type: N.REVIEW_TYPE,
    };
    this._reviews.set(N.toRaw(address), entry);
    return entry;
  }

  _addComment(
    parent: N.IssueAddress | N.PullAddress | N.ReviewAddress,
    json: Q.CommentJSON
  ): CommentEntry {
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
      type: N.COMMENT_TYPE,
    };
    this._comments.set(N.toRaw(address), entry);
    return entry;
  }

  _addNullableAuthor(json: Q.NullableAuthorJSON): ?UserlikeEntry {
    if (json == null) {
      return null;
    } else {
      const address: N.UserlikeAddress = {
        type: N.USERLIKE_TYPE,
        login: json.login,
      };
      const entry: UserlikeEntry = {
        address,
        url: json.url,
        type: N.USERLIKE_TYPE,
      };
      this._userlikes.set(N.toRaw(address), entry);
      return entry;
    }
  }
}
