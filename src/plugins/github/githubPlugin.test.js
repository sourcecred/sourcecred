// @flow

import {
  GithubParser,
  AUTHORS_EDGE_TYPE,
  CONTAINS_EDGE_TYPE,
} from "./githubPlugin";
import exampleRepoData from "./demoData/example-repo.json";

describe("GithubParser", () => {
  function getIssue(n) {
    const issues = exampleRepoData.data.repository.issues.nodes;
    const selected = issues.filter((x) => x.number === n);
    if (selected.length !== 1) {
      throw new Error(`Failure finding issue #${n}`);
    }
    return selected[0];
  }
  function getPR(n) {
    const pulls = exampleRepoData.data.repository.pullRequests.nodes;
    const selected = pulls.filter((x) => x.number === n);
    if (selected.length !== 1) {
      throw new Error(`Failure finding PR #${n}`);
    }
    return selected[0];
  }

  describe("whole repo parsing", () => {
    const parser = new GithubParser("sourcecred/example-repo");
    parser.addData(exampleRepoData.data);
    const danglingReferences = parser.addReferenceEdges();
    const graph = parser.graph;

    it("parses the entire example-repo as expected", () => {
      expect(graph).toMatchSnapshot();
    });

    it("there are no dangling references in the example repo", () => {
      expect(danglingReferences).toHaveLength(0);
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
      const parser = new GithubParser("sourcecred/example-repo");
      parser.addIssue(getIssue(1));
      expect(parser.graph).toMatchSnapshot();
    });

    it("parses an issue with comments (https://github.com/sourcecred/example-repo/issues/6)", () => {
      const parser = new GithubParser("sourcecred/example-repo");
      parser.addIssue(getIssue(6));
      expect(parser.graph).toMatchSnapshot();
    });
  });

  describe("pull request parsing", () => {
    it("parses a simple pull request (https://github.com/sourcecred/example-repo/pull/3)", () => {
      const parser = new GithubParser("sourcecred/example-repo");
      parser.addPullRequest(getPR(3));
      expect(parser.graph).toMatchSnapshot();
    });
    it("parses a pr with review comments (https://github.com/sourcecred/example-repo/pull/3)", () => {
      const parser = new GithubParser("sourcecred/example-repo");
      parser.addPullRequest(getPR(5));
      expect(parser.graph).toMatchSnapshot();
    });
  });

  describe("reference detection", () => {
    it("discovers a simple reference", () => {
      const parser = new GithubParser("sourcecred/example-repo");
      parser.addIssue(getIssue(1));
      parser.addIssue(getIssue(2));
      parser.addIssue(getIssue(6));
      const danglingReferences = parser.addReferenceEdges();
      expect(parser.graph).toMatchSnapshot();
      expect(danglingReferences).toHaveLength(0);
    });

    it("discovers references even when parsing issues out of order", () => {
      // Ensure that we will detect a reference from A to B, even if B hasn't
      // been discovered at the time that we parse A.
      const parserA = new GithubParser("sourcecred/example-repo");
      parserA.addIssue(getIssue(1));
      parserA.addIssue(getIssue(2));
      parserA.addIssue(getIssue(6));

      const parserB = new GithubParser("sourcecred/example-repo");
      parserB.addIssue(getIssue(2));
      parserB.addIssue(getIssue(1));
      parserB.addIssue(getIssue(6));

      expect(parserA.graph.equals(parserB.graph)).toBe(true);
    });

    it("handles dangling references gracefully", () => {
      const parser = new GithubParser("sourcecred/example-repo");
      parser.addIssue(getIssue(2));
      const danglingReferences = parser.addReferenceEdges();
      expect(danglingReferences).toMatchSnapshot();
    });
  });
});
