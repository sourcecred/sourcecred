// @flow

import {Node} from "commonmark";

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

export function deformat(ast: Node): void {
  const walker = ast.walker();
  for (let step; (step = walker.next()); ) {
    const node: Node = step.node;
    const type: NodeType = node.type;
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
        // eslint-disable-next-line no-unused-expressions
        (type: empty);
        throw new Error("unexpected type: " + type);
    }
  }
}

export function coalesceText(ast: Node): void {
  const walker = ast.walker();
  let acc = [];
  let firstTextNode = null;
  for (let step; (step = walker.next()); ) {
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
