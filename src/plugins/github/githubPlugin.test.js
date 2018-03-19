// @flow

import {GithubParser, getNodeType, getEdgeType} from "./githubPlugin";
import exampleRepoData from "./demoData/example-repo.json";

describe("GithubParser", () => {
  describe("whole repo parsing", () => {
    const parser = new GithubParser("sourcecred/example-repo");
    parser.addData(exampleRepoData.data);
    const graph = parser.graph;

    it("parses the entire example-repo as expected", () => {
      expect(graph).toMatchSnapshot();
    });

    it("every comment has an author and container", () => {
      const comments = graph
        .getAllNodes()
        .filter((n) => getNodeType(n) === "COMMENT");
      expect(comments).not.toHaveLength(0);
      comments.forEach((c) => {
        const authorEdges = graph
          .getOutEdges(c.address)
          .filter((e) => getEdgeType(e) === "AUTHORSHIP");
        expect(authorEdges.length).toBe(1);
        const containerEdges = graph
          .getInEdges(c.address)
          .filter((e) => getEdgeType(e) === "CONTAINMENT");
        expect(containerEdges.length).toBe(1);
      });
    });

    it("every pull request and issue has an author", () => {
      const issuesAndPRs = graph
        .getAllNodes()
        .filter(
          (n) => ["ISSUE", "PULL_REQUEST"].indexOf(getNodeType(n)) !== -1
        );
      expect(issuesAndPRs).not.toHaveLength(0);
      issuesAndPRs.forEach((x) => {
        const outEdges = graph.getOutEdges(x.address);
        const authorEdges = outEdges.filter(
          (e) => getEdgeType(e) === "AUTHORSHIP"
        );
        expect(authorEdges.length).toBe(1);
      });
    });
  });

  describe("issue parsing", () => {
    it("parses a simple issue (https://github.com/sourcecred/example-repo/issues/1)", () => {
      const issue1 = exampleRepoData.data.repository.issues.nodes[0];
      expect(issue1.number).toBe(1);
      const parser = new GithubParser("sourcecred/example-repo");
      parser.addIssue(issue1);
      expect(parser.graph).toMatchSnapshot();
    });

    it("parses an issue with comments (https://github.com/sourcecred/example-repo/issues/6)", () => {
      const issue6 = exampleRepoData.data.repository.issues.nodes[3];
      expect(issue6.number).toBe(6);
      const parser = new GithubParser("sourcecred/example-repo");
      parser.addIssue(issue6);
      expect(parser.graph).toMatchSnapshot();
    });
  });

  describe("pull request parsing", () => {
    it("parses a simple pull request (https://github.com/sourcecred/example-repo/pull/3)", () => {
      const pr3 = exampleRepoData.data.repository.pullRequests.nodes[0];
      expect(pr3.number).toBe(3);
      const parser = new GithubParser("sourcecred/example-repo");
      parser.addPullRequest(pr3);
      expect(parser.graph).toMatchSnapshot();
    });
    it("parses a pr with review comments (https://github.com/sourcecred/example-repo/pull/3)", () => {
      const pr5 = exampleRepoData.data.repository.pullRequests.nodes[1];
      expect(pr5.number).toBe(5);
      const parser = new GithubParser("sourcecred/example-repo");
      parser.addPullRequest(pr5);
      expect(parser.graph).toMatchSnapshot();
    });
  });
});
