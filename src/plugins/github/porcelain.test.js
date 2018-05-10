// @flow

import type {Address} from "../../core/address";
import {parse} from "./parser";
import exampleRepoData from "./demoData/example-github.json";
import {
  asEntity,
  Porcelain,
  Issue,
  PullRequest,
  Comment,
  Author,
} from "./porcelain";
import {
  AUTHOR_NODE_TYPE,
  COMMENT_NODE_TYPE,
  ISSUE_NODE_TYPE,
  PULL_REQUEST_NODE_TYPE,
  PULL_REQUEST_REVIEW_NODE_TYPE,
  PULL_REQUEST_REVIEW_COMMENT_NODE_TYPE,
} from "./types";

import {PLUGIN_NAME} from "./pluginName";

describe("GitHub porcelain", () => {
  const graph = parse(exampleRepoData);
  const porcelain = new Porcelain(graph);
  const repo = porcelain.repository("sourcecred", "example-github");
  function issueOrPRByNumber(n: number): Issue | PullRequest {
    const result = repo.issueOrPRByNumber(n);
    if (result == null) {
      throw new Error(`Expected Issue/PR ${n} to exist`);
    }
    return result;
  }
  describe("asEntity", () => {
    // Note: In the "wrappers" block, we test that the asEntity method works
    // for each wrapper type. Here, we just test that it fails as expected.
    it("errors when given an address with the wrong plugin name", () => {
      const addr: Address = {
        pluginName: "the magnificent foo plugin",
        id: "who are you to ask an id of the magnificent foo plugin?",
        type: "ISSUE",
      };
      expect(() => asEntity(graph, addr)).toThrow("wrong plugin name");
    });
    it("errors when given an address with a bad node type", () => {
      const addr: Address = {
        pluginName: PLUGIN_NAME,
        id: "if you keep asking for my id you will make me angry",
        type: "the foo plugin's magnificence extends to many plugins",
      };
      expect(() => asEntity(graph, addr)).toThrow("invalid type");
    });
  });
  describe("has repository finding", () => {
    it("which works for an existing repository", () => {
      expect(porcelain.repository("sourcecred", "example-github")).toEqual(
        expect.anything()
      );
    });

    it("which returns undefined when asking for a nonexistent repo", () => {
      expect(porcelain.repository("sourcecred", "bad-repo")).toBe(undefined);
    });
  });

  describe("has wrappers for", () => {
    it("Repositories", () => {
      expect(repo.url()).toBe("https://github.com/sourcecred/example-github");
      expect(repo.owner()).toBe("sourcecred");
      expect(repo.name()).toBe("example-github");
      expect(repo).toEqual(asEntity(graph, repo.address()));
    });
    it("Issues", () => {
      const issue = issueOrPRByNumber(1);
      expect(issue.title()).toBe("An example issue.");
      expect(issue.body()).toBe("This is just an example issue.");
      expect(issue.number()).toBe(1);
      expect(issue.type()).toBe(ISSUE_NODE_TYPE);
      expect(issue.url()).toBe(
        "https://github.com/sourcecred/example-github/issues/1"
      );
      expect(issue.node()).toMatchSnapshot();
      expect(issue.address()).toEqual(issue.node().address);
      expect(issue.authors().map((x) => x.login())).toEqual(["decentralion"]);
      expect(issue).toEqual(asEntity(graph, issue.address()));
    });
    describe("PullRequests", () => {
      it("Merged", () => {
        const pullRequest = PullRequest.from(issueOrPRByNumber(3));
        expect(pullRequest.body()).toBe("Oh look, it's a pull request.");
        expect(pullRequest.title()).toBe("Add README, merge via PR.");
        expect(pullRequest.url()).toBe(
          "https://github.com/sourcecred/example-github/pull/3"
        );
        expect(pullRequest.number()).toBe(3);
        expect(pullRequest.type()).toBe(PULL_REQUEST_NODE_TYPE);
        expect(pullRequest.node()).toMatchSnapshot();
        expect(pullRequest.address()).toEqual(pullRequest.node().address);
        expect(pullRequest.mergeCommitHash()).toEqual(
          "0a223346b4e6dec0127b1e6aa892c4ee0424b66a"
        );
        expect(pullRequest).toEqual(asEntity(graph, pullRequest.address()));
      });
      it("Unmerged", () => {
        const pullRequest = PullRequest.from(issueOrPRByNumber(9));
        expect(pullRequest.mergeCommitHash()).toEqual(null);
      });
    });

    it("Pull Request Reviews", () => {
      const pr = PullRequest.from(issueOrPRByNumber(5));
      const reviews = pr.reviews();
      expect(reviews).toHaveLength(2);
      expect(reviews[0].state()).toBe("CHANGES_REQUESTED");
      expect(reviews[1].state()).toBe("APPROVED");
      expect(reviews[0]).toEqual(asEntity(graph, reviews[0].address()));
    });

    it("Pull Request Review Comments", () => {
      const pr = PullRequest.from(issueOrPRByNumber(5));
      const reviews = pr.reviews();
      expect(reviews).toHaveLength(2);
      const comments = reviews[0].comments();
      expect(comments).toHaveLength(1);
      const comment = comments[0];
      expect(comment.url()).toBe(
        "https://github.com/sourcecred/example-github/pull/5#discussion_r171460198"
      );
      expect(comment.body()).toBe("seems a bit capricious");
      expect(comment.authors().map((a) => a.login())).toEqual(["wchargin"]);
      expect(comment).toEqual(asEntity(graph, comment.address()));
    });

    it("Comments", () => {
      const issue = issueOrPRByNumber(6);
      const comments = issue.comments();
      expect(comments.length).toMatchSnapshot();
      const comment = comments[0];
      expect(comment.type()).toBe(COMMENT_NODE_TYPE);
      expect(comment.body()).toBe("A wild COMMENT appeared!");
      expect(comment.url()).toBe(
        "https://github.com/sourcecred/example-github/issues/6#issuecomment-373768442"
      );
      expect(comment.node()).toMatchSnapshot();
      expect(comment.address()).toEqual(comment.node().address);
      expect(comment.authors().map((x) => x.login())).toEqual(["decentralion"]);
      expect(comment).toEqual(asEntity(graph, comment.address()));
    });

    it("Authors", () => {
      const authors = porcelain.authors();
      // So we don't need to manually update the test if a new person posts
      expect(authors.length).toMatchSnapshot();

      const decentralion = authors.find((x) => x.login() === "decentralion");
      if (decentralion == null) {
        throw new Error("Who let the lions out?");
      }
      expect(decentralion.url()).toBe("https://github.com/decentralion");
      expect(decentralion.type()).toBe(AUTHOR_NODE_TYPE);
      expect(decentralion.subtype()).toBe("USER");
      expect(decentralion.node()).toMatchSnapshot();
      expect(decentralion.address()).toEqual(decentralion.node().address);
      expect(decentralion).toEqual(asEntity(graph, decentralion.address()));
    });
  });

  describe("has type coercion that", () => {
    it("allows refining types when correct", () => {
      const _unused_issue: Issue = Issue.from(issueOrPRByNumber(1));
      const _unused_pr: PullRequest = PullRequest.from(issueOrPRByNumber(3));
      const _unused_author: Author = Author.from(
        issueOrPRByNumber(3).authors()[0]
      );
      const _unused_comment: Comment = Comment.from(
        issueOrPRByNumber(2).comments()[0]
      );
    });
    it("throws an error on bad type refinement", () => {
      expect(() => PullRequest.from(issueOrPRByNumber(1))).toThrowError(
        "to have type PULL_REQUEST"
      );
      expect(() => Issue.from(issueOrPRByNumber(3))).toThrowError(
        "to have type ISSUE"
      );
      expect(() =>
        Comment.from(issueOrPRByNumber(3).authors()[0])
      ).toThrowError("to have type COMMENT");
      expect(() =>
        Author.from(issueOrPRByNumber(2).comments()[0])
      ).toThrowError("to have type AUTHOR");
    });
  });
  describe("References", () => {
    it("via #-number", () => {
      const srcIssue = issueOrPRByNumber(2);
      const references = srcIssue.references();
      expect(references).toHaveLength(1);
      // Note: this verifies that we are not counting in-references, as
      // https://github.com/sourcecred/example-github/issues/6#issuecomment-385223316
      // references #2.

      const referenced = Issue.from(references[0]);
      expect(referenced.number()).toBe(1);
    });

    describe("by exact url", () => {
      function expectCommentToHaveSingleReference({commentNumber, type, url}) {
        const comments = issueOrPRByNumber(2).comments();
        const references = comments[commentNumber].references();
        expect(references).toHaveLength(1);
        expect(references[0].url()).toBe(url);
        expect(references[0].type()).toBe(type);
      }

      it("to an issue", () => {
        expectCommentToHaveSingleReference({
          commentNumber: 0,
          type: ISSUE_NODE_TYPE,
          url: "https://github.com/sourcecred/example-github/issues/6",
        });
      });

      it("to a comment", () => {
        expectCommentToHaveSingleReference({
          commentNumber: 1,
          type: COMMENT_NODE_TYPE,
          url:
            "https://github.com/sourcecred/example-github/issues/6#issuecomment-373768538",
        });
      });

      it("to a pull request", () => {
        expectCommentToHaveSingleReference({
          commentNumber: 2,
          type: PULL_REQUEST_NODE_TYPE,
          url: "https://github.com/sourcecred/example-github/pull/5",
        });
      });

      it("to a pull request review", () => {
        expectCommentToHaveSingleReference({
          commentNumber: 3,
          type: PULL_REQUEST_REVIEW_NODE_TYPE,
          url:
            "https://github.com/sourcecred/example-github/pull/5#pullrequestreview-100313899",
        });
      });

      it("to a pull request review comment", () => {
        expectCommentToHaveSingleReference({
          commentNumber: 4,
          type: PULL_REQUEST_REVIEW_COMMENT_NODE_TYPE,
          url:
            "https://github.com/sourcecred/example-github/pull/5#discussion_r171460198",
        });
      });

      it("to an author", () => {
        expectCommentToHaveSingleReference({
          commentNumber: 5,
          type: AUTHOR_NODE_TYPE,
          url: "https://github.com/wchargin",
        });
      });

      it("to multiple entities", () => {
        const references = issueOrPRByNumber(2)
          .comments()[6]
          .references();
        expect(references).toHaveLength(5);
      });

      it("to no entities", () => {
        const references = issueOrPRByNumber(2)
          .comments()[7]
          .references();
        expect(references).toHaveLength(0);
      });
    });

    it("References by @-author", () => {
      const pr = issueOrPRByNumber(5);
      const references = pr.references();
      expect(references).toHaveLength(1);
      const referenced = Author.from(references[0]);
      expect(referenced.login()).toBe("wchargin");
    });
  });
});
