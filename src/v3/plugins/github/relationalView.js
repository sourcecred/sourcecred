// @flow

import stringify from "json-stable-stringify";
import * as N from "./nodes";
// Workaround for https://github.com/facebook/flow/issues/6538
import type {
  RepoAddress,
  IssueAddress,
  PullAddress,
  ReviewAddress,
  CommentAddress,
  UserlikeAddress,
} from "./nodes";
import * as Q from "./graphql";
import * as GitNode from "../git/nodes";

import {
  reviewUrlToId,
  issueCommentUrlToId,
  pullCommentUrlToId,
  reviewCommentUrlToId,
} from "./urlIdParse";

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

  *repos(): Iterator<Repo> {
    for (const entry of this._repos.values()) {
      yield new Repo(this, entry);
    }
  }

  repo(address: RepoAddress): ?Repo {
    const entry = this._repos.get(N.toRaw(address));
    return entry == null ? entry : new Repo(this, entry);
  }

  *issues(): Iterator<Issue> {
    for (const entry of this._issues.values()) {
      yield new Issue(this, entry);
    }
  }

  issue(address: IssueAddress): ?Issue {
    const entry = this._issues.get(N.toRaw(address));
    return entry == null ? entry : new Issue(this, entry);
  }

  *pulls(): Iterator<Pull> {
    for (const entry of this._pulls.values()) {
      yield new Pull(this, entry);
    }
  }

  pull(address: PullAddress): ?Pull {
    const entry = this._pulls.get(N.toRaw(address));
    return entry == null ? entry : new Pull(this, entry);
  }

  *comments(): Iterator<Comment> {
    for (const entry of this._comments.values()) {
      yield new Comment(this, entry);
    }
  }

  comment(address: CommentAddress): ?Comment {
    const entry = this._comments.get(N.toRaw(address));
    return entry == null ? entry : new Comment(this, entry);
  }

  *reviews(): Iterator<Review> {
    for (const entry of this._reviews.values()) {
      yield new Review(this, entry);
    }
  }

  review(address: ReviewAddress): ?Review {
    const entry = this._reviews.get(N.toRaw(address));
    return entry == null ? entry : new Review(this, entry);
  }

  *userlikes(): Iterator<Userlike> {
    for (const entry of this._userlikes.values()) {
      yield new Userlike(this, entry);
    }
  }

  userlike(address: UserlikeAddress): ?Userlike {
    const entry = this._userlikes.get(N.toRaw(address));
    return entry == null ? entry : new Userlike(this, entry);
  }

  _addRepo(json: Q.RepositoryJSON) {
    const address: RepoAddress = {
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

  _addIssue(repo: RepoAddress, json: Q.IssueJSON): IssueAddress {
    const address: IssueAddress = {
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

  _addPull(repo: RepoAddress, json: Q.PullJSON): PullAddress {
    const address: PullAddress = {
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

  _addReview(pull: PullAddress, json: Q.ReviewJSON): ReviewAddress {
    const address: ReviewAddress = {
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
    parent: IssueAddress | PullAddress | ReviewAddress,
    json: Q.CommentJSON
  ): CommentAddress {
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
    const address: CommentAddress = {type: N.COMMENT_TYPE, id, parent};
    const entry: CommentEntry = {
      address,
      url: json.url,
      nominalAuthor: this._addNullableAuthor(json.author),
      body: json.body,
    };
    this._comments.set(N.toRaw(address), entry);
    return address;
  }

  _addNullableAuthor(json: Q.NullableAuthorJSON): ?UserlikeAddress {
    if (json == null) {
      return null;
    } else {
      const address: UserlikeAddress = {
        type: N.USERLIKE_TYPE,
        login: json.login,
      };
      const entry: UserlikeEntry = {address, url: json.url};
      this._userlikes.set(N.toRaw(address), entry);
      return address;
    }
  }
}

type Entry =
  | RepoEntry
  | IssueEntry
  | PullEntry
  | ReviewEntry
  | CommentEntry
  | UserlikeEntry;

export class Entity<+T: Entry> {
  +_view: RelationalView;
  +_entry: T;
  constructor(view: RelationalView, entry: T) {
    this._view = view;
    this._entry = entry;
  }
  address(): $ElementType<T, "address"> {
    return this._entry.address;
  }
  url(): string {
    return this._entry.url;
  }
}

type RepoEntry = {|
  +address: RepoAddress,
  +url: string,
  +issues: IssueAddress[],
  +pulls: PullAddress[],
|};

export class Repo extends Entity<RepoEntry> {
  constructor(view: RelationalView, entry: RepoEntry) {
    super(view, entry);
  }
  name(): string {
    return this._entry.address.name;
  }
  owner(): string {
    return this._entry.address.owner;
  }
  *issues(): Iterator<Issue> {
    for (const address of this._entry.issues) {
      const issue = this._view.issue(address);
      yield assertExists(issue, address);
    }
  }
  *pulls(): Iterator<Pull> {
    for (const address of this._entry.pulls) {
      const pull = this._view.pull(address);
      yield assertExists(pull, address);
    }
  }
}

type IssueEntry = {|
  +address: IssueAddress,
  +title: string,
  +body: string,
  +url: string,
  +comments: CommentAddress[],
  +nominalAuthor: ?UserlikeAddress,
|};

export class Issue extends Entity<IssueEntry> {
  constructor(view: RelationalView, entry: IssueEntry) {
    super(view, entry);
  }
  parent(): Repo {
    const address = this.address().repo;
    const repo = this._view.repo(address);
    return assertExists(repo, address);
  }
  number(): string {
    return this._entry.address.number;
  }
  title(): string {
    return this._entry.title;
  }
  body(): string {
    return this._entry.body;
  }
  *comments(): Iterator<Comment> {
    for (const address of this._entry.comments) {
      const comment = this._view.comment(address);
      yield assertExists(comment, address);
    }
  }
  authors(): Iterator<Userlike> {
    return getAuthors(this._view, this._entry);
  }
}

type PullEntry = {|
  +address: PullAddress,
  +title: string,
  +body: string,
  +url: string,
  +comments: CommentAddress[],
  +reviews: ReviewAddress[],
  +mergedAs: ?GitNode.CommitAddress,
  +nominalAuthor: ?UserlikeAddress,
|};

export class Pull extends Entity<PullEntry> {
  constructor(view: RelationalView, entry: PullEntry) {
    super(view, entry);
  }
  parent(): Repo {
    const address = this.address().repo;
    const repo = this._view.repo(address);
    return assertExists(repo, address);
  }
  number(): string {
    return this._entry.address.number;
  }
  title(): string {
    return this._entry.title;
  }
  body(): string {
    return this._entry.body;
  }
  mergedAs(): ?GitNode.CommitAddress {
    return this._entry.mergedAs;
  }
  *reviews(): Iterator<Review> {
    for (const address of this._entry.reviews) {
      const review = this._view.review(address);
      yield assertExists(review, address);
    }
  }
  *comments(): Iterator<Comment> {
    for (const address of this._entry.comments) {
      const comment = this._view.comment(address);
      yield assertExists(comment, address);
    }
  }
  authors(): Iterator<Userlike> {
    return getAuthors(this._view, this._entry);
  }
}

type ReviewEntry = {|
  +address: ReviewAddress,
  +body: string,
  +url: string,
  +comments: CommentAddress[],
  +state: Q.ReviewState,
  +nominalAuthor: ?UserlikeAddress,
|};

export class Review extends Entity<ReviewEntry> {
  constructor(view: RelationalView, entry: ReviewEntry) {
    super(view, entry);
  }
  parent(): Pull {
    const address = this.address().pull;
    const pull = this._view.pull(address);
    return assertExists(pull, address);
  }
  body(): string {
    return this._entry.body;
  }
  state(): string {
    return this._entry.state;
  }
  *comments(): Iterator<Comment> {
    for (const address of this._entry.comments) {
      const comment = this._view.comment(address);
      yield assertExists(comment, address);
    }
  }
  authors(): Iterator<Userlike> {
    return getAuthors(this._view, this._entry);
  }
}

type CommentEntry = {|
  +address: CommentAddress,
  +body: string,
  +url: string,
  +nominalAuthor: ?UserlikeAddress,
|};

export class Comment extends Entity<CommentEntry> {
  constructor(view: RelationalView, entry: CommentEntry) {
    super(view, entry);
  }
  parent(): Pull | Issue | Review {
    const address = this.address().parent;
    let parent: ?Pull | ?Issue | ?Review;
    switch (address.type) {
      case "PULL":
        parent = this._view.pull(address);
        break;
      case "ISSUE":
        parent = this._view.issue(address);
        break;
      case "REVIEW":
        parent = this._view.review(address);
        break;
      default:
        // eslint-disable-next-line no-unused-expressions
        (address.type: empty);
        throw new Error(`Unexpected parent address: ${stringify(address)}`);
    }
    return assertExists(parent, address);
  }
  body(): string {
    return this._entry.body;
  }
  authors(): Iterator<Userlike> {
    return getAuthors(this._view, this._entry);
  }
}

type UserlikeEntry = {|
  +address: UserlikeAddress,
  +url: string,
|};

export class Userlike extends Entity<UserlikeEntry> {
  constructor(view: RelationalView, entry: UserlikeEntry) {
    super(view, entry);
  }
  login(): string {
    return this.address().login;
  }
}

function assertExists<T>(item: ?T, address: N.StructuredAddress): T {
  if (item == null) {
    throw new Error(
      `Invariant violation: Expected entity for ${stringify(address)}`
    );
  }
  return item;
}

function* getAuthors(
  view: RelationalView,
  entry: IssueEntry | PullEntry | ReviewEntry | CommentEntry
) {
  const address = entry.nominalAuthor;
  if (address != null) {
    const author = view.userlike(address);
    yield assertExists(author, address);
  }
}
