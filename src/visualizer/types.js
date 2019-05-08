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
export type DescribedNode = {|
  +address: NodeAddressT,
  +type: string,
  +score: number,
  +description: string,
|};

// The "visualizer-ready" version of a node. In addition to containing
// the described node, it has a position in space, and it has a score ratio.
// The score ratio makes it possible to interpret the score consistently
// (is 100 a big score or a small score?).
export type VizNode = {|
  +node: DescribedNode,
  +position: Point,
  // Represents this node's score as a fraction of the maximum score. Whether
  // the application is a local max (i.e. the maximum score of any node in
  // view) or a global max (of all nodes in the graph, whether or not they are
  // in view) is not specified by the type.
  +scoreRatio: number,
|};
