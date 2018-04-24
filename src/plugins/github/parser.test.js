// @flow

import {AUTHORS_EDGE_TYPE, CONTAINS_EDGE_TYPE} from "./types";

import {GithubParser} from "./parser";
import exampleRepoData from "./demoData/example-repo.json";

describe("GithubParser", () => {
  describe("whole repo parsing", () => {
    const parser = new GithubParser("sourcecred/example-repo");
    parser.addData(exampleRepoData);
    const graph = parser.graph;

    it("parses the entire example-repo as expected", () => {
      expect(graph).toMatchSnapshot();
    });

    it("no node or edge has undefined properties in its payload", () => {
      graph
        .getNodes()
        .forEach((n) =>
          Object.keys(n.payload).forEach((k) =>
            expect((n.payload: any)[k]).toBeDefined()
          )
        );
      graph
        .getEdges()
        .forEach((e) =>
          Object.keys(e.payload).forEach((k) =>
            expect((e.payload: any)[k]).toBeDefined()
          )
        );
    });

    it("every comment has an author and container", () => {
      const comments = graph
        .getNodes()
        .filter((n) => n.address.type === "COMMENT");
      expect(comments).not.toHaveLength(0);
      comments.forEach((c) => {
        const authorEdges = graph
          .getOutEdges(c.address)
          .filter((e) => e.address.type === AUTHORS_EDGE_TYPE);
        expect(authorEdges.length).toBe(1);
        const containerEdges = graph
          .getInEdges(c.address)
          .filter((e) => e.address.type === CONTAINS_EDGE_TYPE);
        expect(containerEdges.length).toBe(1);
      });
    });

    it("every pull request and issue has an author", () => {
      const issuesAndPRs = graph
        .getNodes()
        .filter(
          (n) => ["ISSUE", "PULL_REQUEST"].indexOf(n.address.type) !== -1
        );
      expect(issuesAndPRs).not.toHaveLength(0);
      issuesAndPRs.forEach((x) => {
        const outEdges = graph.getOutEdges(x.address);
        const authorEdges = outEdges.filter(
          (e) => e.address.type === AUTHORS_EDGE_TYPE
        );
        expect(authorEdges.length).toBe(1);
      });
    });
  });

  describe("issue parsing", () => {
    it("parses a simple issue (https://github.com/sourcecred/example-repo/issues/1)", () => {
      const issue1 = exampleRepoData.repository.issues.nodes[0];
      expect(issue1.number).toBe(1);
      const parser = new GithubParser("sourcecred/example-repo");
      parser.addIssue(issue1);
      expect(parser.graph).toMatchSnapshot();
    });

    it("parses an issue with comments (https://github.com/sourcecred/example-repo/issues/6)", () => {
      const issue6 = exampleRepoData.repository.issues.nodes[3];
      expect(issue6.number).toBe(6);
      const parser = new GithubParser("sourcecred/example-repo");
      parser.addIssue(issue6);
      expect(parser.graph).toMatchSnapshot();
    });
  });

  describe("pull request parsing", () => {
    it("parses a simple pull request (https://github.com/sourcecred/example-repo/pull/3)", () => {
      const pr3 = exampleRepoData.repository.pullRequests.nodes[0];
      expect(pr3.number).toBe(3);
      const parser = new GithubParser("sourcecred/example-repo");
      parser.addPullRequest(pr3);
      expect(parser.graph).toMatchSnapshot();
    });
    it("parses a pr with review comments (https://github.com/sourcecred/example-repo/pull/3)", () => {
      const pr5 = exampleRepoData.repository.pullRequests.nodes[1];
      expect(pr5.number).toBe(5);
      const parser = new GithubParser("sourcecred/example-repo");
      parser.addPullRequest(pr5);
      expect(parser.graph).toMatchSnapshot();
    });
  });
});
