// @flow

export const GITHUB_PLUGIN_NAME = "sourcecred/github-beta";

export type NodeType = "PULL_REQUEST" | "ISSUE" | "COMMENT" | "USER";

export type PullRequestPayload = {
  title: string,
  isClosed: boolean,
  isMerged: boolean,
  dateCreated: number,
  dateMerged: ?number,
};

export type IssuePayload = {
  title: string,
  isClosed: boolean,
  dateCreated: number,
};

export type ReviewState = "APPROVED" | "COMMENTED" | "CHANGES_REQUESTED";
export type CommentPayload = {
  body: string,
  date: number,
  state: ?ReviewState,
};

export type UserPayload = {
  githubUserId: number,
};

export type GithubNodePayload = {
  type: NodeType,
  subpayload: PullRequestPayload | IssuePayload | CommentPayload | UserPayload,
};

export type EdgeType = "AUTHOR" | "REFERENCE";

export type AuthorPayload = {
  // Issue/PR/Comment -> User
};

export type ReferencePayload = {};
