// @flow

import React from "react";

import {Graph} from "../../../../core/graph";
import type {Node} from "../../../../core/graph";
import type {
  NodePayload,
  NodeType,
  IssueNodePayload,
  PullRequestNodePayload,
  CommentNodePayload,
  PullRequestReviewCommentNodePayload,
  PullRequestReviewNodePayload,
  AuthorNodePayload,
} from "../../../github/githubPlugin";
import type {PluginAdapter} from "../pluginAdapter";
import {
  GITHUB_PLUGIN_NAME,
  CONTAINS_EDGE_TYPE,
} from "../../../github/githubPlugin";

const adapter: PluginAdapter<NodePayload> = {
  pluginName: GITHUB_PLUGIN_NAME,

  renderer: class GithubNodeRenderer extends React.Component<{
    graph: Graph<any, any>,
    node: Node<NodePayload>,
  }> {
    render() {
      const type = this.props.node.address.type;
      return <div>type: {type} (details to be implemented)</div>;
    }
  },

  extractTitle(graph: *, node: Node<NodePayload>): string {
    // NOTE: If the graph is malformed such that there are containment
    // cycles, then this function may blow the stack or fail to
    // terminate. (If necessary, we can fix this by tracking all
    // previously queried IDs.)
    function extractParentTitles(node: Node<NodePayload>): string[] {
      return graph
        .getInEdges(node.address)
        .filter((e) => e.address.type === CONTAINS_EDGE_TYPE)
        .map((e) => graph.getNode(e.src))
        .map((container) => {
          return adapter.extractTitle(graph, container);
        });
    }
    function extractIssueOrPrTitle(
      node: Node<IssueNodePayload | PullRequestNodePayload>
    ) {
      return `#${node.payload.number}: ${node.payload.title}`;
    }
    function extractCommentTitle(
      kind: string,
      node: Node<CommentNodePayload | PullRequestReviewCommentNodePayload>
    ) {
      const parentTitles = extractParentTitles(node);
      if (parentTitles.length === 0) {
        // Should never happen.
        return "comment (orphaned)";
      } else {
        // Should just be one parent.
        return `comment on ${parentTitles.join(" and ")}`;
      }
    }
    function extractPRReviewTitle(node: Node<PullRequestReviewNodePayload>) {
      const parentTitles = extractParentTitles(node);
      if (parentTitles.length === 0) {
        // Should never happen.
        return "pull request review (orphaned)";
      } else {
        // Should just be one parent.
        return `review of ${parentTitles.join(" and ")}`;
      }
    }
    function extractAuthorTitle(node: Node<AuthorNodePayload>) {
      return node.payload.login;
    }
    const anyNode: Node<any> = node;
    const type: NodeType = (node.address.type: any);
    switch (type) {
      case "ISSUE":
      case "PULL_REQUEST":
        return extractIssueOrPrTitle(anyNode);
      case "COMMENT":
        return extractCommentTitle("comment", anyNode);
      case "PULL_REQUEST_REVIEW_COMMENT":
        return extractCommentTitle("review comment", anyNode);
      case "PULL_REQUEST_REVIEW":
        return extractPRReviewTitle(anyNode);
      case "USER":
      case "ORGANIZATION":
      case "BOT":
        return extractAuthorTitle(anyNode);
      default:
        // eslint-disable-next-line no-unused-expressions
        (type: empty);
        throw new Error(`unknown node type: ${node.address.type}`);
    }
  },
};

export default adapter;
