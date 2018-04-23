// @flow

const stringify = require("json-stable-stringify");

import type {Node, Edge} from "../../core/graph";
import type {Address} from "../../core/address";
import {Graph, edgeID} from "../../core/graph";
import {findReferences} from "./findReferences";

export const GITHUB_PLUGIN_NAME = "sourcecred/github-beta";

/** Node Types */
export const ISSUE_NODE_TYPE: "ISSUE" = "ISSUE";
export type IssueNodePayload = {|
  +url: string,
  +title: string,
  +number: number,
  +body: string,
|};

export const PULL_REQUEST_NODE_TYPE: "PULL_REQUEST" = "PULL_REQUEST";
export type PullRequestNodePayload = {|
  +url: string,
  +title: string,
  +number: number,
  +body: string,
|};

export type PullRequestReviewState =
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "COMMENTED"
  | "DISMISSED"
  | "PENDING";
export const PULL_REQUEST_REVIEW_NODE_TYPE: "PULL_REQUEST_REVIEW" =
  "PULL_REQUEST_REVIEW";
export type PullRequestReviewNodePayload = {|
  +url: string,
  +body: string,
  +state: PullRequestReviewState,
|};

export const COMMENT_NODE_TYPE: "COMMENT" = "COMMENT";
export type CommentNodePayload = {|
  +url: string,
  +body: string,
|};

// We have this as a separate type from regular comments because we may
// be interested in diff hunks, which are only present on PR review
// comments.
export const PULL_REQUEST_REVIEW_COMMENT_NODE_TYPE: "PULL_REQUEST_REVIEW_COMMENT" =
  "PULL_REQUEST_REVIEW_COMMENT";
export type PullRequestReviewCommentNodePayload = {|
  +url: string,
  +body: string,
|};

export const USER_NODE_TYPE: "USER" = "USER";
export type UserNodePayload = {|
  +login: string,
  +url: string,
|};

export const BOT_NODE_TYPE: "BOT" = "BOT";
export type BotNodePayload = {|
  +login: string,
  +url: string,
|};

export const ORGANIZATION_NODE_TYPE: "ORGANIZATION" = "ORGANIZATION";
export type OrganizationNodePayload = {|
  +login: string,
  +url: string,
|};

export type AuthorNodeType =
  | typeof USER_NODE_TYPE
  | typeof BOT_NODE_TYPE
  | typeof ORGANIZATION_NODE_TYPE;
export type AuthorNodePayload =
  | UserNodePayload
  | BotNodePayload
  | OrganizationNodePayload;

// A map from NodeType string to the corresponding type and payload.
// Primarily useful for adding static assertions with $ObjMap, but also
// useful at the value layer as $ElementType<NodeTypes, "ISSUE">, for
// instance.
export type NodeTypes = {|
  ISSUE: {payload: IssueNodePayload, type: typeof ISSUE_NODE_TYPE},
  PULL_REQUEST: {
    payload: PullRequestNodePayload,
    type: typeof PULL_REQUEST_NODE_TYPE,
  },
  COMMENT: {payload: CommentNodePayload, type: typeof COMMENT_NODE_TYPE},
  PULL_REQUEST_REVIEW_COMMENT: {
    payload: PullRequestReviewCommentNodePayload,
    type: typeof PULL_REQUEST_REVIEW_COMMENT_NODE_TYPE,
  },
  PULL_REQUEST_REVIEW: {
    payload: PullRequestReviewNodePayload,
    type: typeof PULL_REQUEST_REVIEW_NODE_TYPE,
  },
  USER: {payload: UserNodePayload, type: typeof USER_NODE_TYPE},
  ORGANIZATION: {
    payload: OrganizationNodePayload,
    type: typeof ORGANIZATION_NODE_TYPE,
  },
  BOT: {payload: BotNodePayload, type: typeof BOT_NODE_TYPE},
|};

export type NodeType =
  | typeof ISSUE_NODE_TYPE
  | typeof PULL_REQUEST_NODE_TYPE
  | typeof COMMENT_NODE_TYPE
  | typeof PULL_REQUEST_REVIEW_NODE_TYPE
  | typeof PULL_REQUEST_REVIEW_COMMENT_NODE_TYPE
  | AuthorNodeType;

export type NodePayload =
  | IssueNodePayload
  | PullRequestNodePayload
  | CommentNodePayload
  | PullRequestReviewCommentNodePayload
  | PullRequestReviewNodePayload
  | AuthorNodePayload;

/** Edge Types */
export type AuthorsEdgePayload = {};
export const AUTHORS_EDGE_TYPE: "AUTHORS" = "AUTHORS";
export type ContainsEdgePayload = {};
export const CONTAINS_EDGE_TYPE: "CONTAINS" = "CONTAINS";
export type ReferencesEdgePayload = {};
export const REFERENCES_EDGE_TYPE: "REFERENCES" = "REFERENCES";

export type EdgeTypes = {|
  AUTHORS: {
    payload: AuthorsEdgePayload,
    type: typeof AUTHORS_EDGE_TYPE,
  },
  CONTAINS: {
    payload: ContainsEdgePayload,
    type: typeof CONTAINS_EDGE_TYPE,
  },
  REFERENCES: {
    payload: ReferencesEdgePayload,
    type: typeof REFERENCES_EDGE_TYPE,
  },
|};

export type EdgeType =
  | typeof AUTHORS_EDGE_TYPE
  | typeof CONTAINS_EDGE_TYPE
  | typeof REFERENCES_EDGE_TYPE;

export type EdgePayload =
  | AuthorsEdgePayload
  | ContainsEdgePayload
  | ReferencesEdgePayload;

(function staticAssertions() {
  // Check that node & edge payload types are exhaustive.
  (x: NodeType): $Keys<NodeTypes> => x;
  (x: EdgeType): $Keys<EdgeTypes> => x;

  // Check that each type is associated with the correct ID type.
  // Doesn't work because of a Flow bug; should work if that bug is
  // fixed: https://github.com/facebook/flow/issues/4211
  // (Summary of bug: $ElementType<O, -> does not preserve unions.)
  //
  // <T: $Keys<NodeTypes>>(
  //   x: T
  // ): $ElementType<
  //   $ElementType<$ElementType<NodeTypes, T>, "id">,
  //   "type"
  // > => x;
});
export class GithubParser {
  repositoryName: string;
  graph: Graph<NodePayload, EdgePayload>;

  constructor(repositoryName: string) {
    this.repositoryName = repositoryName;
    this.graph = new Graph();
  }

  makeNodeAddress(type: NodeType, id: string): Address {
    return {
      pluginName: GITHUB_PLUGIN_NAME,
      repositoryName: this.repositoryName,
      type,
      id,
    };
  }

  makeEdgeAddress(type: EdgeType, src: Address, dst: Address): Address {
    return {
      pluginName: GITHUB_PLUGIN_NAME,
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
    this.graph.getNodes().forEach((node) => {
      referenceToNode[node.payload.url] = node;
      const anyNode: Node<any> = node;
      const type: NodeType = (node.address.type: any);
      switch (type) {
        case "ISSUE":
        case "PULL_REQUEST":
          referenceToNode[`#${anyNode.payload.number}`] = node;
          break;
        case "USER":
        case "ORGANIZATION":
        case "BOT":
          referenceToNode[`@${anyNode.payload.login}`] = node;
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
    this.graph.getNodes().forEach((srcNode) => {
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

  addData(dataJson: *) {
    dataJson.repository.issues.nodes.forEach((i) => this.addIssue(i));
    dataJson.repository.pullRequests.nodes.forEach((pr) =>
      this.addPullRequest(pr)
    );
  }
}
