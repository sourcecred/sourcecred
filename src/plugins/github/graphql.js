// @flow

import type {Body, FragmentDefinition} from "../../graphql/queries";
import {build} from "../../graphql/queries";

/*
 * GitHub enforces a hard limit of no more than 100 entities per page,
 * in any single connection. GitHub also has a more global restriction
 * on the worst-case number of nodes that could be requested by a query,
 * which scales as the product of the page limits in any given sequence
 * of nested connections. (For more information, see [1].) Therefore, we
 * tune the page sizes of various entities to keep them comfortably
 * within the global capacity.
 *
 * [1]: https://developer.github.com/v4/guides/resource-limitations/#node-limit
 */
const PAGE_SIZE_ISSUES = 100;
const PAGE_SIZE_PRS = 100;
const PAGE_SIZE_COMMENTS = 20;
const PAGE_SIZE_REVIEWS = 10;
const PAGE_SIZE_REVIEW_COMMENTS = 10;

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

function createFragments(): FragmentDefinition[] {
  const b = build;
  const makePageInfo = () => b.field("pageInfo", {}, [b.field("hasNextPage")]);
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
