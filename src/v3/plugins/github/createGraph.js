// @flow

import {Graph} from "../../core/graph";
import type {
  GithubResponseJSON,
  RepositoryJSON,
  ReviewJSON,
  PullJSON,
  IssueJSON,
  CommentJSON,
  ReviewCommentJSON,
  NullableAuthorJSON,
} from "./graphql";

import type {
  RepoAddress,
  IssueAddress,
  PullAddress,
  ReviewAddress,
  UserlikeAddress,
  StructuredAddress,
  AuthorableAddress,
  ChildAddress,
  ParentAddress,
} from "./nodes";
import {toRaw} from "./nodes";

import {createEdge} from "./edges";

import {COMMIT_TYPE, toRaw as gitToRaw} from "../git/nodes";

import {
  reviewUrlToId,
  issueCommentUrlToId,
  pullCommentUrlToId,
  reviewCommentUrlToId,
} from "./urlIdParse";

export function createGraph(data: GithubResponseJSON): Graph {
  const creator = new GraphCreator();
  creator.addData(data);
  return creator.graph;
}

class GraphCreator {
  graph: Graph;

  constructor() {
    this.graph = new Graph();
  }

  addNode(addr: StructuredAddress) {
    this.graph.addNode(toRaw(addr));
  }

  addData(data: GithubResponseJSON) {
    this.addRepository(data.repository);
  }

  addRepository(repoJSON: RepositoryJSON) {
    const repo: RepoAddress = {
      type: "REPO",
      owner: repoJSON.owner.login,
      name: repoJSON.name,
    };
    this.addNode(repo);
    repoJSON.issues.nodes.forEach((issue) => this.addIssue(repo, issue));
    repoJSON.pulls.nodes.forEach((pull) => this.addPull(repo, pull));
  }

  addIssue(repo: RepoAddress, issueJSON: IssueJSON) {
    const issue: IssueAddress = {
      type: "ISSUE",
      repo,
      number: String(issueJSON.number),
    };
    this.addNode(issue);
    this.addAuthors(issue, issueJSON.author);
    this.addHasParent(issue, repo);
    issueJSON.comments.nodes.forEach((comment) =>
      this.addComment(issue, comment)
    );
  }

  addPull(repo: RepoAddress, pullJSON: PullJSON) {
    const pull: PullAddress = {
      type: "PULL",
      repo,
      number: String(pullJSON.number),
    };
    this.addNode(pull);
    this.addAuthors(pull, pullJSON.author);
    this.addHasParent(pull, repo);
    pullJSON.comments.nodes.forEach((c) => this.addComment(pull, c));
    pullJSON.reviews.nodes.forEach((review) => this.addReview(pull, review));
    if (pullJSON.mergeCommit != null) {
      const commitHash = pullJSON.mergeCommit.oid;
      const commit = {type: COMMIT_TYPE, hash: commitHash};
      this.graph.addNode(gitToRaw(commit));
      this.graph.addEdge(createEdge.mergedAs(pull, commit));
    }
  }

  addReview(pull: PullAddress, reviewJSON: ReviewJSON) {
    const id = reviewUrlToId(reviewJSON.url);
    const review = {
      type: "REVIEW",
      pull,
      id,
    };
    this.addNode(review);
    reviewJSON.comments.nodes.forEach((c) => this.addComment(review, c));
    this.addAuthors(review, reviewJSON.author);
    this.addHasParent(review, pull);
  }

  addComment(
    parent: IssueAddress | PullAddress | ReviewAddress,
    commentJSON: CommentJSON | ReviewCommentJSON
  ) {
    const id = (function() {
      switch (parent.type) {
        case "ISSUE":
          return issueCommentUrlToId(commentJSON.url);
        case "PULL":
          return pullCommentUrlToId(commentJSON.url);
        case "REVIEW":
          return reviewCommentUrlToId(commentJSON.url);
        default:
          // eslint-disable-next-line no-unused-expressions
          (parent.type: empty);
          throw new Error(`Unexpected comment parent type: ${parent.type}`);
      }
    })();
    const comment = {
      type: "COMMENT",
      parent,
      id,
    };
    this.addNode(comment);
    this.addAuthors(comment, commentJSON.author);
    this.addHasParent(comment, parent);
  }

  addAuthors(content: AuthorableAddress, authorJSON: NullableAuthorJSON) {
    // author may be null, as not all posts have authors
    if (authorJSON == null) {
      return;
    }
    const author: UserlikeAddress = {
      type: "USERLIKE",
      login: authorJSON.login,
    };
    this.addNode(author);
    this.graph.addEdge(createEdge.authors(author, content));
  }

  addHasParent(child: ChildAddress, parent: ParentAddress) {
    this.graph.addEdge(createEdge.hasParent(child, parent));
  }
}
