// @flow

import {AUTHORS_EDGE_TYPE, CONTAINS_EDGE_TYPE} from "./types";
import type {NodePayload, EdgePayload} from "./types";
import {parse} from "./parser";
import type {RepositoryJSON, PullRequestJSON, IssueJSON} from "./graphql";
import {Graph} from "../../core/graph";
import exampleRepoData from "./demoData/example-repo.json";

describe("GithubParser", () => {
  describe("whole repo parsing", () => {
    const graph = parse("sourcecred/example-repo", exampleRepoData);

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
        const authorEdges = graph
          .outEdges(c.address)
          .filter((e) => e.address.type === AUTHORS_EDGE_TYPE);
        expect(authorEdges.length).toBe(1);
        const containerEdges = graph
          .inEdges(c.address)
          .filter((e) => e.address.type === CONTAINS_EDGE_TYPE);
        expect(containerEdges.length).toBe(1);
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
        const outEdges = graph.outEdges(x.address);
        const authorEdges = outEdges.filter(
          (e) => e.address.type === AUTHORS_EDGE_TYPE
        );
        expect(authorEdges.length).toBe(1);
      });
    });
  });

  function getIssue(n: number): IssueJSON {
    const issues = exampleRepoData.repository.issues.nodes;
    const selected = issues.filter((x) => x.number === n);
    if (selected.length !== 1) {
      throw new Error(`Failure finding issue #${n}`);
    }
    return selected[0];
  }
  function getPR(n: number): PullRequestJSON {
    const pulls = exampleRepoData.repository.pullRequests.nodes;
    const selected = pulls.filter((x) => x.number === n);
    if (selected.length !== 1) {
      throw new Error(`Failure finding PR #${n}`);
    }
    return selected[0];
  }
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
    return parse("sourcecred/example-repo", exampleData);
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
});
