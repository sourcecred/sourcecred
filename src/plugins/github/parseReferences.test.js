// @flow

import {parseReferences} from "./parseReferences.js";

describe("plugins/github/parseReferences", () => {
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
    const example = [
      "This is a multiline string.",
      "It refers to #1. Oh, and to #2 too.",
      "(#42 might be included too - who knows?)",
    ].join("\n");
    expect(parseReferences(example)).toEqual([
      {refType: "BASIC", ref: "#1"},
      {refType: "BASIC", ref: "#2"},
      {refType: "BASIC", ref: "#42"},
    ]);
  });

  it("does not find bad references", () => {
    expect(parseReferences("foo#123 #124bar")).toHaveLength(0);
  });

  it("does not find references in inline code", () => {
    const input = "text like `#1` means issue";
    expect(parseReferences(input)).toHaveLength(0);
  });

  it("does not find references in inline code with lots of backticks", () => {
    // An attempt to evade inline code with regular expressions might
    // well fail here, because an even number of backticks appears on
    // each side of the would-be reference.
    const input = "text like ````#1```` means issue";
    expect(parseReferences(input)).toHaveLength(0);
  });

  it("does not find references in indented-block code", () => {
    const input = "text like\n\n    #1\n\nmeans issue";
    expect(parseReferences(input)).toHaveLength(0);
  });

  it("does not find references in fenced-block code", () => {
    const input = "text like\n\n```\n#1\n```\n\nmeans issue";
    expect(parseReferences(input)).toHaveLength(0);
  });

  it("finds references with mixed formatting", () => {
    const input = "*Paired* with @alphonse, but *reviewed* by @betty.";
    expect(parseReferences(input)).toEqual([
      {refType: "PAIRED_WITH", ref: "@alphonse"},
      {refType: "BASIC", ref: "@betty"},
    ]);
  });

  describe("cross-repo links", () => {
    const repoRef = "sourcecred/example_.repo#12";
    it("a bare link", () => {
      expect(parseReferences(repoRef)).toEqual([
        {refType: "BASIC", ref: repoRef},
      ]);
    });
    it("a link with surrounding context", () => {
      expect(parseReferences("please see sourcecred/example_.repo#12")).toEqual(
        [{refType: "BASIC", ref: repoRef}]
      );
    });
  });

  it("finds a trivial url reference", () => {
    expect(
      parseReferences("https://github.com/sourcecred/example_.repo/issues/86")
    ).toHaveLength(1);
  });

  it("finds url references", () => {
    const example = `
    A directly linked issue:
https://github.com/sourcecred/exa_mple-git.hub/issues/1

    A directly linked issue with fragment:
https://github.com/sourcecred/exa_mple-git.hub/issues/1#issue-300934818

    A directly linked pull request:
https://github.com/sourcecred/exa_mple-git.hub/pull/3

    A directly linked pull request with fragment:
https://github.com/sourcecred/exa_mple-git.hub/pull/3#issue-171887741

    A directly linked issue comment:
https://github.com/sourcecred/exa_mple-git.hub/issues/6#issuecomment-373768442

    A directly linked pull request review:
https://github.com/sourcecred/exa_mple-git.hub/pull/5#pullrequestreview-100313899

    A directly linked pull request review comment:
https://github.com/sourcecred/exa_mple-git.hub/pull/5#discussion_r171460198

    A directly linked pull request comment:
https://github.com/sourcecred/exa_mple-git.hub/pull/3#issuecomment-369162222
    `;

    const expected = [
      {
        refType: "BASIC",
        ref: "https://github.com/sourcecred/exa_mple-git.hub/issues/1",
      },
      {
        refType: "BASIC",
        ref:
          "https://github.com/sourcecred/exa_mple-git.hub/issues/1#issue-300934818",
      },
      {
        refType: "BASIC",
        ref: "https://github.com/sourcecred/exa_mple-git.hub/pull/3",
      },
      {
        refType: "BASIC",
        ref:
          "https://github.com/sourcecred/exa_mple-git.hub/pull/3#issue-171887741",
      },
      {
        refType: "BASIC",
        ref:
          "https://github.com/sourcecred/exa_mple-git.hub/issues/6#issuecomment-373768442",
      },
      {
        refType: "BASIC",
        ref:
          "https://github.com/sourcecred/exa_mple-git.hub/pull/5#pullrequestreview-100313899",
      },
      {
        refType: "BASIC",
        ref:
          "https://github.com/sourcecred/exa_mple-git.hub/pull/5#discussion_r171460198",
      },
      {
        refType: "BASIC",
        ref:
          "https://github.com/sourcecred/exa_mple-git.hub/pull/3#issuecomment-369162222",
      },
    ];

    expect(parseReferences(example)).toEqual(expected);
  });

  it("doesn't find urls mangled with word characters", () => {
    expect(
      parseReferences("foohttps://github.com/sourcecred/example_.repo/pull/94")
    ).toHaveLength(0);

    expect(
      parseReferences("https://github.com/sourcecred/example_.repo/pull/94foo")
    ).toHaveLength(0);

    expect(
      parseReferences("(https://github.com/sourcecred/example_.repo/pull/94)")
    ).toHaveLength(1);
  });

  it("allows but excludes leading and trailing punctuation", () => {
    const base = "https://github.com/sourcecred/example_.repo/pull/94";
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
        "@wchargin commented on #125, eg https://github.com/sourcecred/example_.repo/pull/125#pullrequestreview-113402856"
      )
    ).toEqual([
      {refType: "BASIC", ref: "#125"},
      {
        refType: "BASIC",
        ref:
          "https://github.com/sourcecred/example_.repo/pull/125#pullrequestreview-113402856",
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

  describe("finds references at the start of a non-initial line", () => {
    it("for repo-numeric references", () => {
      const f = (number: number) => `sourcecred/exa_mple-git.hub#${number}`;
      const input = `${f(1)}\n${f(2)}\n${f(3)}\r\n${f(4)}\r\n${f(5)}`;
      expect(parseReferences(input)).toEqual([
        {refType: "BASIC", ref: "sourcecred/exa_mple-git.hub#1"},
        {refType: "BASIC", ref: "sourcecred/exa_mple-git.hub#2"},
        {refType: "BASIC", ref: "sourcecred/exa_mple-git.hub#3"},
        {refType: "BASIC", ref: "sourcecred/exa_mple-git.hub#4"},
        {refType: "BASIC", ref: "sourcecred/exa_mple-git.hub#5"},
      ]);
    });
    it("for numeric references", () => {
      const f = (number: number) => `#${number}`;
      const input = `${f(1)}\n${f(2)}\n${f(3)}\r\n${f(4)}\r\n${f(5)}`;
      expect(parseReferences(input)).toEqual([
        {refType: "BASIC", ref: "#1"},
        {refType: "BASIC", ref: "#2"},
        {refType: "BASIC", ref: "#3"},
        {refType: "BASIC", ref: "#4"},
        {refType: "BASIC", ref: "#5"},
      ]);
    });
    it("for username references", () => {
      const f = (number: number) => `@user${number}`;
      const input = `${f(1)}\n${f(2)}\n${f(3)}\r\n${f(4)}\r\n${f(5)}`;
      expect(parseReferences(input)).toEqual([
        {refType: "BASIC", ref: "@user1"},
        {refType: "BASIC", ref: "@user2"},
        {refType: "BASIC", ref: "@user3"},
        {refType: "BASIC", ref: "@user4"},
        {refType: "BASIC", ref: "@user5"},
      ]);
    });
    it("for paired-with references", () => {
      const f = (number: number) => `Paired-with: @user${number}`;
      const input = `${f(1)}\n${f(2)}\n${f(3)}\r\n${f(4)}\r\n${f(5)}`;
      expect(parseReferences(input)).toEqual([
        {refType: "PAIRED_WITH", ref: "@user1"},
        {refType: "PAIRED_WITH", ref: "@user2"},
        {refType: "PAIRED_WITH", ref: "@user3"},
        {refType: "PAIRED_WITH", ref: "@user4"},
        {refType: "PAIRED_WITH", ref: "@user5"},
      ]);
    });
    it("for GitHub URL references", () => {
      const f = (number: number) =>
        "https://github.com/sourcecred/exa_mple-git.hub/issues/" + number;
      const input = `${f(1)}\n${f(2)}\n${f(3)}\r\n${f(4)}\r\n${f(5)}`;
      expect(parseReferences(input)).toEqual([
        {
          refType: "BASIC",
          ref: "https://github.com/sourcecred/exa_mple-git.hub/issues/1",
        },
        {
          refType: "BASIC",
          ref: "https://github.com/sourcecred/exa_mple-git.hub/issues/2",
        },
        {
          refType: "BASIC",
          ref: "https://github.com/sourcecred/exa_mple-git.hub/issues/3",
        },
        {
          refType: "BASIC",
          ref: "https://github.com/sourcecred/exa_mple-git.hub/issues/4",
        },
        {
          refType: "BASIC",
          ref: "https://github.com/sourcecred/exa_mple-git.hub/issues/5",
        },
      ]);
    });
  });

  describe("finds references separated by a single space", () => {
    it("for repo-numeric references", () => {
      const f = (number: number) => `sourcecred/exa_mple-git.hub#${number}`;
      const input = `${f(1)} ${f(2)} ${f(3)}`;
      expect(parseReferences(input)).toEqual([
        {refType: "BASIC", ref: "sourcecred/exa_mple-git.hub#1"},
        {refType: "BASIC", ref: "sourcecred/exa_mple-git.hub#2"},
        {refType: "BASIC", ref: "sourcecred/exa_mple-git.hub#3"},
      ]);
    });
    it("for numeric references", () => {
      const f = (number: number) => `#${number}`;
      const input = `${f(1)} ${f(2)} ${f(3)}`;
      expect(parseReferences(input)).toEqual([
        {refType: "BASIC", ref: "#1"},
        {refType: "BASIC", ref: "#2"},
        {refType: "BASIC", ref: "#3"},
      ]);
    });
    it("for username references", () => {
      const f = (number: number) => `@user${number}`;
      const input = `${f(1)} ${f(2)} ${f(3)}`;
      expect(parseReferences(input)).toEqual([
        {refType: "BASIC", ref: "@user1"},
        {refType: "BASIC", ref: "@user2"},
        {refType: "BASIC", ref: "@user3"},
      ]);
    });
    it("for paired-with references", () => {
      const f = (number: number) => `Paired-with: @user${number}`;
      const input = `${f(1)} ${f(2)} ${f(3)}`;
      expect(parseReferences(input)).toEqual([
        {refType: "PAIRED_WITH", ref: "@user1"},
        {refType: "PAIRED_WITH", ref: "@user2"},
        {refType: "PAIRED_WITH", ref: "@user3"},
      ]);
    });
    it("for GitHub URL references", () => {
      const f = (number: number) =>
        "https://github.com/sourcecred/exa_mple-git.hub/issues/" + number;
      const input = `${f(1)} ${f(2)} ${f(3)}`;
      expect(parseReferences(input)).toEqual([
        {
          refType: "BASIC",
          ref: "https://github.com/sourcecred/exa_mple-git.hub/issues/1",
        },
        {
          refType: "BASIC",
          ref: "https://github.com/sourcecred/exa_mple-git.hub/issues/2",
        },
        {
          refType: "BASIC",
          ref: "https://github.com/sourcecred/exa_mple-git.hub/issues/3",
        },
      ]);
    });
  });
});
