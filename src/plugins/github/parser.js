// @flow

import type {Node, Edge} from "../../core/graph";
import type {
  NodeType,
  EdgeType,
  NodePayload,
  EdgePayload,
  PullRequestReviewNodePayload,
  AuthorNodePayload,
  AuthorsEdgePayload,
  PullRequestReviewCommentNodePayload,
  CommentNodePayload,
  PullRequestNodePayload,
  IssueNodePayload,
} from "./types";
import type {Address} from "../../core/address";
import {PLUGIN_NAME} from "./pluginName";
import {Graph, edgeID} from "../../core/graph";
const stringify = require("json-stable-stringify");

export class GithubParser {
  repositoryName: string;
  graph: Graph<NodePayload, EdgePayload>;

  constructor(repositoryName: string) {
    this.repositoryName = repositoryName;
    this.graph = new Graph();
  }

  makeNodeAddress(type: NodeType, id: string): Address {
    return {
      pluginName: PLUGIN_NAME,
      repositoryName: this.repositoryName,
      type,
      id,
    };
  }

  makeEdgeAddress(type: EdgeType, src: Address, dst: Address): Address {
    return {
      pluginName: PLUGIN_NAME,
      repositoryName: this.repositoryName,
      type,
      id: edgeID(src, dst),
    };
  }

  addAuthorship(
    authoredNode: Node<
      | IssueNodePayload
      | PullRequestNodePayload
      | CommentNodePayload
      | PullRequestReviewCommentNodePayload
      | PullRequestReviewNodePayload
    >,
    authorJson: *
  ) {
    let authorPayload: AuthorNodePayload = {
      login: authorJson.login,
      url: authorJson.url,
    };
    let authorType: NodeType;
    switch (authorJson.__typename) {
      case "User":
        authorType = "USER";
        break;
      case "Bot":
        authorType = "BOT";
        break;
      case "Organization":
        authorType = "ORGANIZATION";
        break;
      default:
        throw new Error(
          `Unexpected author type ${authorJson.__typename} on ${stringify(
            authorJson
          )}`
        );
    }

    const authorNode: Node<AuthorNodePayload> = {
      address: this.makeNodeAddress(authorType, authorJson.id),
      payload: authorPayload,
    };
    this.graph.addNode(authorNode);

    const authorsEdge: Edge<AuthorsEdgePayload> = {
      address: this.makeEdgeAddress(
        "AUTHORS",
        authorNode.address,
        authoredNode.address
      ),
      payload: {},
      src: authoredNode.address,
      dst: authorNode.address,
    };
    this.graph.addEdge(authorsEdge);
  }

  addComment(
    parentNode: Node<
      IssueNodePayload | PullRequestNodePayload | PullRequestReviewNodePayload
    >,
    commentJson: *
  ) {
    let commentType: NodeType;
    switch (parentNode.address.type) {
      case "PULL_REQUEST_REVIEW":
        commentType = "PULL_REQUEST_REVIEW_COMMENT";
        break;
      case "PULL_REQUEST":
      case "ISSUE":
        commentType = "COMMENT";
        break;
      default:
        throw new Error(
          `Unexpected comment parent type ${parentNode.address.type}`
        );
    }

    const commentNodePayload:
      | CommentNodePayload
      | PullRequestReviewCommentNodePayload = {
      body: commentJson.body,
      url: commentJson.url,
    };
    const commentNode: Node<
      CommentNodePayload | PullRequestReviewCommentNodePayload
    > = {
      address: this.makeNodeAddress(commentType, commentJson.id),
      payload: commentNodePayload,
    };
    this.graph.addNode(commentNode);

    this.addAuthorship(commentNode, commentJson.author);
    this.addContainment(parentNode, commentNode);
  }

  addContainment(
    parentNode: Node<
      IssueNodePayload | PullRequestNodePayload | PullRequestReviewNodePayload
    >,
    childNode: Node<
      | CommentNodePayload
      | PullRequestReviewCommentNodePayload
      | PullRequestReviewNodePayload
    >
  ) {
    const containsEdge = {
      address: this.makeEdgeAddress(
        "CONTAINS",
        parentNode.address,
        childNode.address
      ),
      payload: {},
      src: parentNode.address,
      dst: childNode.address,
    };
    this.graph.addEdge(containsEdge);
  }

  addIssue(issueJson: *) {
    const issuePayload: IssueNodePayload = {
      url: issueJson.url,
      number: issueJson.number,
      title: issueJson.title,
      body: issueJson.body,
    };
    const issueNode: Node<IssueNodePayload> = {
      address: this.makeNodeAddress("ISSUE", issueJson.id),
      payload: issuePayload,
    };
    this.graph.addNode(issueNode);

    this.addAuthorship(issueNode, issueJson.author);

    issueJson.comments.nodes.forEach((c) => this.addComment(issueNode, c));
  }

  addPullRequest(prJson: *) {
    const pullRequestPayload: PullRequestNodePayload = {
      url: prJson.url,
      number: prJson.number,
      title: prJson.title,
      body: prJson.body,
    };
    const pullRequestNode: Node<PullRequestNodePayload> = {
      address: this.makeNodeAddress("PULL_REQUEST", prJson.id),
      payload: pullRequestPayload,
    };
    this.graph.addNode(pullRequestNode);

    this.addAuthorship(pullRequestNode, prJson.author);
    prJson.comments.nodes.forEach((c) => this.addComment(pullRequestNode, c));

    prJson.reviews.nodes.forEach((r) =>
      this.addPullRequestReview(pullRequestNode, r)
    );
  }

  addPullRequestReview(
    pullRequestNode: Node<PullRequestNodePayload>,
    reviewJson: *
  ) {
    const reviewPayload: PullRequestReviewNodePayload = {
      url: reviewJson.url,
      state: reviewJson.state,
      body: reviewJson.body,
    };
    const reviewNode: Node<PullRequestReviewNodePayload> = {
      address: this.makeNodeAddress("PULL_REQUEST_REVIEW", reviewJson.id),
      payload: reviewPayload,
    };
    this.graph.addNode(reviewNode);
    this.addContainment(pullRequestNode, reviewNode);
    this.addAuthorship(reviewNode, reviewJson.author);
    reviewJson.comments.nodes.forEach((c) => this.addComment(reviewNode, c));
  }

  addData(dataJson: *) {
    dataJson.repository.issues.nodes.forEach((i) => this.addIssue(i));
    dataJson.repository.pullRequests.nodes.forEach((pr) =>
      this.addPullRequest(pr)
    );
  }
}
