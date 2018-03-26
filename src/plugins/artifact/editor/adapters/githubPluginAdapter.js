// @flow

import React from "react";

import {Graph} from "../../../../core/graph";
import type {Node} from "../../../../core/graph";
import type {
  NodePayload,
  EdgeID,
  NodeType,
  NodeTypes,
  IssueNodePayload,
  PullRequestNodePayload,
  CommentNodePayload,
  PullRequestReviewCommentNodePayload,
  PullRequestReviewNodePayload,
  AuthorNodePayload,
} from "../../../github/githubPlugin";
import type {PluginAdapter} from "../pluginAdapter";
import {GITHUB_PLUGIN_NAME} from "../../../github/githubPlugin";

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
        .filter((e) => e.address.type === "CONTAINMENT")
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
    type TypedNodeToStringExtractor = <T: $Values<NodeTypes>>(
      T
    ) => (node: Node<$ElementType<T, "payload">>) => string;
    const extractors: $Exact<$ObjMap<NodeTypes, TypedNodeToStringExtractor>> = {
      ISSUE: extractIssueOrPrTitle,
      PULL_REQUEST: extractIssueOrPrTitle,
      COMMENT: (node) => extractCommentTitle("comment", node),
      PULL_REQUEST_REVIEW_COMMENT: (node) =>
        extractCommentTitle("review comment", node),
      PULL_REQUEST_REVIEW: extractPRReviewTitle,
      USER: extractAuthorTitle,
      ORGANIZATION: extractAuthorTitle,
      BOT: extractAuthorTitle,
    };
    function fallbackAccessor(node: Node<NodePayload>) {
      throw new Error(`unknown node type: ${node.address.type}`);
    }
    return (extractors[node.address.type] || fallbackAccessor)(
      (node: Node<any>)
    );
  },
};

export default adapter;
