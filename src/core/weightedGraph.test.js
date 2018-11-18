// @flow

import {EdgeAddress, Graph, NodeAddress} from "./graph";
import {WeightedGraph} from "./weightedGraph";
import {advancedGraph} from "./graphTestUtil";

describe("core/weightedGraph", () => {
  const src = NodeAddress.fromParts(["src"]);
  const dst = NodeAddress.fromParts(["dst"]);
  const edge = {address: EdgeAddress.fromParts(["edge"]), src, dst};

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

  describe("edgeWeight", () => {
    it("throws an error for non-existent edge", () => {
      const wg = new WeightedGraph(new Graph(), new Map(), 1);
      expect(() => wg.edgeWeight(edge.address)).toThrowError(
        "nonexistent edge"
      );
    });
    it("returns the correct edge weight", () => {
      const g = new Graph();
      g.addNode(src);
      g.addNode(dst);
      g.addEdge(edge);
      const edgeWeights = new Map();
      const w = {toWeight: 1, froWeight: 2};
      edgeWeights.set(edge.address, w);
      const wg = new WeightedGraph(g, edgeWeights, 1);
      expect(wg.edgeWeight(edge.address)).toBe(w);
    });
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

  describe("delegated Graph methods", () => {
    it("hasNode is delegated properly", () => {
      const wg = new WeightedGraph(new Graph(), new Map(), 0.1);
      const ret = Symbol();
      const arg: any = Symbol();
      // $ExpectFlowError
      wg._graph.hasNode = jest.fn().mockReturnValue(ret);
      expect(wg.hasNode(arg)).toBe(ret);
      expect(wg._graph.hasNode).toHaveBeenCalledWith(arg);
    });
    it("nodes is delegated properly", () => {
      const wg = new WeightedGraph(new Graph(), new Map(), 0.1);
      const ret = Symbol();
      const arg: any = Symbol();
      // $ExpectFlowError
      wg._graph.nodes = jest.fn().mockReturnValue(ret);
      expect(wg.nodes(arg)).toBe(ret);
      expect(wg._graph.nodes).toHaveBeenCalledWith(arg);
    });
    it("hasEdge is delegated properly", () => {
      const wg = new WeightedGraph(new Graph(), new Map(), 0.1);
      const ret = Symbol();
      const arg: any = Symbol();
      // $ExpectFlowError
      wg._graph.hasEdge = jest.fn().mockReturnValue(ret);
      expect(wg.hasEdge(arg)).toBe(ret);
      expect(wg._graph.hasEdge).toHaveBeenCalledWith(arg);
    });
    it("edge is delegated properly", () => {
      const wg = new WeightedGraph(new Graph(), new Map(), 0.1);
      const ret = Symbol();
      const arg: any = Symbol();
      // $ExpectFlowError
      wg._graph.edge = jest.fn().mockReturnValue(ret);
      expect(wg.edge(arg)).toBe(ret);
      expect(wg._graph.edge).toHaveBeenCalledWith(arg);
    });
    it("edges is delegated properly", () => {
      const wg = new WeightedGraph(new Graph(), new Map(), 0.1);
      const ret = Symbol();
      const arg: any = Symbol();
      // $ExpectFlowError
      wg._graph.edges = jest.fn().mockReturnValue(ret);
      expect(wg.edges(arg)).toBe(ret);
      expect(wg._graph.edges).toHaveBeenCalledWith(arg);
    });
    it("neighbors is delegated properly", () => {
      const wg = new WeightedGraph(new Graph(), new Map(), 0.1);
      const ret = Symbol();
      const arg1: any = Symbol();
      const arg2: any = Symbol();
      // $ExpectFlowError
      wg._graph.neighbors = jest.fn().mockReturnValue(ret);
      expect(wg.neighbors(arg1, arg2)).toBe(ret);
      expect(wg._graph.neighbors).toHaveBeenCalledWith(arg1, arg2);
    });
  });

  describe("equals", () => {
    it("is invariant to the history of the graph", () => {
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
});
