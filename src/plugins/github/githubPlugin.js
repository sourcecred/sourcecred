// @flow

import type {Node, Edge} from "../../core/graph";
import type {Address} from "../../core/address";
import {Graph} from "../../core/graph";
const stringify = require("json-stable-stringify");

export const GITHUB_PLUGIN_NAME = "sourcecred/github-beta";

export type IssueNodePayload = {|
  +title: string,
  +number: number,
  +body: string,
|};
export type IssueNodeID = {|
  +type: "ISSUE",
  +id: string,
|};

export type PullRequestNodePayload = {|
  +title: string,
  +number: number,
  +body: string,
|};
export type PullRequestNodeID = {|
  +type: "PULL_REQUEST",
  +id: string,
|};

export type PullRequestReviewState =
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "COMMENTED"
  | "DISMISSED"
  | "PENDING";
export type PullRequestReviewNodePayload = {|
  +body: string,
  +state: PullRequestReviewState,
|};
export type PullRequestReviewNodeID = {|
  +type: "PULL_REQUEST_REVIEW",
  +id: string,
|};

export type CommentNodePayload = {|
  +url: string,
  +body: string,
|};
export type CommentNodeID = {|
  +type: "COMMENT",
  +id: string,
|};

// We have this as a separate type from regular comments because we may
// be interested in diff hunks, which are only present on PR review
// comments.
export type PullRequestReviewCommentNodePayload = {|
  +url: string,
  +body: string,
|};
export type PullRequestReviewCommentNodeID = {|
  +type: "PULL_REQUEST_REVIEW_COMMENT",
  +id: string,
|};

export type UserNodePayload = {|
  +login: string,
|};
export type UserNodeID = {|
  +type: "USER",
  +id: string,
|};

export type BotNodePayload = {|
  +login: string,
|};
export type BotNodeID = {|
  +type: "BOT",
  +id: string,
|};

export type OrganizationNodePayload = {|
  +login: string,
|};
export type OrganizationNodeID = {|
  +type: "ORGANIZATION",
  +id: string,
|};

export type AuthorNodePayload =
  | UserNodePayload
  | BotNodePayload
  | OrganizationNodePayload;
export type AuthorNodeID = UserNodeID | BotNodeID | OrganizationNodeID;

export type NodePayload =
  | IssueNodePayload
  | PullRequestNodePayload
  | CommentNodePayload
  | PullRequestReviewCommentNodePayload
  | PullRequestReviewNodePayload
  | AuthorNodePayload;
export type NodeID =
  | IssueNodeID
  | PullRequestNodeID
  | PullRequestReviewCommentNodeID
  | CommentNodeID
  | PullRequestReviewNodeID
  | AuthorNodeID;
export type NodeType = $ElementType<NodeID, "type">;

// A map from NodeType string to the corresponding ID and payload types.
// Primarily useful for adding static assertions with $ObjMap, but also
// useful at the value layer as $ElementType<NodeTypes, "ISSUE">, for
// instance.
export type NodeTypes = {|
  ISSUE: {
    id: IssueNodeID,
    payload: IssueNodePayload,
  },
  PULL_REQUEST: {
    id: PullRequestNodeID,
    payload: PullRequestNodePayload,
  },
  COMMENT: {
    id: CommentNodeID,
    payload: CommentNodePayload,
  },
  PULL_REQUEST_REVIEW_COMMENT: {
    id: PullRequestReviewCommentNodeID,
    payload: PullRequestReviewCommentNodePayload,
  },
  PULL_REQUEST_REVIEW: {
    id: PullRequestReviewNodeID,
    payload: PullRequestReviewNodePayload,
  },
  USER: {
    id: UserNodeID,
    payload: UserNodePayload,
  },
  ORGANIZATION: {
    id: OrganizationNodeID,
    payload: OrganizationNodePayload,
  },
  BOT: {
    id: BotNodeID,
    payload: BotNodePayload,
  },
|};

