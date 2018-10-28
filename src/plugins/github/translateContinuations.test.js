// @flow

import translateContinuations from "./translateContinuations";

describe("plugins/github/translateContinuations", () => {
  describe("translateContinuations", () => {
    it("raises a warning if the defaultBranchRef is not a commit", () => {
      const exampleData = {
        repository: {
          defaultBranchRef: {
            id: "ref-id",
            target: {
              __typename: "Tree",
              id: "tree-id",
              oid: "123",
            },
          },
          id: "repo-id",
          issues: {
            nodes: [],
            pageInfo: {hasNextPage: false, endCursor: null},
          },
          name: "bar",
          owner: {
            __typename: "User",
            id: "user-id",
            login: "foo",
            url: "https://github.com/foo",
          },
          pulls: {
            nodes: [],
            pageInfo: {hasNextPage: false, endCursor: null},
          },
          url: "https://github.com/foo/bar",
        },
      };
      const {result, warnings} = translateContinuations(exampleData);
      expect(result.defaultBranchRef).toEqual({
        __typename: "Ref",
        id: "ref-id",
        target: {__typename: "Tree", id: "tree-id", oid: "123"},
      });
      expect(warnings).toEqual([
        {
          type: "NON_COMMIT_REF_TARGET",
          target: {__typename: "Tree", id: "tree-id", oid: "123"},
        },
      ]);
    });

    it("raises a warning if there is an unknown commit", () => {
      const exampleData = {
        repository: {
          defaultBranchRef: null,
          id: "repo-id",
          issues: {
            nodes: [],
            pageInfo: {hasNextPage: false, endCursor: null},
          },
          name: "bar",
          owner: {
            __typename: "User",
            id: "user-id",
            login: "foo",
            url: "https://github.com/foo",
          },
          pulls: {
            nodes: [
              {
                id: "pr-id",
                number: 1,
                author: {
                  __typename: "Bot",
                  id: "bot-id",
                  login: "baz",
                  url: "https://github.com/baz",
                },
                additions: 7,
                deletions: 9,
                comments: {
                  nodes: [],
                  pageInfo: {hasNextPage: false, endCursor: null},
                },
                reviews: {
                  nodes: [],
                  pageInfo: {hasNextPage: false, endCursor: null},
                },
                reactions: {
                  nodes: [],
                  pageInfo: {hasNextPage: false, endCursor: null},
                },
                mergeCommit: {
                  id: "commit-id",
                  author: {
                    date: "2001-02-03T04:05:06",
                    user: null,
                  },
                  message: "where are my parents?",
                  oid: "456",
                  parents: {
                    nodes: [{oid: "789"}],
                    pageInfo: {hasNextPage: false, endCursor: "cursor-parents"},
                  },
                  url: "https://github.com/foo/bar/commit/456",
                },
                title: "something",
                body: "whatever",
                url: "https://github.com/foo/bar/pull/1",
              },
            ],
            pageInfo: {hasNextPage: false, endCursor: "cursor-pulls"},
          },
          url: "https://github.com/foo/bar",
        },
      };
      const {result, warnings} = translateContinuations(exampleData);
      const pr = result.pullRequests[0];
      if (pr == null) {
        throw new Error(String(pr));
      }
      expect(pr.mergeCommit).toEqual({
        __typename: "Commit",
        id: "commit-id",
        author: {
          date: "2001-02-03T04:05:06",
          user: null,
        },
        message: "where are my parents?",
        oid: "456",
        parents: [
          /* empty! */
        ],
        url: "https://github.com/foo/bar/commit/456",
      });
      expect(warnings).toEqual([
        {
          type: "UNKNOWN_PARENT_OID",
          child: "456",
          parent: "789",
        },
      ]);
    });
  });
});
