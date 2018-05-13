// @flow

import stringify from "json-stable-stringify";

import type {Node, Edge} from "core/graph";
import type {
  NodeType,
  EdgeType,
  NodePayload,
  EdgePayload,
  PullRequestReviewNodePayload,
  RepositoryNodePayload,
  AuthorNodePayload,
  AuthorsEdgePayload,
  PullRequestReviewCommentNodePayload,
  CommentNodePayload,
  PullRequestNodePayload,
  ReferencesEdgePayload,
  IssueNodePayload,
  AuthorSubtype,
} from "./types";

import {MERGED_AS_EDGE_TYPE} from "./types";
import type {
  GithubResponseJSON,
  RepositoryJSON,
  PullRequestReviewJSON,
  PullRequestJSON,
  IssueJSON,
  CommentJSON,
  NullableAuthorJSON,
} from "./graphql";

import type {Address} from "core/address";
import {PLUGIN_NAME} from "./pluginName";
import {Graph, edgeID} from "core/graph";
import {findReferences} from "./findReferences";
import {commitAddress} from "plugins/git/address";

export function parse(
  githubResponseJSON: GithubResponseJSON
): Graph<NodePayload, EdgePayload> {
  const parser = new GithubParser();
  parser.addData(githubResponseJSON);
  parser.addReferenceEdges();
  return parser.graph;
}

class GithubParser {
  graph: Graph<NodePayload, EdgePayload>;

  constructor() {
    this.graph = new Graph();
  }

  makeNodeAddress(type: NodeType, url: string): Address {
    return {
      pluginName: PLUGIN_NAME,
      type,
      id: url,
    };
  }

