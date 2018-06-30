// @flow

import {parseReferences} from "./parseReferences.js";

describe("parseReferences", () => {
  it("finds no references when not present", () => {
    expect(parseReferences("foo bar bod boink")).toHaveLength(0);
    expect(parseReferences("")).toHaveLength(0);
  });

  it("finds trivial numeric references", () => {
    expect(parseReferences("#1, #2, and #3")).toEqual([
      {refType: "BASIC", ref: "#1"},
      {refType: "BASIC", ref: "#2"},
      {refType: "BASIC", ref: "#3"},
    ]);
  });

  it("finds numeric references in a multiline string", () => {
    const example = `
    This is a multiline string.
    It refers to #1. Oh, and to #2 too.
    (#42 might be included too - who knows?)`;
    expect(parseReferences(example)).toEqual([
      {refType: "BASIC", ref: "#1"},
      {refType: "BASIC", ref: "#2"},
      {refType: "BASIC", ref: "#42"},
    ]);
  });

  it("does not find bad references", () => {
    expect(parseReferences("foo#123 #124bar")).toHaveLength(0);
  });

  describe("cross-repo links", () => {
    const repoRef = "sourcecred/sourcecred#12";
    it("a bare link", () => {
      expect(parseReferences(repoRef)).toEqual([
        {refType: "BASIC", ref: repoRef},
      ]);
    });
    it("a link with surrounding context", () => {
      expect(parseReferences("please see sourcecred/sourcecred#12")).toEqual([
        {refType: "BASIC", ref: repoRef},
      ]);
    });
  });

  it("finds a trivial url reference", () => {
    expect(
      parseReferences("https://github.com/sourcecred/sourcecred/issues/86")
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
      {
        refType: "BASIC",
        ref: "https://github.com/sourcecred/example-github/issues/1",
      },
      {
        refType: "BASIC",
        ref:
          "https://github.com/sourcecred/example-github/issues/1#issue-300934818",
      },
      {
        refType: "BASIC",
        ref: "https://github.com/sourcecred/example-github/pull/3",
      },
      {
        refType: "BASIC",
        ref:
          "https://github.com/sourcecred/example-github/pull/3#issue-171887741",
      },
      {
        refType: "BASIC",
        ref:
          "https://github.com/sourcecred/example-github/issues/6#issuecomment-373768442",
      },
      {
        refType: "BASIC",
        ref:
          "https://github.com/sourcecred/example-github/pull/5#pullrequestreview-100313899",
      },
      {
        refType: "BASIC",
        ref:
          "https://github.com/sourcecred/example-github/pull/5#discussion_r171460198",
      },
      {
        refType: "BASIC",
        ref:
          "https://github.com/sourcecred/example-github/pull/3#issuecomment-369162222",
      },
    ];

    expect(parseReferences(example)).toEqual(expected);
  });

  it("doesn't find urls mangled with word characters", () => {
    expect(
      parseReferences("foohttps://github.com/sourcecred/sourcecred/pull/94")
    ).toHaveLength(0);

    expect(
      parseReferences("https://github.com/sourcecred/sourcecred/pull/94foo")
    ).toHaveLength(0);

    expect(
      parseReferences("(https://github.com/sourcecred/sourcecred/pull/94)")
    ).toHaveLength(1);
  });

  it("allows but excludes leading and trailing punctuation", () => {
    const base = "https://github.com/sourcecred/sourcecred/pull/94";
    expect(parseReferences(`!${base}`)).toEqual([
      {refType: "BASIC", ref: base},
    ]);
    expect(parseReferences(`${base}!`)).toEqual([
      {refType: "BASIC", ref: base},
    ]);
    expect(parseReferences(`!${base}!`)).toEqual([
      {refType: "BASIC", ref: base},
    ]);
  });

  it("finds username references", () => {
    expect(parseReferences("hello to @wchargin from @decentralion!")).toEqual([
      {refType: "BASIC", ref: "@wchargin"},
      {refType: "BASIC", ref: "@decentralion"},
    ]);
  });

  it("finds usernames with hypens and numbers", () => {
    expect(
      parseReferences("@paddy-hack and @0x00 are valid usernames")
    ).toEqual([
      {refType: "BASIC", ref: "@paddy-hack"},
      {refType: "BASIC", ref: "@0x00"},
    ]);
  });

  it("finds username references by exact url", () => {
    expect(parseReferences("greetings https://github.com/wchargin")).toEqual([
      {refType: "BASIC", ref: "https://github.com/wchargin"},
    ]);
  });

  it("finds a mix of reference types", () => {
    expect(
      parseReferences(
        "@wchargin commented on #125, eg https://github.com/sourcecred/sourcecred/pull/125#pullrequestreview-113402856"
      )
    ).toEqual([
      {refType: "BASIC", ref: "#125"},
      {
        refType: "BASIC",
        ref:
          "https://github.com/sourcecred/sourcecred/pull/125#pullrequestreview-113402856",
      },
      {refType: "BASIC", ref: "@wchargin"},
    ]);
  });

  it("finds paired with references", () => {
    // Note that there is *not* also a BASIC ref to @wchargin
    expect(parseReferences("paired with @wchargin")).toEqual([
      {refType: "PAIRED_WITH", ref: "@wchargin"},
    ]);
  });

  it("paired with allows flexible capitalization and hyphens or colons", () => {
    const examples = [
      "paired with @wchargin",
      "paired-with @wchargin",
      "paired with: @wchargin",
      "Paired with @wchargin",
      "Paired With @wchargin",
      "Paired With: @wchargin",
      "Paired-With: @wchargin",
    ];
    for (const example of examples) {
      // Note that there is *not* also a BASIC ref to @wchargin
      expect(parseReferences(example)).toEqual([
        {refType: "PAIRED_WITH", ref: "@wchargin"},
      ]);
    }
  });

  it("can find a mixture of paired with and BASIC references", () => {
    expect(parseReferences("paired with @wchargin, thanks @wchargin")).toEqual([
      {refType: "PAIRED_WITH", ref: "@wchargin"},
      {refType: "BASIC", ref: "@wchargin"},
    ]);
  });

  it("multiple paired with refs are OK", () => {
    expect(
      parseReferences("paired with @wchargin and paired with @decentralion")
    ).toEqual([
      {refType: "PAIRED_WITH", ref: "@wchargin"},
      {refType: "PAIRED_WITH", ref: "@decentralion"},
    ]);
  });
});
