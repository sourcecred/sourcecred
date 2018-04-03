// @flow

import type {Continuation} from "./graphql";
import {build} from "../../graphql/queries";
import {
  PAGE_LIMIT,
  continuationsFromQuery,
  continuationsFromContinuation,
} from "./graphql";

describe("graphql", () => {
  describe("creates continuations", () => {
    const makeAuthor = (name) => ({
      __typename: "User",
      login: name,
      id: `opaque-user-${name}`,
    });
    function makeData(hasNextPageFor: {
      issues: boolean,
      prs: boolean,
      issueComments: boolean,
      prComments: boolean,
      reviews: boolean,
      reviewComments: boolean,
    }) {
      return {
        repository: {
          id: "opaque-repo",
          issues: {
            pageInfo: {
              hasNextPage: hasNextPageFor.issues,
              endCursor: "opaque-cursor-issues",
            },
            nodes: [
              {
                id: "opaque-issue1",
                title: "A pressing issue",
                body: "<button>A</button>",
                number: 1,
                author: makeAuthor("decentralion"),
                comments: {
                  pageInfo: {
                    hasNextPage: hasNextPageFor.issueComments,
                    endCursor: "opaque-cursor-issue1comments",
                  },
                  nodes: [
                    {
                      id: "opaque-issue1comment1",
                      author: makeAuthor("wchargin"),
                      body: "I wish pancakes were still in vogue.",
                      url: "opaque://issue/1/comment/1",
                    },
                  ],
                },
              },
            ],
          },
          pullRequests: {
            pageInfo: {
              hasNextPage: hasNextPageFor.prs,
              endCursor: "opaque-cursor-prs",
            },
            nodes: [
              {
                id: "opaque-pr2",
                title: "texdoc exam",
                body: "What is air?",
                number: 2,
                author: makeAuthor("wchargin"),
                comments: {
                  pageInfo: {
                    hasNextPage: hasNextPageFor.prComments,
                    endCursor: "opaque-cursor-pr2comments",
                  },
                  nodes: [
                    {
                      id: "opaque-pr2comment1",
                      author: makeAuthor("decentralion"),
                      body: "Why is there air?",
                      url: "opaque://pr/2/comment/1",
                    },
                  ],
                },
                reviews: {
                  pageInfo: {
                    hasNextPage: hasNextPageFor.reviews,
                    endCursor: "opaque-cursor-pr2reviews",
                  },
                  nodes: [
                    {
                      id: "opaque-pr2review1",
                      body: "Hmmm...",
                      author: makeAuthor("decentralion"),
                      state: "CHANGES_REQUESTED",
                      comments: {
                        pageInfo: {
                          hasNextPage: hasNextPageFor.reviewComments,
                          endCursor: "opaque-cursor-pr2review1comments",
                        },
                        nodes: [
                          {
                            id: "opaque-pr2review1comment1",
                            body: "What if there were no air?",
                            url: "opaque://pr/2/review/1/comment/1",
                            author: makeAuthor("decentralion"),
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      };
    }
    function makeContinuations(): {[string]: Continuation} {
      const b = build;
      return {
        issues: {
          enclosingNodeType: "REPOSITORY",
          enclosingNodeId: "opaque-repo",
          selections: [
            b.inlineFragment("Repository", [
              b.field(
                "issues",
                {
                  first: b.literal(PAGE_LIMIT),
                  after: b.literal("opaque-cursor-issues"),
                },
                [b.fragmentSpread("issues")]
              ),
            ]),
          ],
          destinationPath: ["repository"],
        },
        prs: {
          enclosingNodeType: "REPOSITORY",
          enclosingNodeId: "opaque-repo",
          selections: [
            b.inlineFragment("Repository", [
              b.field(
                "pullRequests",
                {
                  first: b.literal(PAGE_LIMIT),
                  after: b.literal("opaque-cursor-prs"),
                },
                [b.fragmentSpread("prs")]
              ),
            ]),
          ],
          destinationPath: ["repository"],
        },
        issueComments: {
          enclosingNodeType: "ISSUE",
          enclosingNodeId: "opaque-issue1",
          selections: [
            b.inlineFragment("Issue", [
              b.field(
                "comments",
                {
                  first: b.literal(PAGE_LIMIT),
                  after: b.literal("opaque-cursor-issue1comments"),
                },
                [b.fragmentSpread("comments")]
              ),
            ]),
          ],
          destinationPath: ["repository", "issues", "nodes", 0],
        },
        prComments: {
          enclosingNodeType: "PULL_REQUEST",
          enclosingNodeId: "opaque-pr2",
          selections: [
            b.inlineFragment("PullRequest", [
              b.field(
                "comments",
                {
                  first: b.literal(PAGE_LIMIT),
                  after: b.literal("opaque-cursor-pr2comments"),
                },
                [b.fragmentSpread("comments")]
              ),
            ]),
          ],
          destinationPath: ["repository", "pullRequests", "nodes", 0],
        },
        reviews: {
          enclosingNodeType: "PULL_REQUEST",
          enclosingNodeId: "opaque-pr2",
          selections: [
            b.inlineFragment("PullRequest", [
              b.field(
                "reviews",
                {
                  first: b.literal(PAGE_LIMIT),
                  after: b.literal("opaque-cursor-pr2reviews"),
                },
                [b.fragmentSpread("reviews")]
              ),
            ]),
          ],
          destinationPath: ["repository", "pullRequests", "nodes", 0],
        },
        reviewComments: {
          enclosingNodeType: "PULL_REQUEST_REVIEW",
          enclosingNodeId: "opaque-pr2review1",
          selections: [
            b.inlineFragment("PullRequestReview", [
              b.field(
                "comments",
                {
                  first: b.literal(PAGE_LIMIT),
                  after: b.literal("opaque-cursor-pr2review1comments"),
                },
                [b.fragmentSpread("reviewComments")]
              ),
            ]),
          ],
          destinationPath: [
            "repository",
            "pullRequests",
            "nodes",
            0,
            "reviews",
            "nodes",
            0,
          ],
        },
      };
    }

    test("from a top-level result with lots of continuations", () => {
      const data = makeData({
        issues: true,
        prs: true,
        issueComments: true,
        prComments: true,
        reviews: true,
        reviewComments: true,
      });
      const result = Array.from(continuationsFromQuery(data));
      const expectedContinuations: Continuation[] = (() => {
        const continuations = makeContinuations();
        return [
          continuations.issues,
          continuations.prs,
          continuations.issueComments,
          continuations.prComments,
          continuations.reviews,
          continuations.reviewComments,
        ];
      })();
      expectedContinuations.forEach((x) => {
        expect(result).toContainEqual(x);
      });
      expect(result).toHaveLength(expectedContinuations.length);
    });

    test("from a top-level result with sparse continuations", () => {
      // Here, some elements have continuations, but are children of
      // elements without continuations. This tests that we always recur
      // through the whole structure.
      const data = makeData({
        issues: true,
        prs: false,
        issueComments: false,
        prComments: true,
        reviews: false,
        reviewComments: true,
      });
      const result = Array.from(continuationsFromQuery(data));
      const expectedContinuations: Continuation[] = (() => {
        const continuations = makeContinuations();
        return [
          continuations.issues,
          continuations.prComments,
          continuations.reviewComments,
        ];
      })();
      expectedContinuations.forEach((x) => {
        expect(result).toContainEqual(x);
      });
      expect(result).toHaveLength(expectedContinuations.length);
    });

    describe("from another continuation", () => {
      function makeContinuationResult(hasNextPages: boolean) {
        return {
          issues: {
            pageInfo: {
              hasNextPage: hasNextPages,
              endCursor: "opaque-cursor-moreissues",
            },
            nodes: [
              {
                id: "opaque-issue3",
                title: "todo",
                body: "it means everything",
                number: 3,
                author: makeAuthor("wchargin"),
                comments: {
                  pageInfo: {
                    hasNextPage: hasNextPages,
                    endCursor: "opaque-cursor-issue3comments",
                  },
                  nodes: [
                    {
                      id: "opaque-issue3comment1",
                      author: makeAuthor("decentralion"),
                      body:
                        "if it means everything, does it really mean anything?",
                      url: "opaque://issue/3/comment/1",
                    },
                  ],
                },
              },
            ],
          },
        };
      }
      test("when there are more pages at multiple levels of nesting", () => {
        const continuation = makeContinuations().issues;
        const continuationResult = makeContinuationResult(true);
        const result = Array.from(
          continuationsFromContinuation(continuationResult, continuation)
        );
        const b = build;
        const expectedContinuations = [
          {
            enclosingNodeType: "REPOSITORY",
            enclosingNodeId: "opaque-repo",
            selections: [
              b.inlineFragment("Repository", [
                b.field(
                  "issues",
                  {
                    first: b.literal(PAGE_LIMIT),
                    after: b.literal("opaque-cursor-moreissues"),
                  },
                  [b.fragmentSpread("issues")]
                ),
              ]),
            ],
            destinationPath: ["repository"],
          },
          {
            enclosingNodeType: "ISSUE",
            enclosingNodeId: "opaque-issue3",
            selections: [
              b.inlineFragment("Issue", [
                b.field(
                  "comments",
                  {
                    first: b.literal(PAGE_LIMIT),
                    after: b.literal("opaque-cursor-issue3comments"),
                  },
                  [b.fragmentSpread("comments")]
                ),
              ]),
            ],
            destinationPath: ["repository", "issues", "nodes", 0],
          },
        ];
        expectedContinuations.forEach((x) => {
          expect(result).toContainEqual(x);
        });
        expect(result).toHaveLength(expectedContinuations.length);
      });
      test("when there are no more pages", () => {
        const continuation = makeContinuations().issues;
        const continuationResult = makeContinuationResult(false);
        const result = Array.from(
          continuationsFromContinuation(continuationResult, continuation)
        );
        expect(result).toHaveLength(0);
      });
    });
  });
});
