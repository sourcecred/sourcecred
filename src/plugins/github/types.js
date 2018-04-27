// @flow

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

export const AUTHOR_NODE_TYPE: "AUTHOR" = "AUTHOR";
export type AuthorSubtype = "USER" | "BOT" | "ORGANIZATION";
export type AuthorNodePayload = {|
  +login: string,
  +url: string,
  +subtype: AuthorSubtype,
|};

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
  AUTHOR: {payload: AuthorNodePayload, type: typeof AUTHOR_NODE_TYPE},
|};

export type NodeType =
  | typeof ISSUE_NODE_TYPE
  | typeof PULL_REQUEST_NODE_TYPE
  | typeof COMMENT_NODE_TYPE
  | typeof PULL_REQUEST_REVIEW_NODE_TYPE
  | typeof PULL_REQUEST_REVIEW_COMMENT_NODE_TYPE
  | typeof AUTHOR_NODE_TYPE;

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