  makeEdgeAddress(type: EdgeType, src: Address, dst: Address): Address {
    return {
      pluginName: PLUGIN_NAME,
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
    authorJson: NullableAuthorJSON
  ) {
    if (authorJson == null) {
      return;
    }
    let authorType: AuthorSubtype;
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
    const authorPayload: AuthorNodePayload = {
      login: authorJson.login,
      url: authorJson.url,
      subtype: authorType,
    };

    const authorNode: Node<AuthorNodePayload> = {
      address: this.makeNodeAddress("AUTHOR", authorJson.url),
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
    commentJson: CommentJSON
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
      address: this.makeNodeAddress(commentType, commentJson.url),
      payload: commentNodePayload,
    };
    this.graph.addNode(commentNode);

    this.addAuthorship(commentNode, commentJson.author);
    this.addContainment(parentNode, commentNode);
  }

  addContainment(
    parentNode: Node<
      | IssueNodePayload
      | PullRequestNodePayload
      | PullRequestReviewNodePayload
      | RepositoryNodePayload
    >,
    childNode: Node<
      | IssueNodePayload
      | PullRequestNodePayload
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

  addIssue(repoNode: Node<RepositoryNodePayload>, issueJson: IssueJSON) {
    const issuePayload: IssueNodePayload = {
      url: issueJson.url,
      number: issueJson.number,
      title: issueJson.title,
      body: issueJson.body,
    };
    const issueNode: Node<IssueNodePayload> = {
      address: this.makeNodeAddress("ISSUE", issueJson.url),
      payload: issuePayload,
    };
    this.graph.addNode(issueNode);

    this.addAuthorship(issueNode, issueJson.author);
    this.addContainment(repoNode, issueNode);

    issueJson.comments.nodes.forEach((c) => this.addComment(issueNode, c));
  }

  addPullRequest(
    repoNode: Node<RepositoryNodePayload>,
    prJson: PullRequestJSON
  ) {
    const pullRequestPayload: PullRequestNodePayload = {
      url: prJson.url,
      number: prJson.number,
      title: prJson.title,
      body: prJson.body,
    };
    const pullRequestNode: Node<PullRequestNodePayload> = {
      address: this.makeNodeAddress("PULL_REQUEST", prJson.url),
      payload: pullRequestPayload,
    };
    this.graph.addNode(pullRequestNode);

    this.addAuthorship(pullRequestNode, prJson.author);
    this.addContainment(repoNode, pullRequestNode);
    prJson.comments.nodes.forEach((c) => this.addComment(pullRequestNode, c));

    prJson.reviews.nodes.forEach((r) =>
      this.addPullRequestReview(pullRequestNode, r)
    );

    if (prJson.mergeCommit != null) {
      const hash = prJson.mergeCommit.oid;
      const dstAddr = commitAddress(hash);
      const mergedAsEdge = {
        address: this.makeEdgeAddress(
          MERGED_AS_EDGE_TYPE,
          pullRequestNode.address,
          dstAddr
        ),
        payload: {hash},
        src: pullRequestNode.address,
        dst: dstAddr,
      };
      this.graph.addEdge(mergedAsEdge);
    }
  }

  addPullRequestReview(
    pullRequestNode: Node<PullRequestNodePayload>,
    reviewJson: PullRequestReviewJSON
  ) {
    const reviewPayload: PullRequestReviewNodePayload = {
      url: reviewJson.url,
      state: reviewJson.state,
      body: reviewJson.body,
    };
    const reviewNode: Node<PullRequestReviewNodePayload> = {
      address: this.makeNodeAddress("PULL_REQUEST_REVIEW", reviewJson.url),
      payload: reviewPayload,
    };
    this.graph.addNode(reviewNode);
    this.addContainment(pullRequestNode, reviewNode);
    this.addAuthorship(reviewNode, reviewJson.author);
    reviewJson.comments.nodes.forEach((c) => this.addComment(reviewNode, c));
  }

  /** Add all the in-repo GitHub reference edges detected.
   *
   * Parse all the nodes added to the GitHubParser, detect any
   * GitHub references (e.g. url, #num, or @login), and add corresponding
   * REFERENCE type edges.
   *
   * Needs to be called after adding data (or it will no-op).
   * @returns {string[]}: All of the dangling (unparsed) reference strings.
   */
  addReferenceEdges(): string[] {
    const referenceToNode = {};
    this.graph.nodes().forEach((node) => {
      referenceToNode[node.payload.url] = node;
      const anyNode: Node<any> = node;
      const type: NodeType = (node.address.type: any);
      switch (type) {
        case "REPOSITORY":
          break;
        case "ISSUE":
        case "PULL_REQUEST":
          const thisPayload: IssueNodePayload | PullRequestNodePayload =
            anyNode.payload;
          referenceToNode[`#${thisPayload.number}`] = node;
          break;
        case "AUTHOR":
          let authorPayload: AuthorNodePayload = anyNode.payload;
          referenceToNode[`@${authorPayload.login}`] = node;
          break;
        case "COMMENT":
        case "PULL_REQUEST_REVIEW":
        case "PULL_REQUEST_REVIEW_COMMENT":
          break;
        default:
          // eslint-disable-next-line no-unused-expressions
          (type: empty);
          throw new Error(`unknown node type: ${type}`);
      }
    });

    const danglingReferences = [];
    this.graph.nodes().forEach((srcNode) => {
      if (srcNode.payload.body !== undefined) {
        const references = findReferences(srcNode.payload.body);
        references.forEach((ref) => {
          const dstNode = referenceToNode[ref];
          if (dstNode === undefined) {
            danglingReferences.push(ref);
          } else {
            const referenceEdge: Edge<ReferencesEdgePayload> = {
              address: this.makeEdgeAddress(
                "REFERENCES",
                srcNode.address,
                dstNode.address
              ),
              payload: {},
              src: srcNode.address,
              dst: dstNode.address,
            };
            this.graph.addEdge(referenceEdge);
          }
        });
      }
    });
    return danglingReferences;
  }

  addRepository(repositoryJSON: RepositoryJSON) {
    const repositoryPayload: RepositoryNodePayload = {
      url: repositoryJSON.url,
      name: repositoryJSON.name,
      owner: repositoryJSON.owner.login,
    };
    const repositoryNode: Node<RepositoryNodePayload> = {
      address: this.makeNodeAddress("REPOSITORY", repositoryJSON.url),
      payload: repositoryPayload,
    };
    this.graph.addNode(repositoryNode);
    repositoryJSON.issues.nodes.forEach((issue) =>
      this.addIssue(repositoryNode, issue)
    );
    repositoryJSON.pullRequests.nodes.forEach((pr) =>
      this.addPullRequest(repositoryNode, pr)
    );
  }

  addData(dataJson: GithubResponseJSON) {
    this.addRepository(dataJson.repository);
  }
}
