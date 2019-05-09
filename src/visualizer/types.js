// @flow

import type {NodeAddressT} from "../core/graph";

// Points are represented in a coordinate system where (0,0) is the center of
// the display.
export type Point = {|
  +x: number,
  +y: number,
|};

// Represents the size of a display.
export type Size = {|
  +height: number,
  +width: number,
|};

// The "self-contained" information about a node, including its address, a
// string identifier of its type, its score, and a description of the node
// itself
export type Node = {|
  +address: NodeAddressT,
  // Short string describing the type of the node.
  +type: string,
  // Score of the node.
  +score: number,
  // Score of the node as a fraction of the maximum score.
  // Allows scaling the nodes (in size, color) consistently.
  +scoreRatio: number,
  // Human-readable description of the node. Plain text for now;
  // markdown may be supported later. Ideally, should not
  // be more than a sentance long.
  +description: string,
|};

export type PositionedNode = {|
  +node: Node,
  +position: Point,
|};
