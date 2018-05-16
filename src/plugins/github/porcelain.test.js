// @flow

import {parse} from "./parser";
import exampleRepoData from "./demoData/example-github.json";
import {
  AuthorReference,
  AuthorPorcelain,
  CommentReference,
  CommentPorcelain,
  GithubReference,
  GraphPorcelain,
  IssueReference,
  IssuePorcelain,
  PullRequestReference,
  PullRequestPorcelain,
  PullRequestReviewReference,
  PullRequestReviewPorcelain,
  PullRequestReviewCommentReference,
  PullRequestReviewCommentPorcelain,
  RepositoryReference,
  RepositoryPorcelain,
} from "./porcelain";
import type {NodePayload} from "./types";
import {
  AUTHOR_NODE_TYPE,
  COMMENT_NODE_TYPE,
  ISSUE_NODE_TYPE,
  PULL_REQUEST_NODE_TYPE,
  PULL_REQUEST_REVIEW_NODE_TYPE,
  PULL_REQUEST_REVIEW_COMMENT_NODE_TYPE,
} from "./types";

import {nodeDescription} from "./render";

describe("GitHub porcelain", () => {
  const graph = parse(exampleRepoData);
  const porcelain = new GraphPorcelain(graph);
  const repoRef = porcelain.repository("sourcecred", "example-github");
  if (repoRef == null) {
    throw new Error("Where did the repository go?");
  }
  const repo = repoRef.get();
  if (repo == null) {
    throw new Error("Where did the repository go?");
  }

  function expectPropertiesToMatchSnapshot<T: {+url: () => string}>(
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

  function issueByNumber(n: number): IssuePorcelain {
    const ref = repo.ref().issueByNumber(n);
    if (ref == null) {
      throw new Error(`Expected issue #${n} to exist`);
    }
    const result = ref.get();
    if (result == null) {
      throw new Error(`Expected issue #${n} to exist`);
    }
    return result;
  }

  function prByNumber(n: number): PullRequestPorcelain {
    const ref = repo.ref().pullRequestByNumber(n);
    if (ref == null) {
      throw new Error(`Expected pull request #${n} to exist`);
    }
    const result = ref.get();
    if (result == null) {
      throw new Error(`Expected pull request #${n} to exist`);
    }
    return result;
  }

  function issueOrPrByNumber(n: number): IssuePorcelain | PullRequestPorcelain {
    const ref =
      repo.ref().issueByNumber(n) || repo.ref().pullRequestByNumber(n);
    if (ref == null) {
      throw new Error(`Expected Issue/PR #${n} to exist`);
    }
    const result = ref.get();
    if (result == null) {
      throw new Error(`Expected Issue/PR #${n} to exist`);
    }
    return result;
  }

  function really<T>(x: ?T): T {
    if (x == null) {
      throw new Error(String(x));
    }
    return x;
  }
  const issue = really(issueByNumber(2));
  const comment = really(
    issue
      .ref()
      .comments()[0]
      .get()
  );
  const pullRequest = really(prByNumber(5));
  const pullRequestReview = really(
    pullRequest
      .ref()
      .reviews()[0]
      .get()
  );
  const pullRequestReviewComment = really(
    pullRequestReview
      .ref()
      .comments()[0]
      .get()
  );
  const author = really(
    issue
      .ref()
      .authors()[0]
      .get()
  );
  const allWrappers = [
    issue,
    pullRequest,
    comment,
    pullRequestReview,
    pullRequestReviewComment,
    author,
  ];

  it("all wrappers provide a type() method", () => {
    expectPropertiesToMatchSnapshot(allWrappers, (e) => e.ref().type());
  });

  it("all wrappers provide a url() method", () => {
    expectPropertiesToMatchSnapshot(allWrappers, (e) => e.url());
  });

  test("reference constructors throw errors when used incorrectly", () => {
    expect(() => new RepositoryReference(issue.ref())).toThrowError(
      "to have type"
    );
    expect(() => new IssueReference(repo.ref())).toThrowError("to have type");
    expect(() => new CommentReference(repo.ref())).toThrowError("to have type");
    expect(() => new PullRequestReference(repo.ref())).toThrowError(
      "to have type"
    );
    expect(() => new PullRequestReviewReference(repo.ref())).toThrowError(
      "to have type"
    );
    expect(
      () => new PullRequestReviewCommentReference(repo.ref())
    ).toThrowError("to have type");
    expect(() => new AuthorReference(repo.ref())).toThrowError("to have type");
  });

  test("porcelain constructors throw errors when used incorrectly", () => {
    expect(() => new RepositoryPorcelain(issue)).toThrowError("to have type");
    expect(() => new IssuePorcelain(repo)).toThrowError("to have type");
    expect(() => new CommentPorcelain(repo)).toThrowError("to have type");
    expect(() => new PullRequestPorcelain(repo)).toThrowError("to have type");
    expect(() => new PullRequestReviewPorcelain(repo)).toThrowError(
      "to have type"
    );
    expect(() => new PullRequestReviewCommentPorcelain(repo)).toThrowError(
      "to have type"
    );
    expect(() => new AuthorPorcelain(repo)).toThrowError("to have type");
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
      expectPropertiesToMatchSnapshot(allPosts, (e) =>
        really(
          e
            .ref()
            .parent()
            .get()
        ).url()
      );
    });
    it("have bodies", () => {
      expectPropertiesToMatchSnapshot(allPosts, (e) => e.body());
    });
    it("have authors", () => {
      expectPropertiesToMatchSnapshot(allPosts, (e) =>
        e
          .ref()
          .authors()
          .map((a) => really(a.get()).login())
      );
    });
    it("have references", () => {
      expectPropertiesToMatchSnapshot(allPosts, (e) =>
        e
          .ref()
          .references()
          .map((r: GithubReference<NodePayload>) => really(r.get()).url())
      );
    });
  });

  describe("issues and pull requests", () => {
    const issuesAndPRs = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
      issueOrPrByNumber(n)
    );
    it("have numbers", () => {
      expectPropertiesToMatchSnapshot(issuesAndPRs, (e) => e.number());
    });
    it("have titles", () => {
      expectPropertiesToMatchSnapshot(issuesAndPRs, (e) => e.title());
    });
    it("have comments", () => {
      expectPropertiesToMatchSnapshot(issuesAndPRs, (e) =>
        e
          .ref()
          .comments()
          .map((c) => really(c.get()).url())
      );
    });
  });

  describe("pull requests", () => {
    const prs = [prByNumber(3), prByNumber(5), prByNumber(9)];
    it("have mergeCommitHashes", () => {
      expectPropertiesToMatchSnapshot(prs, (e) => e.ref().mergeCommitHash());
    });

    it("have reviews", () => {
      expectPropertiesToMatchSnapshot(prs, (e) =>
        e
          .ref()
          .reviews()
          .map((r) => really(r.get()).url())
      );
    });
  });

  describe("pull request reviews", () => {
    const reviews = pullRequest.ref().reviews();
    it("have review comments", () => {
      expectPropertiesToMatchSnapshot(
        reviews.map((r) => really(r.get())),
        (e) =>
          e
            .ref()
            .comments()
            .map((e) => really(e.get()).url())
      );
    });
    it("have states", () => {
      expectPropertiesToMatchSnapshot(
        reviews.map((r) => really(r.get())),
        (e) => e.state()
      );
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
      const srcIssue = issueByNumber(2);
      const references = srcIssue.ref().references();
      expect(references).toHaveLength(1);
      // Note: this verifies that we are not counting in-references, as
      // https://github.com/sourcecred/example-github/issues/6#issuecomment-385223316
      // references #2.

      const referenced = new IssuePorcelain(really(references[0].get()));
      expect(referenced.number()).toBe(1);
    });

    describe("by exact url", () => {
      function expectCommentToHaveSingleReference({commentNumber, type, url}) {
        const comments = issueByNumber(2)
          .ref()
          .comments();
        const references = comments[commentNumber].references();
        expect(references).toHaveLength(1);
        expect(really(references[0].get()).url()).toBe(url);
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
        const references = issueByNumber(2)
          .ref()
          .comments()[6]
          .references();
        expect(references).toHaveLength(5);
      });

      it("to no entities", () => {
        const references = issueByNumber(2)
          .ref()
          .comments()[7]
          .references();
        expect(references).toHaveLength(0);
      });
    });

    it("References by @-author", () => {
      const pr = prByNumber(5);
      const references = pr.ref().references();
      expect(references).toHaveLength(1);
      const referenced = new AuthorReference(references[0]);
      const login = really(referenced.get()).login();
      expect(login).toBe("wchargin");
    });
  });

  it("nodes have nice descriptions", () => {
    // This test really should be in its own file, but for expedience I am
    // putting it here.  TODO: Refactor general purpose testutils out of this
    // file, and move this test to render.test.js (assuming we don't move the
    // description method into the porcelain anyway...)
    expectPropertiesToMatchSnapshot(allWrappers, (e) =>
      nodeDescription(e.ref())
    );
  });
});
