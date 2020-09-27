// @flow

import {Node, Parser} from "commonmark";
import {OPENTAG, CLOSETAG} from "commonmark/lib/common";

/**
 * Extract maximal contiguous blocks of text from a Markdown string, in
 * source-appearance order.
 *
 * For the purposes of this method, code (of both the inline and block
 * varieties) is not considered text, and will not be included in the
 * output at all. HTML contents are similarly excluded.
 *
 * Normal text, emphasized/strong text, link text, and image alt text
 * all count as text and will be included. A block of text is not
 * required to have the same formatting: e.g., the Markdown document
 * given by `hello *there* [you](https://example.com)` without the
 * backticks has one contiguous block of text: `"hello there you"`.
 *
 * Softbreaks count as normal text, and render as a single space.
 * Hardbreaks break a contiguous block of text.
 *
 * Block-level elements, such as paragraphs, lists, and block quotes,
 * break contiguous blocks of text.
 *
 * See test cases for examples.
 */
export function textBlocks(string: string): string[] {
  const ast = new Parser().parse(string);
  deformat(ast);
  coalesceText(ast);
  const walker = ast.walker();
  const results = [];
  for (let step; (step = walker.next()); ) {
    // $FlowIgnore[value-as-type]
    const node: Node = step.node;
    const type: NodeType = node.type;
    if (type === "text") {
      results.push(node.literal);
    }
  }
  return results;
}

// Copied from:
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/bd35c127a6fd869ab2844082ae41047668178b7f/types/commonmark/index.d.ts#L14-L15
type NodeType =
  | "text"
  | "softbreak"
  | "linebreak"
  | "emph"
  | "strong"
  | "html_inline"
  | "link"
  | "image"
  | "code"
  | "document"
  | "paragraph"
  | "block_quote"
  | "item"
  | "list"
  | "heading"
  | "code_block"
  | "html_block"
  | "thematic_break"
  | "custom_inline"
  | "custom_block";

// $FlowIgnore[value-as-type]
export function deformat(ast: Node): void {
  const walker = ast.walker();
  // We ignore the contents of HTML "code" elements and their subtrees.
  // This variable tracks how deep we are in such a tree. It is 0 if we
  // are not in such a tree, 1 if we are in a "code" element, 2 if we
  // are in an element inside a "code" element, etc.
  let htmlDepth: number = 0;
  const reOpenCodeTag = /^<code(?:$|[ >])/i;
  const reOpenTag = new RegExp(`^(?:${OPENTAG})`);
  const reCloseTag = new RegExp(`^(?:${CLOSETAG})`);

  for (let step; (step = walker.next()); ) {
    // $FlowIgnore[value-as-type]
    const node: Node = step.node;
    const type: NodeType = node.type;
    if (htmlDepth > 0) {
      if (type === "html_inline") {
        if (reOpenTag.test(node.literal)) {
          htmlDepth++;
        } else if (reCloseTag.test(node.literal)) {
          htmlDepth--;
        }
      }
      // The AST walker gets into a broken state if you unlink a node
      // that has children before those children have been visited. We
      // only unlink when leaving a node, or when entering a node that
      // has no children.
      if (!step.entering || node.firstChild == null) {
        node.unlink();
        continue;
      }
    }
    switch (type) {
      case "text":
        break;
      case "softbreak": {
        const space = new Node("text", node.sourcepos);
        space.literal = " ";
        node.insertBefore(space);
        node.unlink();
        break;
      }
      case "linebreak":
        break;
      case "emph":
      case "strong":
      case "link":
      case "image":
        if (!step.entering) {
          // Splice out the node.
          while (node.firstChild) {
            node.insertBefore(node.firstChild);
          }
          node.unlink();
        }
        break;
      case "html_inline":
        if (reOpenCodeTag.test(node.literal)) {
          htmlDepth++; // should have been 0 previously
        }
        node.unlink();
        break;
      case "code":
      case "document":
      case "paragraph":
      case "block_quote":
      case "item":
      case "list":
      case "heading":
      case "code_block":
      case "html_block":
      case "thematic_break":
      case "custom_inline":
      case "custom_block":
        break;
      default:
        throw new Error("unexpected type: " + (type: empty));
    }
  }
}

// $FlowIgnore[value-as-type]
export function coalesceText(ast: Node): void {
  const walker = ast.walker();
  let acc = [];
  let firstTextNode = null;
  for (let step; (step = walker.next()); ) {
    // $FlowIgnore[value-as-type]
    const node: Node = step.node;
    const type: NodeType = node.type;
    if (type === "text") {
      acc.push(node.literal);
      if (firstTextNode == null) {
        firstTextNode = node;
      } else {
        node.unlink();
      }
    } else if (firstTextNode != null) {
      firstTextNode.literal = acc.join("");
      acc = [];
      firstTextNode = null;
    }
  }
}
