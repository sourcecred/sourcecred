// @flow

import {EdgeAddress, Graph, NodeAddress, Direction} from "./graph";
import {WeightedGraph, extractGraphJSON} from "./weightedGraph";
import {advancedGraph} from "./graphTestUtil";

describe("core/weightedGraph", () => {
  const src = NodeAddress.fromParts(["src"]);
  const dst = NodeAddress.fromParts(["dst"]);
  const edge = Object.freeze({
    address: EdgeAddress.fromParts(["edge"]),
    src,
    dst,
  });
  const backwardsEdge = Object.freeze({
    address: EdgeAddress.fromParts(["backwards"]),
    src: dst,
    dst: src,
  });

  describe("constructor", () => {
    it("errors if there are missing edge weights", () => {
      const g = new Graph();
      g.addNode(src);
      g.addNode(dst);
      g.addEdge(edge);
      const edgeWeights = new Map();
      expect(() => new WeightedGraph(g, edgeWeights, 0.01)).toThrowError(
        "Missing weight"
      );
    });
    it("errors if there are extra edge weights", () => {
      const g = new Graph();
      g.addNode(src);
      g.addNode(dst);
      g.addEdge(edge);
      const edgeWeights = new Map();
      edgeWeights.set(edge.address, {toWeight: 3, froWeight: 4});
      edgeWeights.set(EdgeAddress.empty, {toWeight: 4, froWeight: 7});
      expect(() => new WeightedGraph(g, edgeWeights, 0.01)).toThrowError(
        "edge weights that don't correspond to any edge"
      );
    });
    it("errors if syntheticLoopWeight is 0", () => {
      expect(() => new WeightedGraph(new Graph(), new Map(), 0)).toThrowError(
        "syntheticLoopWeight must be positive"
      );
    });
    it("errors if syntheticLoopWeight is negative", () => {
      expect(() => new WeightedGraph(new Graph(), new Map(), -3)).toThrowError(
        "syntheticLoopWeight must be positive"
      );
    });
    it("returns a WeightedGraph", () => {
      // Sadly, this check would have prevented very confusing
      // type errors in similar cases.
      // $ExpectFlowError
      const _: Graph = new WeightedGraph(new Graph(), new Map(), 1);
    });
  });

  it("syntheticLoopWeight() returns that weight", () => {
    const slw = 1.337;
    const wg = new WeightedGraph(new Graph(), new Map(), slw);
    expect(wg.syntheticLoopWeight()).toBe(slw);
  });

  describe("totalOutWeight", () => {
    it("throws an error for non-existent edge", () => {
      const wg = new WeightedGraph(new Graph(), new Map(), 1);
      expect(() => wg.totalOutWeight(src)).toThrowError("nonexistent node");
    });

    it("returns the syntheticLoopWeight for an isolated node", () => {
      const slw = 0.653;
      const g = new Graph().addNode(src);
      const wg = new WeightedGraph(g, new Map(), slw);
      expect(wg.totalOutWeight(src)).toBe(slw);
    });

    it("correctly handles the toWeight and froWeight on an edge", () => {
      const slw = 0.653;
      const g = new Graph()
        .addNode(src)
        .addNode(dst)
        .addEdge(edge);
      const ee = () => ({toWeight: 3, froWeight: 0});
      const wg = WeightedGraph.fromEvaluator(g, ee, slw);
      expect(wg.totalOutWeight(src)).toBe(slw + 3);
      expect(wg.totalOutWeight(dst)).toBe(slw);
    });

    it("correctly handles a loop edge", () => {
      const g = new Graph()
        .addNode(src)
        .addEdge({address: edge.address, src: src, dst: src});
      const ee = () => ({toWeight: 1, froWeight: 2});
      const wg = WeightedGraph.fromEvaluator(g, ee, 0.1);
      expect(wg.totalOutWeight(src)).toBe(1 + 2 + 0.1);
    });

    it("correctly handles a node with multiple incident edges", () => {
      const g = new Graph()
        .addNode(src)
        .addNode(dst)
        .addEdge({address: EdgeAddress.fromParts(["1"]), src, dst})
        .addEdge({address: EdgeAddress.fromParts(["2"]), src, dst});
      const ee = () => ({toWeight: 1, froWeight: 2});
      const wg = WeightedGraph.fromEvaluator(g, ee, 0.1);
      expect(wg.totalOutWeight(src)).toBe(1 + 1 + 0.1);
    });
  });

  describe("wrapped Graph methods", () => {
    const weight = Object.freeze({toWeight: 1, froWeight: 2});
    const exampleGraph = () => {
      const g = new Graph()
        .addNode(src)
        .addNode(dst)
        .addEdge(edge)
        .addEdge(backwardsEdge);
      const ee = () => weight;
      return WeightedGraph.fromEvaluator(g, ee, 0.1);
    };
    it("hasNode works", () => {
      const eg = exampleGraph();
      expect(eg.hasNode(src)).toBe(true);
      expect(eg.hasNode(NodeAddress.fromParts(["nope"]))).toBe(false);
    });
    it("nodes works", () => {
      const eg = exampleGraph();
      expect(Array.from(eg.nodes({prefix: src}))).toEqual([src]);
    });
    it("hasEdge works", () => {
      const eg = exampleGraph();
      expect(eg.hasEdge(edge.address)).toBe(true);
      expect(eg.hasEdge(EdgeAddress.fromParts(["nope"]))).toBe(false);
    });
    it("edge works", () => {
      const eg = exampleGraph();
      expect(eg.edge(edge.address)).toEqual({edge, weight});
      expect(eg.edge(EdgeAddress.fromParts(["nope"]))).toEqual(null);
    });
    it("edges works", () => {
      const eg = exampleGraph();
      const edges = Array.from(
        eg.edges({
          addressPrefix: backwardsEdge.address,
          dstPrefix: NodeAddress.empty,
          srcPrefix: NodeAddress.empty,
        })
      );
      expect(edges).toEqual([{edge: backwardsEdge, weight}]);
    });
    it("neighbors works", () => {
      const eg = exampleGraph();
      const neighbors = Array.from(
        eg.neighbors(src, {
          edgePrefix: EdgeAddress.empty,
          nodePrefix: NodeAddress.empty,
          direction: Direction.OUT,
        })
      );
      expect(neighbors).toEqual([{edge, weight, node: dst}]);
    });
  });

  describe("equals", () => {
    it("doesn't depend on the graph's history", () => {
      const {graph1, graph2} = advancedGraph();
      const edgeEvaluator = (_) => ({toWeight: 3, froWeight: 4});
      const wg1 = WeightedGraph.fromEvaluator(graph1(), edgeEvaluator, 1);
      const wg2 = WeightedGraph.fromEvaluator(graph2(), edgeEvaluator, 1);
      expect(wg1.equals(wg2)).toBe(true);
    });
    it("checks that the graphs are equal", () => {
      const g1 = new Graph()
        .addNode(src)
        .addNode(dst)
        .addEdge(edge)
        .addNode(NodeAddress.fromParts(["isolated"]));
      const g2 = new Graph()
        .addNode(src)
        .addNode(dst)
        .addEdge(edge);
      const edgeEvaluator = () => ({toWeight: 1, froWeight: 2});
      const wg1 = WeightedGraph.fromEvaluator(g1, edgeEvaluator, 1);
      const wg2 = WeightedGraph.fromEvaluator(g2, edgeEvaluator, 1);
      expect(wg1.equals(wg2)).toBe(false);
    });
    it("checks that the synthetic loop weights are equal", () => {
      const wg1 = new WeightedGraph(new Graph(), new Map(), 1);
      const wg2 = new WeightedGraph(new Graph(), new Map(), 2);
      expect(wg1.equals(wg2)).toBe(false);
    });
    it("checks that the edge weights are equal", () => {
      const g = new Graph()
        .addNode(src)
        .addNode(dst)
        .addEdge(edge);
      const ee1 = () => ({toWeight: 1, froWeight: 2});
      const ee2 = () => ({toWeight: 2, froWeight: 3});
      const wg1 = WeightedGraph.fromEvaluator(g, ee1, 1);
      const wg2 = WeightedGraph.fromEvaluator(g, ee2, 1);
      expect(wg1.equals(wg2)).toBe(false);
    });
  });

  describe("to/from JSON", () => {
    function checkRoundTrip(wg: WeightedGraph) {
      const wgJSON = wg.toJSON();
      const wg_ = WeightedGraph.fromJSON(wgJSON);
      const wgJSON_ = wg_.toJSON();
      expect(wg_.equals(wg)).toBe(true);
      expect(wgJSON).toEqual(wgJSON_);
    }
    it("is round-trip consistent on the advanced graph", () => {
      const {graph1} = advancedGraph();
      const edgeEvaluator = (_) => ({toWeight: 3, froWeight: 4});
      const wg = WeightedGraph.fromEvaluator(graph1(), edgeEvaluator, 0.1);
      checkRoundTrip(wg);
    });
    it("is round-trip consistent on a simple graph", () => {
      const g = new Graph()
        .addNode(src)
        .addNode(dst)
        .addEdge(edge);
      const edgeEvaluator = (_) => ({toWeight: 3, froWeight: 4});
      const wg = WeightedGraph.fromEvaluator(g, edgeEvaluator, 1);
      checkRoundTrip(wg);
    });
    it("snapshots on a simple graph", () => {
      const g = new Graph()
        .addNode(src)
        .addNode(dst)
        .addEdge(edge);
      const edgeEvaluator = (_) => ({toWeight: 3, froWeight: 4});
      const wg = WeightedGraph.fromEvaluator(g, edgeEvaluator, 1);
      expect(wg.toJSON()).toMatchSnapshot();
    });
  });

  it("extractGraphJSON", () => {
    const g = new Graph()
      .addNode(src)
      .addNode(dst)
      .addEdge(edge);
    const edgeEvaluator = (_) => ({toWeight: 3, froWeight: 4});
    const wg = WeightedGraph.fromEvaluator(g, edgeEvaluator, 1);
    const wgJSON = wg.toJSON();
    const gJSON = g.toJSON();
    expect(extractGraphJSON(wgJSON)).toEqual(gJSON);
  });
});
