// @flow

import {Node, Parser, XmlRenderer} from "commonmark";

import {coalesceText, deformat, textBlocks} from "./parseMarkdown";

describe("plugins/github/parseMarkdown", () => {
  function astContents(ast) {
    // The ASTs may differ in their `sourcepos` values, so we can't
    // directly compare them for equality. Instead, we compare through
    // the XML-rendered version of the tree. This has the side-effect
    // that the Jest diffs are much more readable.
    return new XmlRenderer().render(ast);
  }

  describe("textBlocks", () => {
    it("works on a full example", () => {
      const input = [
        "Hello *dear **world** of* friends",
        "and everyone else, too.",
        "",
        "Some `code` for [you][1]:",
        "",
        "```markdown",
        "# such *meta*",
        "much wow",
        "```",
        "",
        "[1]: https://example.com/",
        "",
        "Here's a list: <!-- it's a secret -->",
        "  - **important** things",
        "  - *also **important*** stuff",
        "  - a*b*c versus `a*b*c`",
        "",
        "> idea: ![lightbulb icon] never mind I forgot",
        "",
        "[lightbulb icon]: https://example.com/lightbulb.png",
        "",
      ].join("\n");
      const expected = [
        "Hello dear world of friends and everyone else, too.",
        "Some ",
        " for you:",
        "Here's a list: ",
        "important things",
        "also important stuff",
        "abc versus ",
        "idea: lightbulb icon never mind I forgot",
      ];
      expect(textBlocks(input)).toEqual(expected);
    });

    it("includes text inside of non-code HTML elements", () => {
      const input = "My <strong>#1</strong> pal";
      expect(textBlocks(input)).toEqual(["My #1 pal"]);
    });

    it('strips HTML "code" elements', () => {
      const input = "My <code>#1</code> pal";
      expect(textBlocks(input)).toEqual(["My  pal"]);
    });

    it('strips subtrees rooted at HTML "code" elements', () => {
      const input = "My <code>#1 <strong>*and* #2</strong></code> pals";
      expect(textBlocks(input)).toEqual(["My  pals"]);
    });

    it('strips "code" elements within "code" elements', () => {
      const input = "see <code>#1 and <code>#2</code> okay</code>";
      expect(textBlocks(input)).toEqual(["see "]);
    });

    it('handles comments and CDATA within "code" elements', () => {
      // These are "html_inline" nodes, but are not HTML elements. They
      // may contain closing-tag sequences, but these do not actually
      // close a tag.
      const input = [
        "note",
        "<code>alpha ",
        "<!-- bravo </code> charlie --> ",
        "<![CDATA[delta </code> echo]]> ",
        "foxtrot</code> ",
        "well",
      ].join("");
      expect(textBlocks(input)).toEqual(["note well"]);
    });

    it('strips HTML "pre" blocks and subtrees', () => {
      // "pre" is not handled specially; all blocks are skipped.
      const input =
        "Hello\n\n<pre>some pre-formatted <code>code</code></pre>\n\nworld";
      expect(textBlocks(input)).toEqual(["Hello", "world"]);
    });

    it('strips non-"pre" blocks and subtrees', () => {
      const input =
        "Hello\n\n<div>some pre-formatted <code>code</code></div>\n\nworld";
      expect(textBlocks(input)).toEqual(["Hello", "world"]);
    });
  });

  describe("coalesceText", () => {
    it("coalesces adjacent text blocks", () => {
      // This string will parse to a paragraph with eight text nodes:
      // one for each apostrophe, quote, and exclamation mark, and one
      // for each other contiguous block of text.
      const inputString = 'It\'s got "punctuation" and stuff!';
      const ast1 = new Parser().parse(inputString);
      const ast2 = new Parser().parse(inputString);
      {
        const para = ast2.firstChild;
        expect(para.type).toBe("paragraph");
        const text = para.firstChild;
        expect(text.type).toBe("text");
        while (text.next) {
          text.next.unlink();
        }
        text.literal = inputString;
      }
      expect(astContents(ast1)).not.toEqual(astContents(ast2));
      coalesceText(ast1);
      expect(astContents(ast1)).toEqual(astContents(ast2));
    });

    it("doesn't coalesce across soft breaks, hard breaks, or blocks", () => {
      const inputString = "Hello\nworld  \nfriends\n\nand\n\n> foes\n";
      const ast1 = new Parser().parse(inputString);
      coalesceText(ast1);
      const ast2 = new Parser().parse(inputString);
      expect(ast1).toEqual(ast2); // even sourcepos should be the same
    });
  });

  describe("deformat", () => {
    // The output AST of `deformat` usually includes consecutive `text`
    // nodes, and therefore may not be possible ot generate by directly
    // parsing a given input document. For instance, deformatting the
    // input `hello *world*` yields two text nodes `"hello "` and
    // `"world"`, but no Markdown document parses to this same tree.
    // Therefore, we include two test cases: one that directly
    // constructs the expected AST (which is tedious but foolproof), and
    // one that sends both the actual deformatted AST and the expected
    // AST through `coalesceText`, which is easier to read and write but
    // not quite as convincing a test because the output is
    // post-processed.

    it("works on a simple example", () => {
      const ast1 = new Parser().parse("hello *world* and **f*r*iends**");
      const ast2 = (() => {
        const root = new Node("document");
        let cursor = root;
        cursor.appendChild(new Node("paragraph"));
        cursor = cursor.firstChild;
        cursor.appendChild(new Node("text"));
        cursor = cursor.firstChild;
        cursor.literal = "hello ";
        for (const lit of ["world", " and ", "f", "r", "iends"]) {
          cursor.insertAfter(new Node("text"));
          cursor = cursor.next;
          cursor.literal = lit;
        }
        return root;
      })();
      expect(astContents(ast1)).not.toEqual(astContents(ast2));
      deformat(ast1);
      expect(astContents(ast1)).toEqual(astContents(ast2));
    });

    it("works on a full example", () => {
      const ast = new Parser().parse(
        [
          "Hello *dear **world** of* friends",
          "and everyone else, too.",
          "",
          "Some `code` for [you][1]:",
          "",
          "```markdown",
          "# such *meta*",
          "much wow",
          "```",
          "",
          "[1]: https://example.com/",
          "",
          "Here's a list:<!-- it's a secret -->",
          "  - **important** things",
          "  - *also **important*** stuff",
          "  - a*b*c versus `a*b*c`",
          "",
          "> idea: ![lightbulb icon] never mind I forgot",
          "",
          "[lightbulb icon]: https://example.com/lightbulb.png",
          "",
        ].join("\n")
      );
      coalesceText(ast);
      const expected = new Parser().parse(
        [
          "Hello dear world of friends and everyone else, too.",
          "",
          "Some `code` for you:",
          "",
          "```markdown",
          "# such *meta*",
          "much wow",
          "```",
          "",
          "Here's a list:",
          "  - important things",
          "  - also important stuff",
          "  - abc versus `a*b*c`",
          "",
          "> idea: lightbulb icon never mind I forgot",
          "",
        ].join("\n")
      );
      coalesceText(expected);
      expect(astContents(ast)).not.toEqual(astContents(expected));
      deformat(ast);
      coalesceText(ast);
      expect(astContents(ast)).toEqual(astContents(expected));
    });
  });
});
