// @flow

import type {Body, FragmentDefinition, Selection} from "../../graphql/queries";
import {build} from "../../graphql/queries";

/**
 * This module defines the GraphQL query that we use to access the
 * GitHub API, and defines functions to facilitate exhaustively
 * requesting all pages of results for this query.
 *
 * The key type is the `Continuation`, which represents a selection set
 * that fetches the next page of results for a particular connection.
 * The flow is as follows:
 *
 *    - A Query is executed and fetches some Results in standard form.
 *    - The Results are analyzed to form Continuations.
 *    - These continuations are embedded into a new Query.
 *
 * This process repeats, and each time that Results are fetched, they
 * are merged into the previous Results so that the Results get
 * progressively more complete. The process terminates when the second
 * step does not yield any more Continuations.
 *
 * Of particular import is the function `continuationsFromContinuation`;
 * see more docs on that function.
 */

/*
 * GitHub enforces a hard limit of no more than 100 entities per page,
 * in any single connection. GitHub also has a more global restriction
 * on the worst-case number of nodes that could be requested by a query,
 * which scales as the product of the page limits in any given sequence
 * of nested connections. (For more information, see [1].) Therefore, we
 * tune the page sizes of various entities to keep them comfortably
 * within the global capacity.
 *
 * We use the `PAGE_LIMIT` field for the top-level page size in
 * continuations.
 *
 * [1]: https://developer.github.com/v4/guides/resource-limitations/#node-limit
 */
export const PAGE_LIMIT = 100;
const PAGE_SIZE_ISSUES = 100;
const PAGE_SIZE_PRS = 100;
const PAGE_SIZE_COMMENTS = 20;
const PAGE_SIZE_REVIEWS = 10;
const PAGE_SIZE_REVIEW_COMMENTS = 10;

/**
 * What's in a continuation? If we want to fetch more comments for the
 * 22nd issue in the results list, we fire off the following query:
 *
 *    _n0: node(id: "<opaque-id-for-issue>") {
 *      ... on Issue {
 *        comments(first: PAGE_LIMIT, after: "<some-cursor>") {
 *          ...comments
 *        }
 *    }
 *
 * This would be represented as:
 *
 *    {
 *      enclosingNodeType: "ISSUE",
 *      enclosingNodeId: "<opaque-id-for-issue>",
 *      selections: [b.inlineFragment("Issue", ...)],
 *      destinationPath: ["repository", "issues", 21],
 *    }
 *
 * The `enclosingNodeId` and `selections` are used to construct the
 * query. The `destinationPath` is used to merge the continued results
 * back into the original results. The `enclosingNodeType` is required
 * so that we know how to check for further continuations on the result.
 * See function `continuationsFromContinuation` for more details on the
 * last one.
 *
 * The nonce (`_n0`) is deliberately not included in the continuation
 * type, because the nonce is a property of a particular embedding of
 * the continuation into a query, and not of the continuation itself.
 */
export type Continuation = {|
  +enclosingNodeType:
    | "REPOSITORY"
    | "ISSUE"
    | "PULL_REQUEST"
    | "PULL_REQUEST_REVIEW",
  +enclosingNodeId: string,
  +selections: $ReadOnlyArray<Selection>,
  +destinationPath: $ReadOnlyArray<string | number>,
|};

/**
 * The top-level GitHub query to request data about a repository.
 * Callers will also be interested in `createVariables`.
 */
export function createQuery(): Body {
  const b = build;
  const body: Body = [
    b.query(
      "FetchData",
      [b.param("repoOwner", "String!"), b.param("repoName", "String!")],
      [
        b.field(
          "repository",
          {owner: b.variable("repoOwner"), name: b.variable("repoName")},
          [
            b.field("id"),
            b.field("issues", {first: b.literal(PAGE_SIZE_ISSUES)}, [
              b.fragmentSpread("issues"),
            ]),
            b.field("pullRequests", {first: b.literal(PAGE_SIZE_PRS)}, [
              b.fragmentSpread("prs"),
            ]),
          ]
        ),
      ]
    ),
    ...createFragments(),
  ];
  return body;
}

/**
 * Find continuations for the top-level result ("data" field) of a
 * query.
 */
export function continuationsFromQuery(result: any): Iterator<Continuation> {
  return continuationsFromRepository(result.repository, result.repository.id, [
    "repository",
  ]);
}

