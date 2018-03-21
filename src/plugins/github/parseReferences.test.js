// @flow

import {
  findNumericReferences,
  findGithubUrlReferences,
} from "./parseReferences.js";
import type {GithubUrlMatch} from "./parseReferences.js";

describe("reference finding", () => {
  it("finds no numeric references when not present", () => {
    expect(findNumericReferences("foo bar bod boink")).toHaveLength(0);
    expect(findNumericReferences("")).toHaveLength(0);
  });

  it("finds trivial numeric references", () => {
    expect(findNumericReferences("#1, #2, and #3")).toEqual([1, 2, 3]);
  });

  it("finds numeric references in a multiline string", () => {
    const example = `
    This is a multiline string.
    It refers to #1. Oh, and to #2 too.
    (#42 might be included too - who knows?)`;
    expect(findNumericReferences(example)).toEqual([1, 2, 42]);
  });

  it("does not find bad references", () => {
    expect(findNumericReferences("foo#123 #124bar")).toHaveLength(0);
  });

  it("does not yet find concise cross-repo links", () => {
    // The link below is valid, when we add cross-repo support we
    // should fix this test case
    expect(findNumericReferences("sourcecred/sourcecred#12")).toHaveLength(0);
  });

  it("finds no url references when not present", () => {
    expect(findGithubUrlReferences("foo bar bod boink")).toHaveLength(0);
    expect(findGithubUrlReferences("")).toHaveLength(0);
  });

  it("finds a trivial url reference", () => {
    expect(
      findGithubUrlReferences(
        "https://github.com/sourcecred/sourcecred/issues/86"
      )
    ).toHaveLength(1);
  });

  it("parses url references appropriately", () => {
    const example = `
    A directly linked issue:
https://github.com/sourcecred/example-repo/issues/1

    A directly linked issue with fragment:
https://github.com/sourcecred/example-repo/issues/1#issue-300934818

    A directly linked pull request:
https://github.com/sourcecred/example-repo/pull/3

    A directly linked pull request with fragment:
https://github.com/sourcecred/example-repo/pull/3#issue-171887741

    A directly linked issue comment:
https://github.com/sourcecred/example-repo/issues/6#issuecomment-373768442

    A directly linked pull request review:
https://github.com/sourcecred/example-repo/pull/5#pullrequestreview-100313899

    A directly linked pull request review comment:
https://github.com/sourcecred/example-repo/pull/5#discussion_r171460198

    A directly linked pull request comment:
https://github.com/sourcecred/example-repo/pull/3#issuecomment-369162222
    `;

    const expected = [
      {
        repoName: "example-repo",
        repoOwner: "sourcecred",
        parentType: "issues",
        number: 1,
        commentFragment: null,
      },
      {
        repoName: "example-repo",
        repoOwner: "sourcecred",
        parentType: "issues",
        number: 1,
        commentFragment: {fragmentType: "issue", fragmentNumber: 300934818},
      },
      {
        repoName: "example-repo",
        repoOwner: "sourcecred",
        parentType: "pull",
        number: 3,
        commentFragment: null,
      },
      {
        repoName: "example-repo",
        repoOwner: "sourcecred",
        parentType: "pull",
        number: 3,
        commentFragment: {fragmentType: "issue", fragmentNumber: 171887741},
      },
      {
        repoName: "example-repo",
        repoOwner: "sourcecred",
        parentType: "issues",
        number: 6,
        commentFragment: {
          fragmentType: "issuecomment",
          fragmentNumber: 373768442,
        },
      },
      {
        repoName: "example-repo",
        repoOwner: "sourcecred",
        parentType: "pull",
        number: 5,
        commentFragment: {
          fragmentType: "pullrequestreview",
          fragmentNumber: 100313899,
        },
      },
      {
        repoName: "example-repo",
        repoOwner: "sourcecred",
        parentType: "pull",
        number: 5,
        commentFragment: {
          fragmentType: "discussion_r",
          fragmentNumber: 171460198,
        },
      },
      {
        repoName: "example-repo",
        repoOwner: "sourcecred",
        parentType: "pull",
        number: 3,
        commentFragment: {
          fragmentType: "issuecomment",
          fragmentNumber: 369162222,
        },
      },
    ];

    expect(findGithubUrlReferences(example)).toEqual(expected);
  });

  it("doesn't find urls mangled with word characters", () => {
    expect(
      findGithubUrlReferences(
        "foohttps://github.com/sourcecred/sourcecred/pull/94"
      )
    ).toHaveLength(0);

    expect(
      findGithubUrlReferences(
        "https://github.com/sourcecred/sourcecred/pull/94foo"
      )
    ).toHaveLength(0);

    expect(
      findGithubUrlReferences(
        "(https://github.com/sourcecred/sourcecred/pull/94)"
      )
    ).toHaveLength(1);
  });
});
