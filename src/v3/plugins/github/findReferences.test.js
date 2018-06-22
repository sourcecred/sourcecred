// @flow

import {findReferences} from "./findReferences.js";

describe("findReferences", () => {
  it("finds no references when not present", () => {
    expect(findReferences("foo bar bod boink")).toHaveLength(0);
    expect(findReferences("")).toHaveLength(0);
  });

  it("finds trivial numeric references", () => {
    expect(findReferences("#1, #2, and #3")).toEqual(["#1", "#2", "#3"]);
  });

  it("finds numeric references in a multiline string", () => {
    const example = `
    This is a multiline string.
    It refers to #1. Oh, and to #2 too.
    (#42 might be included too - who knows?)`;
    expect(findReferences(example)).toEqual(["#1", "#2", "#42"]);
  });

  it("does not find bad references", () => {
    expect(findReferences("foo#123 #124bar")).toHaveLength(0);
  });

  it("does not yet find concise cross-repo links", () => {
    // The link below is valid, when we add cross-repo support we
    // should fix this test case
    expect(findReferences("sourcecred/sourcecred#12")).toHaveLength(0);
  });

  it("finds a trivial url reference", () => {
    expect(
      findReferences("https://github.com/sourcecred/sourcecred/issues/86")
    ).toHaveLength(1);
  });

  it("finds url references", () => {
    const example = `
    A directly linked issue:
https://github.com/sourcecred/example-github/issues/1

    A directly linked issue with fragment:
https://github.com/sourcecred/example-github/issues/1#issue-300934818

    A directly linked pull request:
https://github.com/sourcecred/example-github/pull/3

    A directly linked pull request with fragment:
https://github.com/sourcecred/example-github/pull/3#issue-171887741

    A directly linked issue comment:
https://github.com/sourcecred/example-github/issues/6#issuecomment-373768442

    A directly linked pull request review:
https://github.com/sourcecred/example-github/pull/5#pullrequestreview-100313899

    A directly linked pull request review comment:
https://github.com/sourcecred/example-github/pull/5#discussion_r171460198

    A directly linked pull request comment:
https://github.com/sourcecred/example-github/pull/3#issuecomment-369162222
    `;

    const expected = [
      "https://github.com/sourcecred/example-github/issues/1",
      "https://github.com/sourcecred/example-github/issues/1#issue-300934818",
      "https://github.com/sourcecred/example-github/pull/3",
      "https://github.com/sourcecred/example-github/pull/3#issue-171887741",
      "https://github.com/sourcecred/example-github/issues/6#issuecomment-373768442",
      "https://github.com/sourcecred/example-github/pull/5#pullrequestreview-100313899",
      "https://github.com/sourcecred/example-github/pull/5#discussion_r171460198",
      "https://github.com/sourcecred/example-github/pull/3#issuecomment-369162222",
    ];

    expect(findReferences(example)).toEqual(expected);
  });

  it("doesn't find urls mangled with word characters", () => {
    expect(
      findReferences("foohttps://github.com/sourcecred/sourcecred/pull/94")
    ).toHaveLength(0);

    expect(
      findReferences("https://github.com/sourcecred/sourcecred/pull/94foo")
    ).toHaveLength(0);

    expect(
      findReferences("(https://github.com/sourcecred/sourcecred/pull/94)")
    ).toHaveLength(1);
  });

  it("allows but excludes leading and trailing punctuation", () => {
    const base = "https://github.com/sourcecred/sourcecred/pull/94";
    expect(findReferences(`!${base}`)).toEqual([base]);
    expect(findReferences(`${base}!`)).toEqual([base]);
    expect(findReferences(`!${base}!`)).toEqual([base]);
  });

  it("finds username references", () => {
    expect(findReferences("hello to @wchargin from @decentralion!")).toEqual([
      "@wchargin",
      "@decentralion",
    ]);
  });

  it("finds usernames with hypens and numbers", () => {
    expect(findReferences("@paddy-hack and @0x00 are valid usernames")).toEqual(
      ["@paddy-hack", "@0x00"]
    );
  });

  it("finds username references by exact url", () => {
    expect(findReferences("greetings https://github.com/wchargin")).toEqual([
      "https://github.com/wchargin",
    ]);
  });

  it("finds a mix of reference types", () => {
    expect(
      findReferences(
        "@wchargin commented on #125, eg https://github.com/sourcecred/sourcecred/pull/125#pullrequestreview-113402856"
      )
    ).toEqual([
      "#125",
      "https://github.com/sourcecred/sourcecred/pull/125#pullrequestreview-113402856",
      "@wchargin",
    ]);
  });
});
