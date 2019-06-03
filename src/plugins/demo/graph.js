// @flow

import {Graph, EdgeAddress} from "../../core/graph";
import {partsNode} from "../../core/graphTestUtil";

export const nodes = Object.freeze({
  inserter1: partsNode(["factorio", "inserter", "1"]),
  machine1: partsNode(["factorio", "machine", "1"]),
  inserter2: partsNode(["factorio", "inserter", "2"]),
  machine2: partsNode(["factorio", "machine", "2"]),
});

export const edges = Object.freeze({
  transports1: Object.freeze({
    src: nodes.inserter1.address,
    dst: nodes.machine1.address,
    address: EdgeAddress.fromParts(["factorio", "transports", "1"]),
  }),
  assembles1: Object.freeze({
    src: nodes.machine1.address,
    dst: nodes.inserter2.address,
    address: EdgeAddress.fromParts(["factorio", "assembles", "1"]),
  }),
  transports2: Object.freeze({
    src: nodes.inserter2.address,
    dst: nodes.machine2.address,
    address: EdgeAddress.fromParts(["factorio", "assembles", "2"]),
  }),
});

export function graph() {
  return new Graph()
    .addNode(nodes.inserter1)
    .addNode(nodes.inserter2)
    .addNode(nodes.machine1)
    .addNode(nodes.machine2)
    .addEdge(edges.transports1)
    .addEdge(edges.transports2)
    .addEdge(edges.assembles1);
}
