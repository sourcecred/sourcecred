// @flow

import type {
  Body,
  FragmentDefinition,
  Selection,
  QueryDefinition,
} from "../../graphql/queries";
import {build} from "../../graphql/queries";
import type {Repo} from "../../core/repo";

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
export const PAGE_LIMIT = 50;
const PAGE_SIZE_ISSUES = 50;
const PAGE_SIZE_PRS = 50;
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
  +enclosingNodeType: "REPOSITORY" | "ISSUE" | "PULL" | "REVIEW",
  +enclosingNodeId: string,
  +selections: $ReadOnlyArray<Selection>,
  +destinationPath: $ReadOnlyArray<string | number>,
|};

export type ConnectionJSON<+T> = {|
  +nodes: $ReadOnlyArray<T>,
  +pageInfo: {|
    +endCursor: ?string,
    +hasNextPage: boolean,
  |},
|};

export type GithubResponseJSON = {|
  +repository: RepositoryJSON,
|};

export type RepositoryJSON = {|
  +id: string,
  +issues: ConnectionJSON<IssueJSON>,
  +pulls: ConnectionJSON<PullJSON>,
  +url: string,
  +name: string,
  +owner: AuthorJSON,
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
      [b.param("owner", "String!"), b.param("name", "String!")],
      [
        b.field(
          "repository",
          {owner: b.variable("owner"), name: b.variable("name")},
          [
            b.field("url"),
            b.field("name"),
            b.field("owner", {}, [b.fragmentSpread("whoami")]),
            b.field("id"),
            b.field("issues", {first: b.literal(PAGE_SIZE_ISSUES)}, [
              b.fragmentSpread("issues"),
            ]),
            b.alias(
              "pulls",
              b.field("pullRequests", {first: b.literal(PAGE_SIZE_PRS)}, [
                b.fragmentSpread("pulls"),
              ])
            ),
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
    PULL: continuationsFromPR,
    REVIEW: continuationsFromReview,
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
  if (result.pulls && result.pulls.pageInfo.hasNextPage) {
    yield {
      enclosingNodeType: "REPOSITORY",
      enclosingNodeId: nodeId,
      selections: [
        b.inlineFragment("Repository", [
          b.alias(
            "pulls",
            b.field(
              "pullRequests",
              {
                first: b.literal(PAGE_LIMIT),
                after: b.literal(result.pulls.pageInfo.endCursor),
              },
              [b.fragmentSpread("pulls")]
            )
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
  if (result.pulls) {
    for (let i = 0; i < result.pulls.nodes.length; i++) {
      const pull = result.pulls.nodes[i];
      const subpath = [...path, "pulls", "nodes", i];
      yield* continuationsFromPR(pull, pull.id, subpath);
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
      enclosingNodeType: "PULL",
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
      enclosingNodeType: "PULL",
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
      enclosingNodeType: "REVIEW",
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
 * Execute the given query, returning all pages of data throughout the
 * query. That is: post the query, then find any entities that require
 * more pages of data, fetch those additional pages, and merge the
 * results. The `postQuery` function may be called multiple times.
 */
export async function postQueryExhaustive(
  postQuery: ({body: Body, variables: {+[string]: any}}) => Promise<any>,
  payload: {body: Body, variables: {+[string]: any}}
) {
  const originalResult = await postQuery(payload);
  return resolveContinuations(
    postQuery,
    originalResult,
    Array.from(continuationsFromQuery(originalResult))
  );
}

/**
 * Given the result of a query and the continuations for that query,
 * resolve the continuations and return the merged results.
 */
async function resolveContinuations(
  postQuery: ({body: Body, variables: {+[string]: any}}) => Promise<any>,
  originalResult: any,
  continuations: $ReadOnlyArray<Continuation>
): Promise<any> {
  if (!continuations.length) {
    return originalResult;
  }

  // Assign each continuation a nonce (unique name) so that we can refer
  // to it unambiguously, and embed all the continuations into a query.
  const embeddings = continuations.map((c, i) => ({
    continuation: c,
    nonce: `_n${String(i)}`,
  }));
  const b = build;
  const query = b.query(
    "Continuations",
    [],
    embeddings.map(({continuation, nonce}) =>
      b.alias(
        nonce,
        b.field(
          "node",
          {id: b.literal(continuation.enclosingNodeId)},
          continuation.selections.slice()
        )
      )
    )
  );
  const body = [query, ...requiredFragments(query)];
  const payload = {body, variables: {}};

  // Send the continuation query, then merge these results into the
  // original results---then recur, because the new results may
  // themselves be incomplete.
  const continuationResult = await postQuery(payload);
  const mergedResults = embeddings.reduce((acc, {continuation, nonce}) => {
    return merge(acc, continuationResult[nonce], continuation.destinationPath);
  }, originalResult);
  return resolveContinuations(
    postQuery,
    mergedResults,
    Array.from(continuationsFromQuery(mergedResults))
  );
}

/**
 * A GraphQL query includes a query body and some fragment definitions.
 * It is an error to include unneeded fragment definitions. Therefore,
 * given a standard set of fragments and an arbitrary query body, we
 * need to be able to select just the right set of fragments for our
 * particular query.
 *
 * This function finds all fragments that are transitively used by the
 * given query. That is, it finds all fragments used by the query, all
 * fragments used by those fragments, and so on. Note that the universe
 * of fragments is considered to be the result of `createFragments`; it
 * is an error to use a fragment not defined in the result of that
 * function.
 *
 * Equivalently, construct a graph where the nodes are (a) the query and
 * (b) all possible fragments, and there is an edge from `a` to `b` if
 * `a` references `b`. Then, this function finds the set of vertices
 * reachable from the query node.
 */
export function requiredFragments(
  query: QueryDefinition
): FragmentDefinition[] {
  const fragmentsByName = {};
  createFragments().forEach((fd) => {
    fragmentsByName[fd.name] = fd;
  });

  // This function implements a BFS on the graph specified in the
  // docstring, with the provisos that the nodes for fragments are the
  // fragment names, not the fragments themselves, and that the query
  // node is implicit (in the initial value of the `frontier`).
  const requiredFragmentNames: Set<string> = new Set();
  let frontier: Set<string> = new Set();
  query.selections.forEach((selection) => {
    for (const fragment of usedFragmentNames(selection)) {
      frontier.add(fragment);
    }
  });

  while (frontier.size > 0) {
    frontier.forEach((name) => {
      requiredFragmentNames.add(name);
    });
    const newFrontier: Set<string> = new Set();
    for (const name of frontier) {
      const fragment = fragmentsByName[name];
      if (fragment == null) {
        throw new Error(`Unknown fragment: "${fragment}"`);
      }
      fragment.selections.forEach((selection) => {
        for (const fragment of usedFragmentNames(selection)) {
          newFrontier.add(fragment);
        }
      });
    }
    frontier = newFrontier;
  }

  return createFragments().filter((fd) => requiredFragmentNames.has(fd.name));
}

/**
 * Find all fragment names directly referenced by the given selection.
 * This does not include transitive fragment references.
 */
function* usedFragmentNames(selection: Selection): Iterator<string> {
  switch (selection.type) {
    case "FRAGMENT_SPREAD":
      yield selection.fragmentName;
      break;
    case "FIELD":
    case "INLINE_FRAGMENT":
      for (const subselection of selection.selections) {
        yield* usedFragmentNames(subselection);
      }
      break;
    default:
      throw new Error(`Unknown selection type: ${selection.type}`);
  }
}

/**
 * Merge structured data from the given `source` into a given subpath of
 * the `destination`. The original inputs are not modified.
 *
 * Arrays are merged by concatenation. Objects are merged by recursively
 * merging each key. Primitives are merged by replacement (the
 * destination is simply overwritten with the source).
 *
 * See test cases for examples.
 *
 * NOTE: The type of `source` should be the same as the type of
 *
 *     destination[path[0]][path[1]]...[path[path.length - 1]],
 *
 * but this constraint cannot be expressed in Flow so we just use `any`.
 */
export function merge<T>(
  destination: T,
  source: any,
  path: $ReadOnlyArray<string | number>
): T {
  if (path.length === 0) {
    return mergeDirect(destination, source);
  }

  function isObject(x) {
    return !Array.isArray(x) && typeof x === "object" && x != null;
  }
  function checkKey(key: string | number, destination: Object | Array<any>) {
    if (!(key in destination)) {
      const keyText = JSON.stringify(key);
      const destinationText = JSON.stringify(destination);
      throw new Error(
        `Key ${keyText} not found in destination: ${destinationText}`
      );
    }
  }

  const key = path[0];
  if (typeof key === "number") {
    if (!Array.isArray(destination)) {
      throw new Error(
        "Found index key for non-array destination: " +
          JSON.stringify(destination)
      );
    }
    checkKey(key, destination);
    const newValue = merge(destination[key], source, path.slice(1));
    const result = destination.slice();
    result.splice(key, 1, newValue);
    return result;
  } else if (typeof key === "string") {
    if (!isObject(destination)) {
      throw new Error(
        "Found string key for non-object destination: " +
          JSON.stringify(destination)
      );
    }
    const destinationObject: Object = (destination: any);
    checkKey(key, destinationObject);
    const newValue = merge(destinationObject[key], source, path.slice(1));
    return {
      ...destination,
      [key]: newValue,
    };
  } else {
    throw new Error(`Unexpected key: ${JSON.stringify(key)}`);
  }
}

// Merge, without the path traversal.
function mergeDirect<T>(destination: T, source: any): T {
  function isObject(x) {
    return !Array.isArray(x) && typeof x === "object" && x != null;
  }
  if (Array.isArray(source)) {
    if (!Array.isArray(destination)) {
      const destinationText = JSON.stringify(destination);
      const sourceText = JSON.stringify(source);
      throw new Error(
        "Tried to merge array into non-array: " +
          `(source: ${sourceText}; destination: ${destinationText})`
      );
    }
    return destination.concat(source);
  } else if (isObject(source)) {
    if (!isObject(destination)) {
      const destinationText = JSON.stringify(destination);
      const sourceText = JSON.stringify(source);
      throw new Error(
        "Tried to merge object into non-object: " +
          `(source: ${sourceText}; destination: ${destinationText})`
      );
    }
    const result = {...destination};
    Object.keys(source).forEach((k) => {
      result[k] = mergeDirect(result[k], source[k]);
    });
    return result;
  } else {
    if (Array.isArray(destination) || isObject(destination)) {
      const destinationText = JSON.stringify(destination);
      const sourceText = JSON.stringify(source);
      throw new Error(
        "Tried to merge primitive into non-primitive: " +
          `(source: ${sourceText}; destination: ${destinationText})`
      );
    }
    return source;
  }
}

// If a user deletes their account, then the author is null
// (the UI will show that the message was written by @ghost).
// Therefore, NullableAuthorJSON is preferred to AuthorJSON
// for most actual usage.
export type NullableAuthorJSON = AuthorJSON | null;
export type AuthorJSON = {|
  +__typename: "User" | "Bot" | "Organization",
  +id: string,
  +login: string,
  +url: string,
|};
function makePageInfo() {
  const b = build;
  return b.field("pageInfo", {}, [
    b.field("hasNextPage"),
    b.field("endCursor"),
  ]);
}
function makeAuthor() {
  const b = build;
  return b.field("author", {}, [b.fragmentSpread("whoami")]);
}

function whoamiFragment(): FragmentDefinition {
  const b = build;
  return b.fragment("whoami", "Actor", [
    b.field("__typename"),
    b.field("login"),
    b.field("url"),
    b.inlineFragment("User", [b.field("id")]),
    b.inlineFragment("Organization", [b.field("id")]),
    b.inlineFragment("Bot", [b.field("id")]),
  ]);
}

export type IssueJSON = {|
  +id: string,
  +url: string,
  +title: string,
  +body: string,
  +number: number,
  +author: NullableAuthorJSON,
  +comments: ConnectionJSON<CommentJSON>,
|};

function issuesFragment(): FragmentDefinition {
  const b = build;
  return b.fragment("issues", "IssueConnection", [
    makePageInfo(),
    b.field("nodes", {}, [
      b.field("id"),
      b.field("url"),
      b.field("title"),
      b.field("body"),
      b.field("number"),
      makeAuthor(),
      b.field("comments", {first: b.literal(PAGE_SIZE_COMMENTS)}, [
        b.fragmentSpread("comments"),
      ]),
    ]),
  ]);
}

export type PullJSON = {|
  +id: string,
  +url: string,
  +title: string,
  +body: string,
  +number: number,
  +additions: number,
  +deletions: number,
  +author: NullableAuthorJSON,
  +comments: ConnectionJSON<CommentJSON>,
  +reviews: ConnectionJSON<ReviewJSON>,
  // If present, oid is the commit SHA of the merged commit.
  +mergeCommit: ?{|+oid: string|},
|};
function pullsFragment(): FragmentDefinition {
  const b = build;
  return b.fragment("pulls", "PullRequestConnection", [
    makePageInfo(),
    b.field("nodes", {}, [
      b.field("id"),
      b.field("url"),
      b.field("title"),
      b.field("body"),
      b.field("number"),
      b.field("mergeCommit", {}, [b.field("oid")]),
      b.field("additions"),
      b.field("deletions"),
      makeAuthor(),
      b.field("comments", {first: b.literal(PAGE_SIZE_COMMENTS)}, [
        b.fragmentSpread("comments"),
      ]),
      b.field("reviews", {first: b.literal(PAGE_SIZE_REVIEWS)}, [
        b.fragmentSpread("reviews"),
      ]),
    ]),
  ]);
}

export type CommentJSON = {|
  +id: string,
  +url: string,
  +body: string,
  +author: NullableAuthorJSON,
|};
function commentsFragment(): FragmentDefinition {
  const b = build;
  // (Note: issue comments and PR comments use the same connection type.)
  return b.fragment("comments", "IssueCommentConnection", [
    makePageInfo(),
    b.field("nodes", {}, [
      b.field("id"),
      b.field("url"),
      makeAuthor(),
      b.field("body"),
    ]),
  ]);
}

export type ReviewState =
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "COMMENTED"
  | "DISMISSED"
  | "PENDING";

export type ReviewJSON = {|
  +id: string,
  +url: string,
  +body: string,
  +author: NullableAuthorJSON,
  +state: ReviewState,
  +comments: ConnectionJSON<ReviewCommentJSON>,
|};
function reviewsFragment(): FragmentDefinition {
  const b = build;
  return b.fragment("reviews", "PullRequestReviewConnection", [
    makePageInfo(),
    b.field("nodes", {}, [
      b.field("id"),
      b.field("url"),
      b.field("body"),
      makeAuthor(),
      b.field("state"),
      b.field("comments", {first: b.literal(PAGE_SIZE_REVIEW_COMMENTS)}, [
        b.fragmentSpread("reviewComments"),
      ]),
    ]),
  ]);
}

export type ReviewCommentJSON = {|
  +id: string,
  +url: string,
  +body: string,
  +author: NullableAuthorJSON,
|};
function reviewCommentsFragment(): FragmentDefinition {
  const b = build;
  return b.fragment("reviewComments", "PullRequestReviewCommentConnection", [
    makePageInfo(),
    b.field("nodes", {}, [
      b.field("id"),
      b.field("url"),
      b.field("body"),
      makeAuthor(),
    ]),
  ]);
}

/**
 * These fragments are used to construct the root query, and also to
 * fetch more pages of specific entity types.
 */
export function createFragments(): FragmentDefinition[] {
  return [
    whoamiFragment(),
    issuesFragment(),
    pullsFragment(),
    commentsFragment(),
    reviewsFragment(),
    reviewCommentsFragment(),
  ];
}

export function createVariables(repo: Repo): {+[string]: any} {
  return repo;
}
