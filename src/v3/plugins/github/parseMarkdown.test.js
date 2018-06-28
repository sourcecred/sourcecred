// @flow

import {Node, Parser, XmlRenderer} from "commonmark";

import {deformat, coalesceText} from "./parseMarkdown";

describe("plugins/github/parseMarkdown", () => {
  function astContents(ast) {
    // The ASTs may differ in their `sourcepos` values, so we can't
    // directly compare them for equality. Instead, we compare through
    // the XML-rendered version of the tree. This has the side-effect
    // that the Jest diffs are much more readable.
    return new XmlRenderer().render(ast);
  }

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
          "Here's a list: <!-- it's a secret -->",
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
          "Here's a list: <!-- it's a secret -->",
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
