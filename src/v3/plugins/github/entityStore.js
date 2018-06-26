// @flow

import * as N from "./nodes";
import * as A from "./addressify";
import * as Q from "./graphql";

export type Repo = {|
  +type: typeof N.REPO_TYPE,
  +address: N.RepoAddress,
  +url: string,
|};

export type Issue = {|
  +type: typeof N.ISSUE_TYPE,
  +address: N.IssueAddress,
  +title: string,
  +body: string,
  +url: string,
|};

export type Pull = {|
  +type: typeof N.PULL_TYPE,
  +address: N.PullAddress,
  +title: string,
  +body: string,
  +url: string,
|};

export type Review = {|
  +type: typeof N.REVIEW_TYPE,
  +address: N.ReviewAddress,
  +body: string,
  +url: string,
  +state: Q.ReviewState,
|};

export type Comment = {|
  +type: typeof N.COMMENT_TYPE,
  +address: N.CommentAddress,
  +body: string,
  +url: string,
|};

export type Userlike = {|
  +type: typeof N.USERLIKE_TYPE,
  +address: N.UserlikeAddress,
  +url: string,
|};

export type Entity = Repo | Issue | Pull | Review | Comment | Userlike;

export class EntityStore {
  _repos: Map<N.RawAddress, Repo>;
  _issues: Map<N.RawAddress, Issue>;
  _pulls: Map<N.RawAddress, Pull>;
  _comments: Map<N.RawAddress, Comment>;
  _reviews: Map<N.RawAddress, Review>;
  _userlikes: Map<N.RawAddress, Userlike>;

  constructor(data: A.DataAddressed) {
    this._repos = new Map();
    this._issues = new Map();
    this._pulls = new Map();
    this._comments = new Map();
    this._reviews = new Map();
    this._userlikes = new Map();
    data.repos.forEach((r) => this._addRepo(r));
  }

  repos(): Iterator<Repo> {
    return this._repos.values();
  }
  repo(address: N.RepoAddress): ?Repo {
    return this._repos.get(N.toRaw(address));
  }

  issues(): Iterator<Issue> {
    return this._issues.values();
  }
  issue(address: N.IssueAddress): ?Issue {
    return this._issues.get(N.toRaw(address));
  }

  pulls(): Iterator<Pull> {
    return this._pulls.values();
  }
  pull(address: N.PullAddress): ?Pull {
    return this._pulls.get(N.toRaw(address));
  }

  comments(): Iterator<Comment> {
    return this._comments.values();
  }
  comment(address: N.CommentAddress): ?Comment {
    return this._comments.get(N.toRaw(address));
  }

  reviews(): Iterator<Review> {
    return this._reviews.values();
  }
  review(address: N.ReviewAddress): ?Review {
    return this._reviews.get(N.toRaw(address));
  }

  userlikes(): Iterator<Userlike> {
    return this._userlikes.values();
  }
  userlike(address: N.UserlikeAddress): ?Userlike {
    return this._userlikes.get(N.toRaw(address));
  }

  _addRepo(repo: A.RepoAddressed) {
    const entry: Repo = {
      type: repo.type,
      url: repo.url,
      address: repo.address,
    };
    this._repos.set(N.toRaw(repo.address), entry);
    repo.issues.forEach((x) => this._addIssue(x));
    repo.pulls.forEach((x) => this._addPull(x));
  }

  _addIssue(issue: A.IssueAddressed) {
    const entry: Issue = {
      type: issue.type,
      url: issue.url,
      address: issue.address,
      body: issue.body,
      title: issue.title,
    };
    this._issues.set(N.toRaw(issue.address), entry);
    issue.comments.forEach((x) => this._addComment(x));
    this._addNullableAuthor(issue.nominalAuthor);
  }

  _addPull(pull: A.PullAddressed) {
    const entry: Pull = {
      type: pull.type,
      url: pull.url,
      address: pull.address,
      body: pull.body,
      title: pull.title,
    };
    this._pulls.set(N.toRaw(pull.address), entry);
    pull.reviews.forEach((x) => this._addReview(x));
    pull.comments.forEach((x) => this._addComment(x));
    this._addNullableAuthor(pull.nominalAuthor);
  }

  _addReview(review: A.ReviewAddressed) {
    const entry: Review = {
      type: review.type,
      url: review.url,
      address: review.address,
      body: review.body,
      state: review.state,
    };
    this._reviews.set(N.toRaw(review.address), entry);
    review.comments.forEach((x) => this._addComment(x));
    this._addNullableAuthor(review.nominalAuthor);
  }

  _addComment(comment: A.CommentAddressed) {
    const entry: Comment = {
      type: comment.type,
      url: comment.url,
      address: comment.address,
      body: comment.body,
    };
    this._comments.set(N.toRaw(comment.address), entry);
    this._addNullableAuthor(comment.nominalAuthor);
  }

  _addNullableAuthor(author: ?A.UserlikeAddressed) {
    if (author == null) {
      return;
    }
    this._userlikes.set(N.toRaw(author.address), author);
  }
}
