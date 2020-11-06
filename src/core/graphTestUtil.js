// @flow

import deepFreeze from "deep-freeze";
import {
  EdgeAddress,
  Graph,
  NodeAddress,
  type Node,
  type Edge,
  type NodeAddressT,
  type EdgeAddressT,
} from "./graph";
import {
  type NodeWithWeight,
  type EdgeWithWeight,
  type WeightedGraph,
} from "./weightedGraph";
import {empty as emptyWeights} from "./weights";
import type {TimestampMs} from "../util/timestamp";

/**
 * Create a new Node from an array of string address parts.
 *
 * Fields on the node will be set with dummy values.
 * Test code should endeavor to use this whenever the code
 * is not testing how specific fields are handled; that way, adding
 * new fields will not require updating unrelated test code across
 * the codebase.
 *
 * The returned node is frozen; as such, it is safe to re-use this exact
 * object across test cases.
 */
export function partsNode(parts: string[]): Node {
  return deepFreeze({
    address: NodeAddress.fromParts(parts),
    description: parts.toString(),
    timestampMs: null,
  });
}

/**
 * Create a new Node from a single address part.
 *
 * The same considerations as partsNode apply.
 */
export function node(name: string): Node {
  return partsNode([name]);
}

/**
 * Create a new Edge from address parts and a src and dst.
 *
 * This is a convenience method for constructing example edges more concisely in test code.
 *
 * The returned edge is frozen, so it is safe to use across test cases.
 */
export function partsEdge(parts: string[], src: Node, dst: Node): Edge {
  return deepFreeze({
    address: EdgeAddress.fromParts(parts),
    src: src.address,
    dst: dst.address,
    timestampMs: 0,
  });
}

/**
 * Create a new Edge from a single address part and a src and dst.
 *
 * The same considerations as partsEdge apply.
 */
export function edge(name: string, src: Node, dst: Node): Edge {
  return partsEdge([name], src, dst);
}