/**
 * Find continuations for a result of a query that was itself generated
 * from a continuation. If an original query Q1 returns results R1 that
 * yield continuations C1, and the query Q2 is an embedding of
 * continuations C1 and returns results R2, then this function, when
 * called with (R2, C1), generates the continuations C2 that should be
 * used to continue the chain.
 *
 * Note that these continuations' results should be merged into the
 * _original_ data structure, not subsequent results. Continuing with
 * the above terminology: results R2 should be merged into R1 to form
 * R2', and then continuations C2 should be embedded into a query Q3
 * whose results R3 should be merged into R2' (as opposed to being
 * merged into R2, and then this result being merged into R1). This is
 * somewhat less efficient in terms of client-side CPU usage, but is
 * also somewhat easier to implement.
 *
 * This function is a critical piece of plumbing: it enables us to
 * iterate through pages, using a continuation to fetch a further
 * continuation on the same entity. The fact that this function is
 * implementable is an indication that the `Continuation` type is
 * defined appropriately. This is non-trivial, as there are a lot of
 * choices as to where the boundaries should be. (For instance, should
 * we include the type of the node that we want to fetch more of, or the
 * type of the enclosing node? What sort of path information should we
 * retain?)
 */
export function continuationsFromContinuation(
  result: any,
  source: Continuation
): Iterator<Continuation> {
  const continuationsFromEnclosingType = {
    REPOSITORY: continuationsFromRepository,
    ISSUE: continuationsFromIssue,
    PULL_REQUEST: continuationsFromPR,
    PULL_REQUEST_REVIEW: continuationsFromReview,
  }[source.enclosingNodeType];
  return continuationsFromEnclosingType(
    result,
    source.enclosingNodeId,
    source.destinationPath
  );
}

function* continuationsFromRepository(
  result: any,
  nodeId: string,
  path: $ReadOnlyArray<string | number>
): Iterator<Continuation> {
  const b = build;
  if (result.issues && result.issues.pageInfo.hasNextPage) {
    yield {
      enclosingNodeType: "REPOSITORY",
      enclosingNodeId: nodeId,
      selections: [
        b.inlineFragment("Repository", [
          b.field(
            "issues",
            {
              first: b.literal(PAGE_LIMIT),
              after: b.literal(result.issues.pageInfo.endCursor),
            },
            [b.fragmentSpread("issues")]
          ),
        ]),
      ],
      destinationPath: path,
    };
  }
  if (result.pullRequests && result.pullRequests.pageInfo.hasNextPage) {
    yield {
      enclosingNodeType: "REPOSITORY",
      enclosingNodeId: nodeId,
      selections: [
        b.inlineFragment("Repository", [
          b.field(
            "pullRequests",
            {
              first: b.literal(PAGE_LIMIT),
              after: b.literal(result.pullRequests.pageInfo.endCursor),
            },
            [b.fragmentSpread("prs")]
          ),
        ]),
      ],
      destinationPath: path,
    };
  }
  if (result.issues) {
    for (let i = 0; i < result.issues.nodes.length; i++) {
      const issue = result.issues.nodes[i];
      const subpath = [...path, "issues", "nodes", i];
      yield* continuationsFromIssue(issue, issue.id, subpath);
    }
  }
  if (result.pullRequests) {
    for (let i = 0; i < result.pullRequests.nodes.length; i++) {
      const pr = result.pullRequests.nodes[i];
      const subpath = [...path, "pullRequests", "nodes", i];
      yield* continuationsFromPR(pr, pr.id, subpath);
    }
  }
}

function* continuationsFromIssue(
  result: any,
  nodeId: string,
  path: $ReadOnlyArray<string | number>
): Iterator<Continuation> {
  const b = build;
  if (result.comments.pageInfo.hasNextPage) {
    yield {
      enclosingNodeType: "ISSUE",
      enclosingNodeId: nodeId,
      selections: [
        b.inlineFragment("Issue", [
          b.field(
            "comments",
            {
              first: b.literal(PAGE_LIMIT),
              after: b.literal(result.comments.pageInfo.endCursor),
            },
            [b.fragmentSpread("comments")]
          ),
        ]),
      ],
      destinationPath: path,
    };
  }
}