export type EdgeTypes = {|
  AUTHORSHIP: {
    id: AuthorshipEdgeID,
    payload: AuthorshipEdgePayload,
  },
  CONTAINMENT: {
    id: ContainmentEdgeID,
    payload: ContainmentEdgePayload,
  },
  REFERENCE: {
    id: ReferenceEdgeID,
    payload: ReferenceEdgePayload,
  },
|};

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

export type AuthorshipEdgePayload = {};
export type AuthorshipEdgeID = {
  +type: "AUTHORSHIP",
  +contributionID: NodeID,
  +authorID: NodeID,
};
export type ContainmentEdgePayload = {};
export type ContainmentEdgeID = {
  +type: "CONTAINMENT",
  +childID: NodeID,
  +parentID: NodeID,
};
export type ReferenceEdgePayload = {};
export type ReferenceEdgeID = {
  +type: "REFERENCE",
  +referrer: NodeID,
  +referent: NodeID,
};

export type EdgePayload =
  | AuthorshipEdgePayload
  | ContainmentEdgePayload
  | ReferenceEdgePayload;
export type EdgeID = AuthorshipEdgeID | ContainmentEdgeID | ReferenceEdgeID;
export type EdgeType = $ElementType<EdgeID, "type">;

export function getNodeType(n: Node<NodePayload>): NodeType {
  return JSON.parse(n.address.id).type;
}

export function getEdgeType(e: Edge<EdgePayload>): EdgeType {
  return JSON.parse(e.address.id).type;
}

export class GithubParser {
  repositoryName: string;
  graph: Graph<NodePayload, EdgePayload>;

  constructor(repositoryName: string) {
    this.repositoryName = repositoryName;
    this.graph = new Graph();
  }

  makeAddress(id: NodeID | EdgeID): Address {
    return {
      pluginName: GITHUB_PLUGIN_NAME,
      repositoryName: this.repositoryName,
      id: stringify(id),
    };
  }

  addAuthorship(
    authoredNodeID:
      | IssueNodeID
      | PullRequestNodeID
      | CommentNodeID
      | PullRequestReviewCommentNodeID
      | PullRequestReviewNodeID,
    authoredNode: Node<
      | IssueNodePayload
      | PullRequestNodePayload
      | CommentNodePayload
      | PullRequestReviewCommentNodePayload
      | PullRequestReviewNodePayload
    >,
    authorJson: *
  ) {
    let authorPayload: AuthorNodePayload = {login: authorJson.login};
    let authorID: AuthorNodeID;
    switch (authorJson.__typename) {
      case "User":
        authorID = {type: "USER", id: authorJson.id};
        break;
      case "Bot":
        authorID = {type: "BOT", id: authorJson.id};
        break;
      case "Organization":
        authorID = {type: "ORGANIZATION", id: authorJson.id};
        break;
      default:
        throw new Error(
          `Unexpected author type ${authorJson.__typename} on ${stringify(
            authorJson
          )}`
        );
    }

    const authorNode: Node<AuthorNodePayload> = {
      address: this.makeAddress(authorID),
      payload: authorPayload,
    };
    this.graph.addNode(authorNode);

    const authorshipID = {
      type: "AUTHORSHIP",
      contributionID: authoredNodeID,
      authorID,
    };
    const authorshipEdge: Edge<AuthorshipEdgePayload> = {
      address: this.makeAddress(authorshipID),
      payload: {},
      src: authoredNode.address,
      dst: authorNode.address,
    };
    this.graph.addEdge(authorshipEdge);
  }

  addComment(
    parentID: IssueNodeID | PullRequestNodeID | PullRequestReviewNodeID,
    parentNode: Node<
      IssueNodePayload | PullRequestNodePayload | PullRequestReviewNodePayload
    >,
    commentJson: *
  ) {
    let commentID: CommentNodeID | PullRequestReviewCommentNodeID;
    if (parentID.type === "PULL_REQUEST_REVIEW") {
      commentID = {type: "PULL_REQUEST_REVIEW_COMMENT", id: commentJson.id};
    } else if (parentID.type === "ISSUE" || parentID.type === "PULL_REQUEST") {
      commentID = {type: "COMMENT", id: commentJson.id};
    } else {
      throw new Error(`Unexpected comment parent type ${parentID.type}`);
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
      address: this.makeAddress(commentID),
      payload: commentNodePayload,
    };
    this.graph.addNode(commentNode);

    this.addAuthorship(commentID, commentNode, commentJson.author);
    this.addContainment(parentID, parentNode, commentID, commentNode);
  }

