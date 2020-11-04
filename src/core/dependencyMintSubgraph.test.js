// @flow

import {type TimestampMs} from "../util/timestamp";
import {type WeightedGraph as WeightedGraphT} from "./weightedGraph";
import {Graph, NodeAddress} from "./graph";
import {empty as emptyWeights} from "./weights";
import {
  dependencySubgraph,
  intervalsWithMinting,
  computeTotalMintedCredPerIntervals,
  mintEdgeAddress,
  mintNode,
} from "./dependencyMintSubgraph";
import {utcWeek} from "d3-time";

class TestWeightedGraph {
  wg: WeightedGraphT;
  constructor() {
    this.wg = {weights: emptyWeights(), graph: new Graph()};
  }
  addNode(opts: {|
    +id: number,
    +timestampMs: TimestampMs,
    +mint: number,
  |}): TestWeightedGraph {
    const {id, timestampMs, mint} = opts;
    const address = NodeAddress.fromParts([String(id)]);
    this.wg.weights.nodeWeights.set(address, mint);
    this.wg.graph.addNode({address, description: String(id), timestampMs});
    return this;
  }
}

describe("core/dependencyMintSubgraph", () => {
  // Since we are hardcoded to week-based time partitioning, generate some
  // week-spaced timestamps
  const w1 = +utcWeek.floor(0);
  const w2 = +utcWeek.ceil(0);
  const w3 = +utcWeek.ceil(w2 + 1);
  expect(w3).toBeGreaterThan(w2);
  expect(w2).toBeGreaterThan(w1);

  describe("computeTotalMintedCredPerIntervals", () => {
    it("handles an empty graph", () => {
      const wg = new TestWeightedGraph().wg;
      expect(computeTotalMintedCredPerIntervals(wg)).toEqual([]);
    });
    it("handles a graph with no minting", () => {
      const wg = new TestWeightedGraph()
        .addNode({id: 0, mint: 0, timestampMs: w1})
        .addNode({id: 1, mint: 0, timestampMs: w2}).wg;
      expect(computeTotalMintedCredPerIntervals(wg)).toEqual([
        {startTimeMs: w1, totalMint: 0},
        {startTimeMs: w2, totalMint: 0},
      ]);
    });
    it("handles a graph with minting", () => {
      const wg = new TestWeightedGraph()
        .addNode({id: 0, mint: 1, timestampMs: w1})
        .addNode({id: 1, mint: 3, timestampMs: w3}).wg;
      expect(computeTotalMintedCredPerIntervals(wg)).toEqual([
        {startTimeMs: w1, totalMint: 1},
        {startTimeMs: w2, totalMint: 0},
        {startTimeMs: w3, totalMint: 3},
      ]);
    });
  });

  describe("intervalsWithMinting", () => {
    it("yields 0 weight if there are no periods", () => {
      const intervals = [
        {startTimeMs: w1, totalMint: 1},
        {startTimeMs: w2, totalMint: 2},
      ];
      const periods = [];
      const expected = intervals.map((mintInterval) => ({
        startTimeMs: mintInterval.startTimeMs,
        mintAmount: 0,
      }));
      expect(Array.from(intervalsWithMinting(intervals, periods))).toEqual(
        expected
      );
    });
    it("handles a simple case of interval-aligned periods", () => {
      const intervals = [
        {startTimeMs: w1, totalMint: 1},
        {startTimeMs: w2, totalMint: 2},
      ];
      const periods = [
        {startTimeMs: w1, weight: 0.5},
        {startTimeMs: w2, weight: 0.8},
      ];
      const expected = [
        {startTimeMs: w1, mintAmount: 0.5},
        {startTimeMs: w2, mintAmount: 1.6},
      ];
      expect(Array.from(intervalsWithMinting(intervals, periods))).toEqual(
        expected
      );
    });
    it("handles a starting period at -Infinity", () => {
      const intervals = [
        {startTimeMs: w1, totalMint: 1},
        {startTimeMs: w2, totalMint: 2},
      ];
      const periods = [{startTimeMs: -Infinity, weight: 0.5}];
      const expected = [
        {startTimeMs: w1, mintAmount: 0.5},
        {startTimeMs: w2, mintAmount: 1},
      ];
      expect(Array.from(intervalsWithMinting(intervals, periods))).toEqual(
        expected
      );
    });
    it("handles offset periods", () => {
      const intervals = [
        {startTimeMs: w1, totalMint: 1},
        {startTimeMs: w2, totalMint: 2},
      ];
      const periods = [{startTimeMs: w1 + 1, weight: 0.5}];
      const expected = [
        {startTimeMs: w1, mintAmount: 0},
        {startTimeMs: w2, mintAmount: 1},
      ];
      expect(Array.from(intervalsWithMinting(intervals, periods))).toEqual(
        expected
      );
    });
    it("skips periods that are sandwiched", () => {
      const intervals = [
        {startTimeMs: w1, totalMint: 1},
        {startTimeMs: w2, totalMint: 2},
      ];
      const periods = [
        {startTimeMs: w1 + 1, weight: 0.5},
        {startTimeMs: w1 + 1, weight: 0.9},
      ];
      const expected = [
        {startTimeMs: w1, mintAmount: 0},
        {startTimeMs: w2, mintAmount: 1.8},
      ];
      expect(Array.from(intervalsWithMinting(intervals, periods))).toEqual(
        expected
      );
    });
  });

  describe("dependencySubgraph", () => {
    it("adds nothing if there are no policies", () => {
      const wg = new TestWeightedGraph()
        .addNode({id: 1, mint: 3, timestampMs: w1})
        .addNode({id: 2, mint: 4, timestampMs: w2}).wg;
      const sg = dependencySubgraph(wg, []);
      expect(sg.graph.equals(new Graph())).toBe(true);
      expect(sg.weights).toEqual(emptyWeights());
    });
    it("only contains recipient if there is no minting", () => {
      const wg = new TestWeightedGraph()
        .addNode({id: 1, mint: 3, timestampMs: w1})
        .addNode({id: 2, mint: 4, timestampMs: w2}).wg;
      const recipient = {
        address: NodeAddress.fromParts(["recipient"]),
        description: "recipient",
        timestampMs: null,
      };
      wg.graph.addNode(recipient);
      wg.weights.nodeWeights.set(recipient.address, 0);
      const policy = {address: recipient.address, periods: []};

      const expectedGraph = new Graph().addNode(recipient);
      const expectedWeights = emptyWeights();

      const sg = dependencySubgraph(wg, [policy]);
      expect(sg.graph.equals(expectedGraph)).toBe(true);
      expect(sg.weights).toEqual(expectedWeights);
    });
    it("adds dependency mint periods as expected", () => {
      const wg = new TestWeightedGraph()
        .addNode({id: 1, mint: 3, timestampMs: w1})
        .addNode({id: 2, mint: 4, timestampMs: w2}).wg;
      const recipient = {
        address: NodeAddress.fromParts(["recipient"]),
        description: "recipient",
        timestampMs: null,
      };
      wg.graph.addNode(recipient);
      wg.weights.nodeWeights.set(recipient.address, 0);
      const policy = {
        address: recipient.address,
        periods: [{startTimeMs: w2, weight: 1}],
      };
      const sg = dependencySubgraph(wg, [policy]);
      const node = mintNode(recipient, w2);
      const edge = {
        src: node.address,
        dst: recipient.address,
        address: mintEdgeAddress(recipient, w2),
        timestampMs: w2,
      };
      const expectedGraph = new Graph()
        .addNode(recipient)
        .addNode(node)
        .addEdge(edge);
      expect(sg.graph.equals(expectedGraph)).toBe(true);
      const expectedWeights = emptyWeights();
      expectedWeights.nodeWeights.set(node.address, 4);
      expect(sg.weights).toEqual(expectedWeights);
    });
    it("errors if the recipient is not in the graph", () => {
      const wg = new TestWeightedGraph()
        .addNode({id: 1, mint: 3, timestampMs: w1})
        .addNode({id: 2, mint: 4, timestampMs: w2}).wg;
      const recipient = {
        address: NodeAddress.fromParts(["recipient"]),
        description: "recipient",
        timestampMs: null,
      };
      const policy = {
        address: recipient.address,
        periods: [{startTimeMs: w2, weight: 1}],
      };
      const fail = () => dependencySubgraph(wg, [policy]);
      expect(fail).toThrowError("dependency not in graph");
    });
  });
});