function* continuationsFromPR(
  result: any,
  nodeId: string,
  path: $ReadOnlyArray<string | number>
): Iterator<Continuation> {
  const b = build;
  if (result.comments && result.comments.pageInfo.hasNextPage) {
    yield {
      enclosingNodeType: "PULL_REQUEST",
      enclosingNodeId: nodeId,
      selections: [
        b.inlineFragment("PullRequest", [
          b.field(
            "comments",
            {
              first: b.literal(PAGE_LIMIT),
              after: b.literal(result.comments.pageInfo.endCursor),
            },
            [b.fragmentSpread("comments")]
          ),
        ]),
      ],
      destinationPath: path,
    };
  }
  if (result.reviews && result.reviews.pageInfo.hasNextPage) {
    yield {
      enclosingNodeType: "PULL_REQUEST",
      enclosingNodeId: nodeId,
      selections: [
        b.inlineFragment("PullRequest", [
          b.field(
            "reviews",
            {
              first: b.literal(PAGE_LIMIT),
              after: b.literal(result.reviews.pageInfo.endCursor),
            },
            [b.fragmentSpread("reviews")]
          ),
        ]),
      ],
      destinationPath: path,
    };
  }
  if (result.reviews) {
    for (let i = 0; i < result.reviews.nodes.length; i++) {
      const issue = result.reviews.nodes[i];
      const subpath = [...path, "reviews", "nodes", i];
      yield* continuationsFromReview(issue, issue.id, subpath);
    }
  }
}

function* continuationsFromReview(
  result: any,
  nodeId: string,
  path: $ReadOnlyArray<string | number>
): Iterator<Continuation> {
  const b = build;
  if (result.comments.pageInfo.hasNextPage) {
    yield {
      enclosingNodeType: "PULL_REQUEST_REVIEW",
      enclosingNodeId: nodeId,
      selections: [
        b.inlineFragment("PullRequestReview", [
          b.field(
            "comments",
            {
              first: b.literal(PAGE_LIMIT),
              after: b.literal(result.comments.pageInfo.endCursor),
            },
            [b.fragmentSpread("reviewComments")]
          ),
        ]),
      ],
      destinationPath: path,
    };
  }
}

/**
 * These fragments are used to construct the root query, and also to
 * fetch more pages of specific entity types.
 */
function createFragments(): FragmentDefinition[] {
  const b = build;
  const makePageInfo = () =>
    b.field("pageInfo", {}, [b.field("hasNextPage"), b.field("endCursor")]);
  const makeAuthor = () => b.field("author", {}, [b.fragmentSpread("whoami")]);
  return [
    b.fragment("whoami", "Actor", [
      b.field("__typename"),
      b.field("login"),
      b.inlineFragment("User", [b.field("id")]),
      b.inlineFragment("Organization", [b.field("id")]),
      b.inlineFragment("Bot", [b.field("id")]),
    ]),
    b.fragment("issues", "IssueConnection", [
      makePageInfo(),
      b.field("nodes", {}, [
        b.field("id"),
        b.field("title"),
        b.field("body"),
        b.field("number"),
        makeAuthor(),
        b.field("comments", {first: b.literal(PAGE_SIZE_COMMENTS)}, [
          b.fragmentSpread("comments"),
        ]),
      ]),
    ]),
    b.fragment("prs", "PullRequestConnection", [
      makePageInfo(),
      b.field("nodes", {}, [
        b.field("id"),
        b.field("title"),
        b.field("body"),
        b.field("number"),
        makeAuthor(),
        b.field("comments", {first: b.literal(PAGE_SIZE_COMMENTS)}, [
          b.fragmentSpread("comments"),
        ]),
        b.field("reviews", {first: b.literal(PAGE_SIZE_REVIEWS)}, [
          b.fragmentSpread("reviews"),
        ]),
      ]),
    ]),
    // (Note: issue comments and PR comments use the same connection type.)
    b.fragment("comments", "IssueCommentConnection", [
      makePageInfo(),
      b.field("nodes", {}, [
        b.field("id"),
        makeAuthor(),
        b.field("body"),
        b.field("url"),
      ]),
    ]),
    b.fragment("reviews", "PullRequestReviewConnection", [
      makePageInfo(),
      b.field("nodes", {}, [
        b.field("id"),
        b.field("body"),
        makeAuthor(),
        b.field("state"),
        b.field("comments", {first: b.literal(PAGE_SIZE_REVIEW_COMMENTS)}, [
          b.fragmentSpread("reviewComments"),
        ]),
      ]),
    ]),
    b.fragment("reviewComments", "PullRequestReviewCommentConnection", [
      makePageInfo(),
      b.field("nodes", {}, [
        b.field("id"),
        b.field("body"),
        b.field("url"),
        makeAuthor(),
      ]),
    ]),
  ];
}

export function createVariables(repoOwner: string, repoName: string) {
  return {repoOwner, repoName};
}
