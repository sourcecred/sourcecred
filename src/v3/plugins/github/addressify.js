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

export function addressify(data: Q.GithubResponseJSON): DataAddressed {
  return {repos: [convertRepo(data.repository)]};
}

export type DataAddressed = {|
  +repos: RepoAddressed[],
|};

export type RepoAddressed = {|
  +type: typeof N.REPO_TYPE,
  +address: N.RepoAddress,
  +url: string,
  +issues: IssueAddressed[],
  +pulls: PullAddressed[],
|};

export type IssueAddressed = {|
  +type: typeof N.ISSUE_TYPE,
  +address: N.IssueAddress,
  +title: string,
  +body: string,
  +url: string,
  +comments: CommentAddressed[],
  +nominalAuthor: ?UserlikeAddressed,
|};

export type PullAddressed = {|
  +type: typeof N.PULL_TYPE,
  +address: N.PullAddress,
  +title: string,
  +body: string,
  +url: string,
  +comments: CommentAddressed[],
  +reviews: ReviewAddressed[],
  +mergedAs: ?GitNode.CommitAddress,
  +nominalAuthor: ?UserlikeAddressed,
|};

export type ReviewAddressed = {|
  +type: typeof N.REVIEW_TYPE,
  +address: N.ReviewAddress,
  +body: string,
  +url: string,
  +comments: CommentAddressed[],
  +state: Q.ReviewState,
  +nominalAuthor: ?UserlikeAddressed,
|};

export type CommentAddressed = {|
  +type: typeof N.COMMENT_TYPE,
  +address: N.CommentAddress,
  +body: string,
  +url: string,
  +nominalAuthor: ?UserlikeAddressed,
|};

export type UserlikeAddressed = {|
  +type: typeof N.USERLIKE_TYPE,
  +address: N.UserlikeAddress,
  +url: string,
|};

function convertRepo(json: Q.RepositoryJSON): RepoAddressed {
  const address: N.RepoAddress = {
    type: N.REPO_TYPE,
    owner: json.owner.login,
    name: json.name,
  };
  const entry: RepoAddressed = {
    address,
    url: json.url,
    issues: json.issues.nodes.map((x) => convertIssue(address, x)),
    pulls: json.pulls.nodes.map((x) => convertPull(address, x)),
    type: N.REPO_TYPE,
  };
  return entry;
}

function convertIssue(repo: N.RepoAddress, json: Q.IssueJSON): IssueAddressed {
  const address: N.IssueAddress = {
    type: N.ISSUE_TYPE,
    number: String(json.number),
    repo,
  };
  const entry: IssueAddressed = {
    address,
    url: json.url,
    comments: json.comments.nodes.map((x) => convertComment(address, x)),
    nominalAuthor: convertNullableAuthor(json.author),
    body: json.body,
    title: json.title,
    type: N.ISSUE_TYPE,
  };
  return entry;
}

function convertPull(repo: N.RepoAddress, json: Q.PullJSON): PullAddressed {
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

  const entry: PullAddressed = {
    address,
    url: json.url,
    comments: json.comments.nodes.map((x) => convertComment(address, x)),
    reviews: json.reviews.nodes.map((x) => convertReview(address, x)),
    nominalAuthor: convertNullableAuthor(json.author),
    body: json.body,
    title: json.title,
    mergedAs,
    type: N.PULL_TYPE,
  };
  return entry;
}

function convertReview(
  pull: N.PullAddress,
  json: Q.ReviewJSON
): ReviewAddressed {
  const address: N.ReviewAddress = {
    type: N.REVIEW_TYPE,
    id: reviewUrlToId(json.url),
    pull,
  };
  const entry: ReviewAddressed = {
    address,
    url: json.url,
    state: json.state,
    comments: json.comments.nodes.map((x) => convertComment(address, x)),
    body: json.body,
    nominalAuthor: convertNullableAuthor(json.author),
    type: N.REVIEW_TYPE,
  };
  return entry;
}

function convertComment(
  parent: N.IssueAddress | N.PullAddress | N.ReviewAddress,
  json: Q.CommentJSON
): CommentAddressed {
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
  const entry: CommentAddressed = {
    address,
    url: json.url,
    nominalAuthor: convertNullableAuthor(json.author),
    body: json.body,
    type: N.COMMENT_TYPE,
  };
  return entry;
}

function convertNullableAuthor(json: Q.NullableAuthorJSON): ?UserlikeAddressed {
  if (json == null) {
    return null;
  } else {
    const address: N.UserlikeAddress = {
      type: N.USERLIKE_TYPE,
      login: json.login,
    };
    const entry: UserlikeAddressed = {
      address,
      url: json.url,
      type: N.USERLIKE_TYPE,
    };
    return entry;
  }
}
