// @flow

import deepFreeze from "deep-freeze";
import {Graph, type Node, type Edge} from "../../core/graph";
import {partsNode, partsEdge} from "../../core/graphTestUtil";

export const nodes: {|
  inserter1: Node,
  inserter2: Node,
  machine1: Node,
  machine2: Node,
|} = deepFreeze({
  inserter1: partsNode(["factorio", "inserter", "1"]),
  machine1: partsNode(["factorio", "machine", "1"]),
  inserter2: partsNode(["factorio", "inserter", "2"]),
  machine2: partsNode(["factorio", "machine", "2"]),
});

export const edges: {|
  assembles1: Edge,
  transports1: Edge,
  transports2: Edge,
|} = deepFreeze({
  transports1: partsEdge(
    ["factorio", "transports", "1"],
    nodes.inserter1,
    nodes.machine1
  ),
  transports2: partsEdge(
    ["factorio", "transports", "2"],
    nodes.inserter2,
    nodes.machine2
  ),
  assembles1: partsEdge(
    ["factorio", "assembles", "1"],
    nodes.machine1,
    nodes.inserter2
  ),
});

export function graph(): Graph {
  return new Graph()
    .addNode(nodes.inserter1)
    .addNode(nodes.inserter2)
    .addNode(nodes.machine1)
    .addNode(nodes.machine2)
    .addEdge(edges.transports1)
    .addEdge(edges.transports2)
    .addEdge(edges.assembles1);
}
