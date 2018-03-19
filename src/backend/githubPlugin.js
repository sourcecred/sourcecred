// @flow

import type {Node, Edge} from "./graph";
import type {Address} from "./address";
import {Graph} from "./graph";
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

export type CommentNodePayload = {|
  +url: string,
  +body: string,
|};
export type CommentNodeID = {|
  +type: "COMMENT",
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
  | AuthorNodePayload;
export type NodeID =
  | IssueNodeID
  | PullRequestNodeID
  | CommentNodeID
  | AuthorNodeID;
export type NodeType = $ElementType<NodeID, "type">;

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
    authoredNodeID: IssueNodeID | PullRequestNodeID | CommentNodeID,
    authoredNode: Node<
      IssueNodePayload | PullRequestNodePayload | CommentNodePayload
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
    parentID: IssueNodeID | PullRequestNodeID,
    parentNode: Node<IssueNodePayload | PullRequestNodePayload>,
    commentJson: *
  ) {
    const commentID: CommentNodeID = {type: "COMMENT", id: commentJson.id};
    const commentNodePayload: CommentNodePayload = {
      body: commentJson.body,
      url: commentJson.url,
    };
    const commentNode: Node<CommentNodePayload> = {
      address: this.makeAddress(commentID),
      payload: commentNodePayload,
    };
    this.graph.addNode(commentNode);

    this.addAuthorship(commentID, commentNode, commentJson.author);

    const containmentID: ContainmentEdgeID = {
      type: "CONTAINMENT",
      childID: commentID,
      parentID: parentID,
    };
    const containmentEdge = {
      address: this.makeAddress(containmentID),
      payload: {},
      src: parentNode.address,
      dst: commentNode.address,
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
  }

  addData(dataJson: *) {
    dataJson.repository.issues.nodes.forEach((i) => this.addIssue(i));
    dataJson.repository.pullRequests.nodes.forEach((pr) =>
      this.addPullRequest(pr)
    );
  }
}
