// @flow

import type {Continuation} from "./graphql";
import {build} from "../../graphql/queries";
import {
  PAGE_LIMIT,
  continuationsFromQuery,
  continuationsFromContinuation,
  merge,
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

  describe("#merge", () => {
    describe("merges at the root", () => {
      it("replacing primitive numbers", () => {
        expect(merge(3, 5, [])).toEqual(5);
      });

      it("replacing primitive strings", () => {
        expect(merge("three", "five", [])).toEqual("five");
      });

      it("replacing a primitive string with null", () => {
        expect(merge("three", null, [])).toEqual(null);
      });

      it("replacing null with a number", () => {
        expect(merge(null, 3, [])).toEqual(3);
      });

      it("concatenating arrays", () => {
        expect(merge([1, 2], [3, 4], [])).toEqual([1, 2, 3, 4]);
      });

      it("merging objects", () => {
        const destination = {a: 1, b: 2};
        const source = {c: 3, d: 4};
        const expected = {a: 1, b: 2, c: 3, d: 4};
        expect(merge(destination, source, [])).toEqual(expected);
      });

      it("overwriting primitives in an object", () => {
        const destination = {hasNextPage: true, endCursor: "cursor-aaa"};
        const source = {hasNextPage: false, endCursor: "cursor-bbb"};
        expect(merge(destination, source, [])).toEqual(source);
      });

      it("merging complex structures recursively", () => {
        const destination = {
          fst: {a: 1, b: 2},
          snd: {e: 5, f: 6},
          fruits: ["apple", "banana"],
          letters: ["whiskey", "x-ray"],
        };
        const source = {
          fst: {c: 3, d: 4},
          snd: {g: 7, h: 8},
          fruits: ["cherry", "durian"],
          letters: ["yankee", "zulu"],
        };
        const expected = {
          fst: {a: 1, b: 2, c: 3, d: 4},
          snd: {e: 5, f: 6, g: 7, h: 8},
          fruits: ["apple", "banana", "cherry", "durian"],
          letters: ["whiskey", "x-ray", "yankee", "zulu"],
        };
        expect(merge(destination, source, [])).toEqual(expected);
      });
    });

    describe("traverses", () => {
      it("down an object path", () => {
        const destination = {
          child: {
            grandchild: {
              one: 1,
              two: 2,
            },
            otherGrandchild: "world",
          },
          otherChild: "hello",
        };
        const source = {
          three: 3,
          four: 4,
        };
        const expected = {
          child: {
            grandchild: {
              one: 1,
              two: 2,
              three: 3,
              four: 4,
            },
            otherGrandchild: "world",
          },
          otherChild: "hello",
        };
        expect(merge(destination, source, ["child", "grandchild"])).toEqual(
          expected
        );
      });

      it("down an array path", () => {
        const destination = [["change me", [1, 2]], ["ignore me", [5, 6]]];
        const source = [3, 4];
        const expected = [["change me", [1, 2, 3, 4]], ["ignore me", [5, 6]]];
        expect(merge(destination, source, [0, 1])).toEqual(expected);
      });

      it("down a path of mixed objects and arrays", () => {
        const destination = {
          families: [
            {
              childCount: 3,
              children: [
                {name: "Alice", hobbies: ["acupuncture"]},
                {name: "Bob", hobbies: ["billiards"]},
                {name: "Cheryl", hobbies: ["chess"]},
              ],
            },
            {
              childCount: 0,
              children: [],
            },
          ],
        };
        const path = ["families", 0, "children", 2, "hobbies"];
        const source = ["charades", "cheese-rolling"];
        const expected = {
          families: [
            {
              childCount: 3,
              children: [
                {name: "Alice", hobbies: ["acupuncture"]},
                {name: "Bob", hobbies: ["billiards"]},
                {
                  name: "Cheryl",
                  hobbies: ["chess", "charades", "cheese-rolling"],
                },
              ],
            },
            {childCount: 0, children: []},
          ],
        };
        expect(merge(destination, source, path)).toEqual(expected);
      });
    });

    describe("doesn't mutate its inputs", () => {
      it("when merging arrays", () => {
        const destination = [1, 2];
        const source = [3, 4];
        merge(destination, source, []);
        expect(destination).toEqual([1, 2]);
        expect(source).toEqual([3, 4]);
      });

      it("when merging objects", () => {
        const destination = {a: 1, b: 2};
        const source = {c: 3, d: 4};
        merge(destination, source, []);
        expect(destination).toEqual({a: 1, b: 2});
        expect(source).toEqual({c: 3, d: 4});
      });

      test("along an object path", () => {
        const makeDestination = () => ({
          child: {
            grandchild: {
              one: 1,
              two: 2,
            },
            otherGrandchild: "world",
          },
          otherChild: "hello",
        });
        const makeSource = () => ({
          three: 3,
          four: 4,
        });
        const destination = makeDestination();
        const source = makeSource();
        merge(destination, source, ["child", "grandchild"]);
        expect(destination).toEqual(makeDestination());
        expect(source).toEqual(makeSource());
      });

      test("along an array path", () => {
        const makeDestination = () => [
          ["change me", [1, 2]],
          ["ignore me", [5, 6]],
        ];
        const makeSource = () => [3, 4];
        const destination = makeDestination();
        const source = makeSource();
        merge(destination, source, [0, 1]);
        expect(destination).toEqual(makeDestination());
        expect(source).toEqual(makeSource());
      });
    });

    describe("complains", () => {
      describe("about bad keys", () => {
        it("when given a numeric key into a primitive", () => {
          expect(() => merge(123, 234, [0])).toThrow(/non-array/);
        });
        it("when given a numeric key into null", () => {
          expect(() => merge(null, null, [0])).toThrow(/non-array/);
        });
        describe("when given a numeric key into an object", () => {
          test("for the usual case of an object with string keys", () => {
            expect(() => merge({a: 1}, {b: 2}, [0])).toThrow(/non-array/);
          });
          test("even when the object has the stringifed version of the key", () => {
            expect(() =>
              merge({"0": "zero", "1": "one"}, {"2": "two"}, [0])
            ).toThrow(/non-array/);
          });
        });

        it("when given a string key into a primitive", () => {
          expect(() => merge(123, 234, ["k"])).toThrow(/non-object/);
        });
        it("when given a string key into null", () => {
          expect(() => merge(null, null, ["k"])).toThrow(/non-object/);
        });
        it("when given a string key into an array", () => {
          expect(() => merge([1, 2], [1, 2], ["k"])).toThrow(/non-object/);
        });

        it("when given a non-string, non-numeric key", () => {
          const badKey: any = false;
          expect(() => merge({a: 1}, {b: 2}, [badKey])).toThrow(/key.*false/);
        });

        it("when given a non-existent string key", () => {
          expect(() => merge({a: 1}, {b: 2}, ["c"])).toThrow(/"c" not found/);
        });
        it("when given a non-existent numeric key", () => {
          expect(() => merge([1], [2], [3])).toThrow(/3 not found/);
        });
      });

      describe("about source/destination mismatch", () => {
        it("when merging an array into a non-array", () => {
          const re = () => /array into non-array/;
          expect(() => merge({a: 1}, [2], [])).toThrow(re());
          expect(() => merge(true, [2], [])).toThrow(re());
        });
        it("when merging an object into a non-object", () => {
          const re = () => /object into non-object/;
          expect(() => merge([1], {b: 2}, [])).toThrow(re());
          expect(() => merge(true, {b: 2}, [])).toThrow(re());
        });
        it("when merging a primitive into a non-primitive", () => {
          const re = () => /primitive into non-primitive/;
          expect(() => merge([], true, [])).toThrow(re());
          expect(() => merge({a: 1}, true, [])).toThrow(re());
        });
      });
    });
  });
});