  addContainment(
    parentID: IssueNodeID | PullRequestNodeID | PullRequestReviewNodeID,
    parentNode: Node<
      IssueNodePayload | PullRequestNodePayload | PullRequestReviewNodePayload
    >,
    childID:
      | CommentNodeID
      | PullRequestReviewCommentNodeID
      | PullRequestReviewNodeID,
    childNode: Node<
      | CommentNodePayload
      | PullRequestReviewCommentNodePayload
      | PullRequestReviewNodePayload
    >
  ) {
    const containmentID: ContainmentEdgeID = {
      type: "CONTAINMENT",
      childID,
      parentID,
    };
    const containmentEdge = {
      address: this.makeAddress(containmentID),
      payload: {},
      src: parentNode.address,
      dst: childNode.address,
    };
    this.graph.addEdge(containmentEdge);
  }

  addIssue(issueJson: *) {
    const issueID: IssueNodeID = {type: "ISSUE", id: issueJson.id};
    const issuePayload: IssueNodePayload = {
      number: issueJson.number,
      title: issueJson.title,
      body: issueJson.body,
    };
    const issueNode: Node<IssueNodePayload> = {
      address: this.makeAddress(issueID),
      payload: issuePayload,
    };
    this.graph.addNode(issueNode);

    this.addAuthorship(issueID, issueNode, issueJson.author);

    issueJson.comments.nodes.forEach((c) =>
      this.addComment(issueID, issueNode, c)
    );
  }

  addPullRequest(prJson: *) {
    const pullRequestID: PullRequestNodeID = {
      type: "PULL_REQUEST",
      id: prJson.id,
    };
    const pullRequestPayload: PullRequestNodePayload = {
      number: prJson.number,
      title: prJson.title,
      body: prJson.body,
    };
    const pullRequestNode: Node<PullRequestNodePayload> = {
      address: this.makeAddress(pullRequestID),
      payload: pullRequestPayload,
    };
    this.graph.addNode(pullRequestNode);

    this.addAuthorship(pullRequestID, pullRequestNode, prJson.author);
    prJson.comments.nodes.forEach((c) =>
      this.addComment(pullRequestID, pullRequestNode, c)
    );

    prJson.reviews.nodes.forEach((r) =>
      this.addPullRequestReview(pullRequestID, pullRequestNode, r)
    );
  }

  addPullRequestReview(
    pullRequestID: PullRequestNodeID,
    pullRequestNode: Node<PullRequestNodePayload>,
    reviewJson: *
  ) {
    const reviewID: PullRequestReviewNodeID = {
      type: "PULL_REQUEST_REVIEW",
      id: reviewJson.id,
    };
    const reviewPayload: PullRequestReviewNodePayload = {
      state: reviewJson.state,
      body: reviewJson.body,
    };
    const reviewNode: Node<PullRequestReviewNodePayload> = {
      address: this.makeAddress(reviewID),
      payload: reviewPayload,
    };
    this.graph.addNode(reviewNode);
    this.addContainment(pullRequestID, pullRequestNode, reviewID, reviewNode);
    this.addAuthorship(reviewID, reviewNode, reviewJson.author);
    reviewJson.comments.nodes.forEach((c) =>
      this.addComment(reviewID, reviewNode, c)
    );
  }

  addData(dataJson: *) {
    dataJson.repository.issues.nodes.forEach((i) => this.addIssue(i));
    dataJson.repository.pullRequests.nodes.forEach((pr) =>
      this.addPullRequest(pr)
    );
  }
}