export function advancedGraph(): {|
  edges: {|
    fullDanglingEdge: {|
      +address: EdgeAddressT,
      +dst: NodeAddressT,
      +src: NodeAddressT,
      +timestampMs: TimestampMs,
    |},
    halfDanglingEdge: {|
      +address: EdgeAddressT,
      +dst: NodeAddressT,
      +src: NodeAddressT,
      +timestampMs: TimestampMs,
    |},
    hom1: {|
      +address: EdgeAddressT,
      +dst: NodeAddressT,
      +src: NodeAddressT,
      +timestampMs: TimestampMs,
    |},
    hom2: {|
      +address: EdgeAddressT,
      +dst: NodeAddressT,
      +src: NodeAddressT,
      +timestampMs: TimestampMs,
    |},
    loopLoop: {|
      +address: EdgeAddressT,
      +dst: NodeAddressT,
      +src: NodeAddressT,
      +timestampMs: TimestampMs,
    |},
    phantomEdge1: {|
      +address: EdgeAddressT,
      +dst: NodeAddressT,
      +src: NodeAddressT,
      +timestampMs: TimestampMs,
    |},
    phantomEdge2: {|
      +address: EdgeAddressT,
      +dst: NodeAddressT,
      +src: NodeAddressT,
      +timestampMs: TimestampMs,
    |},
  |},
  graph1: () => Graph,
  graph2: () => Graph,
  nodes: {|
    dst: {|
      +address: NodeAddressT,
      +description: string,
      +timestampMs: TimestampMs | null,
    |},
    halfIsolated: {|
      +address: NodeAddressT,
      +description: string,
      +timestampMs: TimestampMs | null,
    |},
    isolated: {|
      +address: NodeAddressT,
      +description: string,
      +timestampMs: TimestampMs | null,
    |},
    loop: {|
      +address: NodeAddressT,
      +description: string,
      +timestampMs: TimestampMs | null,
    |},
    phantomNode: {|
      +address: NodeAddressT,
      +description: string,
      +timestampMs: TimestampMs | null,
    |},
    src: {|
      +address: NodeAddressT,
      +description: string,
      +timestampMs: TimestampMs | null,
    |},
  |},
|} {
  // The advanced graph has the following features:
  // - Multiple edges of same hom, from `src` to `dst`
  // - An isolated node, `isolated`
  // - A loop
  // - A node and edge with the same toParts representation
  // This function exposes all of the pieces of the advanced graph.
  // It also returns two different versions of the graph, which are
  // logically equivalent but very different history
  // To avoid contamination, every piece is exposed as a function
  // which generates a clean copy of that piece.
  const src = node("src");
  const dst = node("dst");
  const hom1 = partsEdge(["hom", "1"], src, dst);
  const hom2 = partsEdge(["hom", "2"], src, dst);
  const loop = node("loop");
  const loopLoop = edge("loop", loop, loop);

  const halfIsolated = node("halfIsolated");
  const phantomNode = node("phantom");
  const halfDanglingEdge = edge("half-dangling", halfIsolated, phantomNode);
  const fullDanglingEdge = edge("full-dangling", phantomNode, phantomNode);

  const isolated = node("isolated");
  const graph1 = () =>
    new Graph()
      .addNode(src)
      .addNode(dst)
      .addNode(loop)
      .addNode(isolated)
      .addEdge(hom1)
      .addEdge(hom2)
      .addEdge(loopLoop)
      .addNode(halfIsolated)
      .addEdge(halfDanglingEdge)
      .addEdge(fullDanglingEdge);

  // graph2 is logically equivalent to graph1, but is constructed with very
  // different history.
  // Use this to check that logically equivalent graphs are treated
  // equivalently, regardless of their history.
  const phantomEdge1 = edge("phantom", src, phantomNode);
  const phantomEdge2 = edge("not-so-isolated", src, isolated);

  // To verify that the graphs are equivalent, every mutation is preceded
  // by a comment stating what the set of nodes and edges are prior to that mutation
  const graph2 = () =>
    new Graph()
      // N: [], E: []
      .addNode(phantomNode)
      // N: [phantomNode], E: []
      .addNode(src)
      // N: [phantomNode, src], E: []
      .addEdge(phantomEdge1)
      // N: [phantomNode, src], E: [phantomEdge1]
      .addNode(isolated)
      // N: [phantomNode, src, isolated], E: [phantomEdge1]
      .addNode(halfIsolated)
      // N: [phantomNode, src, isolated, halfIsolated]
      // E: [phantomEdge1]
      .addEdge(halfDanglingEdge)
      // N: [phantomNode, src, isolated, halfIsolated]
      // E: [phantomEdge1, halfDanglingEdge]
      .addEdge(fullDanglingEdge)
      // N: [phantomNode, src, isolated, halfIsolated]
      // E: [phantomEdge1, halfDanglingEdge, fullDanglingEdge]
      .removeEdge(phantomEdge1.address)
      // N: [phantomNode, src, isolated, halfIsolated]
      // E: [halfDanglingEdge, fullDanglingEdge]
      .addNode(dst)
      // N: [phantomNode, src, isolated, halfIsolated, dst]
      // E: [halfDanglingEdge, fullDanglingEdge]
      .addEdge(hom1)
      // N: [phantomNode, src, isolated, halfIsolated, dst]
      // E: [halfDanglingEdge, fullDanglingEdge, hom1]
      .addEdge(phantomEdge2)
      // N: [phantomNode, src, isolated, halfIsolated, dst]
      // E: [halfDanglingEdge, fullDanglingEdge, hom1, phantomEdge2]
      .addEdge(hom2)
      // N: [phantomNode, src, isolated, halfIsolated, dst]
      // E: [halfDanglingEdge, fullDanglingEdge, hom1, phantomEdge2, hom2]
      .removeEdge(hom1.address)
      // N: [phantomNode, src, isolated, halfIsolated, dst]
      // E: [halfDanglingEdge, fullDanglingEdge, phantomEdge2, hom2]
      .removeNode(phantomNode.address)
      // N: [src, isolated, halfIsolated, dst]
      // E: [halfDanglingEdge, fullDanglingEdge, phantomEdge2, hom2]
      .removeEdge(phantomEdge2.address)
      // N: [src, isolated, halfIsolated, dst]
      // E: [halfDanglingEdge, fullDanglingEdge, hom2]
      .removeNode(isolated.address)
      // N: [src, halfIsolated, dst]
      // E: [halfDanglingEdge, fullDanglingEdge, hom2]
      .addNode(isolated)
      // N: [src, halfIsolated, dst, isolated]
      // E: [halfDanglingEdge, fullDanglingEdge, hom2]
      .addNode(loop)
      // N: [src, halfIsolated, dst, isolated, loop]
      // E: [halfDanglingEdge, fullDanglingEdge, hom2]
      .addEdge(loopLoop)
      // N: [src, halfIsolated, dst, isolated, loop]
      // E: [halfDanglingEdge, fullDanglingEdge, hom2, loopLoop]
      .addEdge(hom1);
  //     N: [src, halfIsolated, dst, isolated, loop]
  //     E: [halfDanglingEdge, fullDanglingEdge, hom2, loopLoop, hom1]
  const nodes = {src, dst, loop, isolated, phantomNode, halfIsolated};
  const edges = {
    hom1,
    hom2,
    loopLoop,
    phantomEdge1,
    phantomEdge2,
    halfDanglingEdge,
    fullDanglingEdge,
  };
  return {nodes, edges, graph1, graph2};
}

export function testWeightedGraph(
  nodesWithWeights: NodeWithWeight[],
  edgesWithWeights: EdgeWithWeight[]
): WeightedGraph {
  const graph = new Graph();
  const weights = emptyWeights();
  for (const nodeWithWeight of nodesWithWeights) {
    const weight = nodeWithWeight.weight;
    graph.addNode(nodeWithWeight.node);
    if (weight == null) continue;
    weights.nodeWeights.set(nodeWithWeight.node.address, weight);
  }
  for (const edgeWithWeight of edgesWithWeights) {
    const weight = edgeWithWeight.weight;
    graph.addEdge(edgeWithWeight.edge);
    if (weight == null) continue;
    weights.edgeWeights.set(edgeWithWeight.edge.address, weight);
  }
  return {graph, weights};
}
