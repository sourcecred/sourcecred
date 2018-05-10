// @flow

import type {Address} from "../../core/address";
import {parse} from "./parser";
import exampleRepoData from "./demoData/example-github.json";
import type {Entity} from "./porcelain";
import {
  asEntity,
  Porcelain,
  Repository,
  Issue,
  PullRequest,
  PullRequestReview,
  PullRequestReviewComment,
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

import {nodeDescription} from "./render";

import {PLUGIN_NAME} from "./pluginName";

describe("GitHub porcelain", () => {
  const graph = parse(exampleRepoData);
  const porcelain = new Porcelain(graph);
  const repo = porcelain.repository("sourcecred", "example-github");

  function expectPropertiesToMatchSnapshot<T: Entity>(
    entities: $ReadOnlyArray<T>,
    extractor: (T) => mixed
  ) {
    const urlToProperty = {};
    entities.forEach((e) => {
      if (e.url() in urlToProperty) {
        throw new Error(`Duplicate url: ${e.url()}`);
      }
      urlToProperty[e.url()] = extractor(e);
    });
    expect(urlToProperty).toMatchSnapshot();
  }

  function issueOrPRByNumber(n: number): Issue | PullRequest {
    const result = repo.issueOrPRByNumber(n);
    if (result == null) {
      throw new Error(`Expected Issue/PR ${n} to exist`);
    }
    return result;
  }

  const issue = issueOrPRByNumber(2);
  const comment = issue.comments()[0];
  const pullRequest = PullRequest.from(issueOrPRByNumber(5));
  const pullRequestReview = pullRequest.reviews()[0];
  const pullRequestReviewComment = pullRequestReview.comments()[0];
  const author = issue.authors()[0];
  const allWrappers = [
    issue,
    pullRequest,
    comment,
    pullRequestReview,
    pullRequestReviewComment,
    author,
  ];

  it("all wrappers provide a type() method", () => {
    expectPropertiesToMatchSnapshot(allWrappers, (e) => e.type());
  });

  it("all wrappers provide a url() method", () => {
    expectPropertiesToMatchSnapshot(allWrappers, (e) => e.url());
  });

  it("all wrappers provide an address() method", () => {
    allWrappers.forEach((w) => {
      const addr = w.address();
      const url = w.url();
      const type = w.type();
      expect(addr.id).toBe(url);
      expect(addr.type).toBe(type);
      expect(addr.pluginName).toBe(PLUGIN_NAME);
    });
  });

  it("all wrappers provide a node() method", () => {
    allWrappers.forEach((w) => {
      const node = w.node();
      const addr = w.address();
      expect(node.address).toEqual(addr);
    });
  });

  describe("type verifiers", () => {
    it("are provided by all wrappers", () => {
      // Check each one individually to verify the flowtypes
      const _unused_repo: Repository = Repository.from(repo);
      const _unused_issue: Issue = Issue.from(issue);
      const _unused_pullRequest: PullRequest = PullRequest.from(pullRequest);
      const _unused_comment: Comment = Comment.from(comment);
      const _unused_pullRequestReview: PullRequestReview = PullRequestReview.from(
        pullRequestReview
      );
      const _unused_pullRequestReviewComment: PullRequestReviewComment = PullRequestReviewComment.from(
        pullRequestReviewComment
      );
      const _unused_author: Author = Author.from(author);
      // Check them programatically so that if we add another wrapper, we can't forget to update.
      allWrappers.forEach((e) => {
        expect(e.constructor.from(e)).toEqual(e);
      });
    });
    it("and errors are thrown when used incorrectly", () => {
      expect(() => Repository.from(issue)).toThrowError("to have type");
      expect(() => Issue.from(repo)).toThrowError("to have type");
      expect(() => Comment.from(repo)).toThrowError("to have type");
      expect(() => PullRequest.from(repo)).toThrowError("to have type");
      expect(() => PullRequestReview.from(repo)).toThrowError("to have type");
      expect(() => PullRequestReviewComment.from(repo)).toThrowError(
        "to have type"
      );
      expect(() => Author.from(repo)).toThrowError("to have type");
    });
  });

  describe("posts", () => {
    const allPosts = [
      issue,
      pullRequest,
      pullRequestReview,
      pullRequestReviewComment,
      comment,
    ];
    it("have parents", () => {
      expectPropertiesToMatchSnapshot(allPosts, (e) => e.parent().url());
    });
    it("have bodies", () => {
      expectPropertiesToMatchSnapshot(allPosts, (e) => e.body());
    });
    it("have authors", () => {
      expectPropertiesToMatchSnapshot(allPosts, (e) =>
        e.authors().map((a) => a.login())
      );
    });
    it("have references", () => {
      expectPropertiesToMatchSnapshot(allPosts, (e) =>
        e.references().map((r) => r.url())
      );
    });
  });

  describe("issues and pull requests", () => {
    const issuesAndPRs = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
      issueOrPRByNumber(n)
    );
    it("have numbers", () => {
      expectPropertiesToMatchSnapshot(issuesAndPRs, (e) => e.number());
    });
    it("have titles", () => {
      expectPropertiesToMatchSnapshot(issuesAndPRs, (e) => e.title());
    });
    it("have comments", () => {
      expectPropertiesToMatchSnapshot(issuesAndPRs, (e) =>
        e.comments().map((c) => c.url())
      );
    });
  });

  describe("pull requests", () => {
    const prs = [
      PullRequest.from(issueOrPRByNumber(3)),
      PullRequest.from(issueOrPRByNumber(5)),
      PullRequest.from(issueOrPRByNumber(9)),
    ];
    it("have mergeCommitHashes", () => {
      expectPropertiesToMatchSnapshot(prs, (e) => e.mergeCommitHash());
    });

    it("have reviews", () => {
      expectPropertiesToMatchSnapshot(prs, (e) =>
        e.reviews().map((r) => r.url())
      );
    });
  });

  describe("pull request reviews", () => {
    const reviews = pullRequest.reviews();
    it("have review comments", () => {
      expectPropertiesToMatchSnapshot(reviews, (e) =>
        e.comments().map((e) => e.url())
      );
    });
    it("have states", () => {
      expectPropertiesToMatchSnapshot(reviews, (e) => e.state());
    });
  });

  describe("asEntity", () => {
    it("works for each wrapper", () => {
      allWrappers.forEach((w) => {
        expect(asEntity(w.graph, w.address())).toEqual(w);
      });
    });
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

  it("nodes have nice descriptions", () => {
    // This test really should be in its own file, but for expedience I am
    // putting it here.  TODO: Refactor general purpose testutils out of this
    // file, and move this test to render.test.js (assuming we don't move the
    // description method into the porcelain anyway...)
    expectPropertiesToMatchSnapshot(allWrappers, (e) =>
      nodeDescription(e.graph, e.address())
    );
  });
});
