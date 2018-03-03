// @flow

export const GITHUB_PLUGIN_NAME = "sourcecred/github-beta";

export type IssueNodePayload = {|
  +type: "ISSUE",
  +title: string,
  +number: number,
|};

export type PullRequestNodePayload = {|
  +type: "PULL_REQUEST",
  +title: string,
  +number: number,
|};

export type CommentNodePayload = {|
  +type: "COMMENT",
  +body: string,
|};

export type UserNodePayload = {|
  +type: "USER",
  +userName: string,
|};

export type NodePayload =
  | IssueNodePayload
  | PullRequestNodePayload
  | CommentNodePayload
  | UserNodePayload;
export type NodeType = $ElementType<NodePayload, "type">;

export type AuthorshipEdgePayload = {|
  +type: "AUTHORSHIP",
|};

export type ReferenceEdgePayload = {|
  +type: "REFERENCE",
|};

export type EdgePayload = AuthorshipEdgePayload | ReferenceEdgePayload;
export type EdgeType = $ElementType<EdgePayload, "type">;
