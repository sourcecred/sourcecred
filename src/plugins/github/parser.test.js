// @flow

import {AUTHORS_EDGE_TYPE, CONTAINS_EDGE_TYPE} from "./types";
import type {NodePayload, EdgePayload} from "./types";
import {parse} from "./parser";
import type {RepositoryJSON, PullRequestJSON, IssueJSON} from "./graphql";
import {Graph} from "../../core/graph";
import exampleRepoData from "./demoData/example-repo.json";

describe("GithubParser", () => {
  function getIssue(n): IssueJSON {
    const issues = exampleRepoData.repository.issues.nodes;
    const selected = issues.filter((x) => x.number === n);
    if (selected.length !== 1) {
      throw new Error(`Failure finding issue #${n}`);
    }
    return selected[0];
  }
  function getPR(n): PullRequestJSON {
    const pulls = exampleRepoData.repository.pullRequests.nodes;
    const selected = pulls.filter((x) => x.number === n);
    if (selected.length !== 1) {
      throw new Error(`Failure finding PR #${n}`);
    }
    return selected[0];
  }

  describe("whole repo parsing", () => {
    const graph = parse(exampleRepoData);

    it("parses the entire example-repo as expected", () => {
      expect(graph).toMatchSnapshot();
    });

    it("no node or edge has undefined properties in its payload", () => {
      graph
        .nodes()
        .forEach((n) =>
          Object.keys(n.payload).forEach((k) =>
            expect((n.payload: any)[k]).toBeDefined()
          )
        );
      graph
        .edges()
        .forEach((e) =>
          Object.keys(e.payload).forEach((k) =>
            expect((e.payload: any)[k]).toBeDefined()
          )
        );
    });

    it("every comment has an author and container", () => {
      const comments = graph
        .nodes()
        .filter((n) => n.address.type === "COMMENT");
      expect(comments).not.toHaveLength(0);
      comments.forEach((c) => {
        const authorNeighbors = graph.neighborhood(c.address, {
          edgeType: AUTHORS_EDGE_TYPE,
          direction: "OUT",
        });
        expect(authorNeighbors.length).toBe(1);
        const containerNeighbors = graph.neighborhood(c.address, {
          direction: "IN",
          edgeType: CONTAINS_EDGE_TYPE,
        });
        expect(containerNeighbors.length).toBe(1);
      });
    });

    it("every pull request and issue has an author", () => {
      const issuesAndPRs = graph
        .nodes()
        .filter(
          (n) => ["ISSUE", "PULL_REQUEST"].indexOf(n.address.type) !== -1
        );
      expect(issuesAndPRs).not.toHaveLength(0);
      issuesAndPRs.forEach((x) => {
        const authorNeighbors = graph.neighborhood(x.address, {
          edgeType: AUTHORS_EDGE_TYPE,
          direction: "OUT",
        });
        expect(authorNeighbors.length).toBe(1);
      });
    });
  });

  type ExampleInput = {
    issues?: number[],
    prs?: number[],
  };
  function parseExample({
    issues: issueNums = [],
    prs: prNums = [],
  }: ExampleInput): Graph<NodePayload, EdgePayload> {
    const issues = issueNums.map(getIssue);
    const pullRequests = prNums.map(getPR);
    const exampleData: RepositoryJSON = {
      repository: {
        id: exampleRepoData.repository.id,
        issues: {
          nodes: issues,
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
        pullRequests: {
          nodes: pullRequests,
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    };
    return parse(exampleData);
  }

  describe("issue parsing", () => {
    it("parses a simple issue (https://github.com/sourcecred/example-repo/issues/1)", () => {
      expect(parseExample({issues: [1]})).toMatchSnapshot();
    });

    it("parses an issue with comments (https://github.com/sourcecred/example-repo/issues/6)", () => {
      expect(parseExample({issues: [6]})).toMatchSnapshot();
    });
  });

  describe("pull request parsing", () => {
    it("parses a simple pull request (https://github.com/sourcecred/example-repo/pull/3)", () => {
      expect(parseExample({prs: [3]})).toMatchSnapshot();
    });
    it("parses a pr with review comments (https://github.com/sourcecred/example-repo/pull/3)", () => {
      expect(parseExample({prs: [5]})).toMatchSnapshot();
    });
  });

  describe("reference detection", () => {
    // These tests are included mostly for regression testing. To be persuaded that the references
    // were added correctly, see the reference api tests in api.test.js. Those tests are much
    // easier to read and to be persuaded that the behavior is working as intended.
    it("discovers a simple reference", () => {
      expect(parseExample({issues: [1, 2, 6]})).toMatchSnapshot();
    });

    it("discovers references even when parsing issues out of order", () => {
      // Ensure that we will detect a reference from A to B, even if B hasn't
      // been discovered at the time that we parse A.
      const graphA = parseExample({issues: [1, 2, 6]});
      const graphB = parseExample({issues: [6, 2, 1]});
      expect(graphA.equals(graphB)).toBe(true);
    });

    it("handles dangling references gracefully", () => {
      const graph = parseExample({issues: [2]});
      expect(graph).toMatchSnapshot();
    });
  });
});
