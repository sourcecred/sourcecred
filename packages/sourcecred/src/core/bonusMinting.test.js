// @flow

import {type TimestampMs} from "../util/timestamp";
import deepFreeze from "deep-freeze";
import {Graph, NodeAddress} from "./graph";
import {intervalSequence} from "./interval";
import {type WeightedGraph as WeightedGraphT} from "./weightedGraph";
import {empty as emptyWeights} from "./weights";
import {utcWeek} from "d3-time";
import {
  _alignPeriodsToIntervals,
  processBonusPolicy,
  computeBonusMinting,
  createBonusGraph,
  _computeMintIntervals,
  bonusIntervals,
  BONUS_EDGE_PREFIX,
  BONUS_EDGE_WEIGHT,
  bonusNode,
  bonusNodeAddress,
  bonusEdge,
} from "./bonusMinting";

describe("core/bonusMinting", () => {
  describe("createBonusGraph", () => {
    it("adds no nodes or node weights if there is no minting", () => {
      const wg = createBonusGraph([]);
      expect(wg.graph.equals(new Graph())).toBe(true);
      expect(wg.weights.nodeWeights).toEqual(new Map());
    });
    it("adds the bonus edge prefix weight even without minting", () => {
      const {weights} = createBonusGraph([]);
      const expectedEdgeWeights = new Map().set(
        BONUS_EDGE_PREFIX,
        BONUS_EDGE_WEIGHT
      );
      expect(weights.edgeWeights).toEqual(expectedEdgeWeights);
    });
    it("only contains recipient if there is no minting", () => {
      const recipient = {
        address: NodeAddress.fromParts(["recipient"]),
        description: "recipient",
        timestampMs: null,
      };
      const mint = {recipient, bonusIntervals: []};

      const expectedGraph = new Graph().addNode(recipient);
      const expectedWeights = emptyWeights();
      expectedWeights.edgeWeights.set(BONUS_EDGE_PREFIX, BONUS_EDGE_WEIGHT);

      const wg = createBonusGraph([mint]);
      expect(wg.graph.equals(expectedGraph)).toBe(true);
      expect(wg.weights).toEqual(expectedWeights);
    });
    it("adds nodes, edges, and weights when there is minting", () => {
      const recipient = {
        address: NodeAddress.fromParts(["recipient"]),
        description: "recipient",
        timestampMs: null,
      };
      const interval = {startTimeMs: 101, endTimeMs: 102};
      const bonusInterval = {
        interval,
        amount: 10,
      };
      const mint = {recipient, bonusIntervals: [bonusInterval]};

      const expectedGraph = new Graph()
        .addNode(recipient)
        .addNode(bonusNode(recipient, interval))
        .addEdge(bonusEdge(recipient, interval));
      const expectedWeights = emptyWeights();
      expectedWeights.nodeWeights.set(
        bonusNodeAddress(recipient, interval),
        10
      );
      expectedWeights.edgeWeights.set(BONUS_EDGE_PREFIX, BONUS_EDGE_WEIGHT);

      const wg = createBonusGraph([mint]);
      expect(wg.graph.equals(expectedGraph)).toBe(true);
      expect(wg.weights).toEqual(expectedWeights);
    });
  });

  describe("node and edge methods", () => {
    const recipient = deepFreeze({
      address: NodeAddress.fromParts(["1"]),
      timestampMs: null,
      description: "recipient",
    });
    const interval = deepFreeze({startTimeMs: 1, endTimeMs: 2});
    const expectedAddress = bonusNodeAddress(recipient, interval);
    it("bonusNode works", () => {
      const node = bonusNode(recipient, interval);
      expect(node.address).toEqual(expectedAddress);
      expect(node.timestampMs).toEqual(interval.startTimeMs);
      expect(node.description).toMatchInlineSnapshot(
        `"bonus minting for recipient starting 1"`
      );
    });
    it("bonusEdge works", () => {
      const edge = bonusEdge(recipient, interval);
      expect(edge.timestampMs).toEqual(interval.startTimeMs);
      expect(edge.dst).toEqual(recipient.address);
      expect(edge.src).toEqual(expectedAddress);
    });
  });

  describe("methods operating on weighted graphs", () => {
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
    // Since we are hardcoded to week-based time partitioning, generate some
    // week-spaced timestamps
    const w1 = +utcWeek.floor(0);
    const w2 = +utcWeek.ceil(0);
    const w3 = +utcWeek.ceil(w2 + 1);
    const w4 = +utcWeek.ceil(w3 + 1);
    expect(w4).toBeGreaterThan(w3);
    expect(w3).toBeGreaterThan(w2);
    expect(w2).toBeGreaterThan(w1);

    describe("computeBonusMinting", () => {
      // This method is a wrapper around methods which are individually well tested,
      // so a smoke/integration test here is fine.
      it("works on a representative case", () => {
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
          periods: [{startTimeMs: w1, weight: 0.5}],
        };
        const minting = computeBonusMinting(wg, [policy]);
        const expected = [
          {
            recipient,
            bonusIntervals: [
              {interval: {startTimeMs: w1, endTimeMs: w2}, amount: 1.5},
              {interval: {startTimeMs: w2, endTimeMs: w3}, amount: 2},
            ],
          },
        ];
        expect(minting).toEqual(expected);
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
          periods: [{startTimeMs: w1, weight: 0.5}],
        };
        const fail = () => computeBonusMinting(wg, [policy]);
        expect(fail).toThrowError("bonus recipient not in graph");
      });
    });

    describe("_computeMintIntervals", () => {
      it("handles an empty graph", () => {
        const wg = new TestWeightedGraph().wg;
        expect(_computeMintIntervals(wg)).toEqual([]);
      });
      it("handles a graph with no minting", () => {
        const wg = new TestWeightedGraph()
          .addNode({id: 0, mint: 0, timestampMs: w1})
          .addNode({id: 1, mint: 0, timestampMs: w2}).wg;
        expect(_computeMintIntervals(wg)).toEqual([
          {interval: {startTimeMs: w1, endTimeMs: w2}, totalMint: 0},
          {interval: {startTimeMs: w2, endTimeMs: w3}, totalMint: 0},
        ]);
      });
      it("handles a graph with minting", () => {
        const wg = new TestWeightedGraph()
          .addNode({id: 0, mint: 1, timestampMs: w1})
          .addNode({id: 1, mint: 3, timestampMs: w3}).wg;
        expect(_computeMintIntervals(wg)).toEqual([
          {interval: {startTimeMs: w1, endTimeMs: w2}, totalMint: 1},
          {interval: {startTimeMs: w2, endTimeMs: w3}, totalMint: 0},
          {interval: {startTimeMs: w3, endTimeMs: w4}, totalMint: 3},
        ]);
      });
    });

    describe("bonusIntervals", () => {
      it("yields 0 weight if there are no periods", () => {
        const mintIntervals = [
          {interval: {startTimeMs: w1, endTimeMs: w2}, totalMint: 1},
          {interval: {startTimeMs: w2, endTimeMs: w3}, totalMint: 2},
        ];
        const periods = [];
        const expected = mintIntervals.map((mintInterval) => ({
          interval: mintInterval.interval,
          amount: 0,
        }));
        expect(Array.from(bonusIntervals(mintIntervals, periods))).toEqual(
          expected
        );
      });
      it("handles a simple case of interval-aligned periods", () => {
        const mintIntervals = [
          {interval: {startTimeMs: w1, endTimeMs: w2}, totalMint: 1},
          {interval: {startTimeMs: w2, endTimeMs: w3}, totalMint: 2},
        ];
        const periods = [
          {startTimeMs: w1, weight: 0.5},
          {startTimeMs: w2, weight: 0.8},
        ];
        const expected = [
          {interval: {startTimeMs: w1, endTimeMs: w2}, amount: 0.5},
          {interval: {startTimeMs: w2, endTimeMs: w3}, amount: 1.6},
        ];
        expect(Array.from(bonusIntervals(mintIntervals, periods))).toEqual(
          expected
        );
      });
      it("handles a starting period at -Infinity", () => {
        const mintIntervals = [
          {interval: {startTimeMs: w1, endTimeMs: w2}, totalMint: 1},
          {interval: {startTimeMs: w2, endTimeMs: w3}, totalMint: 2},
        ];
        const periods = [{startTimeMs: -Infinity, weight: 0.5}];
        const expected = [
          {interval: {startTimeMs: w1, endTimeMs: w2}, amount: 0.5},
          {interval: {startTimeMs: w2, endTimeMs: w3}, amount: 1},
        ];
        expect(Array.from(bonusIntervals(mintIntervals, periods))).toEqual(
          expected
        );
      });
      it("handles offset periods", () => {
        const mintIntervals = [
          {interval: {startTimeMs: w1, endTimeMs: w2}, totalMint: 1},
          {interval: {startTimeMs: w2, endTimeMs: w3}, totalMint: 2},
        ];
        const periods = [{startTimeMs: w1 + 1, weight: 0.5}];
        const expected = [
          {interval: {startTimeMs: w1, endTimeMs: w2}, amount: 0},
          {interval: {startTimeMs: w2, endTimeMs: w3}, amount: 1},
        ];
        expect(Array.from(bonusIntervals(mintIntervals, periods))).toEqual(
          expected
        );
      });
      it("skips periods that are sandwiched", () => {
        const mintIntervals = [
          {interval: {startTimeMs: w1, endTimeMs: w2}, totalMint: 1},
          {interval: {startTimeMs: w2, endTimeMs: w3}, totalMint: 2},
        ];
        const periods = [
          {startTimeMs: w1 + 1, weight: 0.5},
          {startTimeMs: w1 + 1, weight: 0.9},
        ];
        const expected = [
          {interval: {startTimeMs: w1, endTimeMs: w2}, amount: 0},
          {interval: {startTimeMs: w2, endTimeMs: w3}, amount: 1.8},
        ];
        expect(Array.from(bonusIntervals(mintIntervals, periods))).toEqual(
          expected
        );
      });
    });
  });

  describe("_alignPeriodsToIntervals", () => {
    it("handles a case with no periods and no intervals", () => {
      expect(_alignPeriodsToIntervals([], [])).toEqual([]);
    });
    it("handles a case with no periods and intervals", () => {
      expect(_alignPeriodsToIntervals([], [1, 2])).toEqual([0, 0]);
    });
    it("handles a case with a single period that spans all time", () => {
      const period = {startTimeMs: -Infinity, weight: 0.5};
      expect(_alignPeriodsToIntervals([period], [1, 2])).toEqual([0.5, 0.5]);
    });
    it("handles a case with a single period that starts midway", () => {
      const period = {startTimeMs: 1, weight: 0.5};
      expect(_alignPeriodsToIntervals([period], [0, 1, 2])).toEqual([
        0,
        0.5,
        0.5,
      ]);
    });
    it("handles a case with a multiple periods", () => {
      const period1 = {startTimeMs: 10, weight: 0.5};
      const period2 = {startTimeMs: 20, weight: 0.1};
      expect(
        _alignPeriodsToIntervals([period1, period2], [0, 5, 10, 15, 20, 25])
      ).toEqual([0, 0, 0.5, 0.5, 0.1, 0.1]);
    });
    it("handles a case where the period starts in-between intervals", () => {
      const period1 = {startTimeMs: 15, weight: 0.5};
      expect(_alignPeriodsToIntervals([period1], [0, 10, 20])).toEqual([
        0,
        0,
        0.5,
      ]);
    });
    it("handles a case where there are multiple periods within one interval", () => {
      const period1 = {startTimeMs: 15, weight: 0.5};
      const period2 = {startTimeMs: 16, weight: 0.1};
      expect(
        _alignPeriodsToIntervals([period1, period2], [0, 10, 20])
      ).toEqual([0, 0, 0.1]);
    });
    it("ignores a period if the next period has the same startTime", () => {
      const period1 = {startTimeMs: 1, weight: 0.5};
      const period2 = {startTimeMs: 1, weight: 0.1};
      expect(_alignPeriodsToIntervals([period1, period2], [0, 1, 2])).toEqual([
        0,
        0.1,
        0.1,
      ]);
    });
    it("ignores all periods if they all start in the future", () => {
      const period1 = {startTimeMs: 10, weight: 0.5};
      const period2 = {startTimeMs: 15, weight: 0.1};
      expect(_alignPeriodsToIntervals([period1, period2], [0, 1, 2])).toEqual([
        0,
        0,
        0,
      ]);
    });
    it("errors if periods are out-of-rder", () => {
      const period1 = {startTimeMs: 10, weight: 0.5};
      const period2 = {startTimeMs: 15, weight: 0.1};
      const thunk = () =>
        _alignPeriodsToIntervals([period2, period1], [0, 1, 2]);
      expect(thunk).toThrowError("mint periods out of order: 15 > 10");
    });
    it("errors if any mint weights are invalid", () => {
      const bads = [-1, NaN, Infinity, -Infinity];
      for (const b of bads) {
        const period = {startTimeMs: 10, weight: b};
        const thunk = () => _alignPeriodsToIntervals([period], [0, 1, 2]);
        expect(thunk).toThrowError("invalid mint weight");
      }
    });
  });

  describe("processBonusPolicy", () => {
    const n1 = NodeAddress.fromParts(["1"]);
    const n2 = NodeAddress.fromParts(["2"]);
    const n3 = NodeAddress.fromParts(["3"]);
    const nx = NodeAddress.fromParts(["x"]);
    const nodeOrder = deepFreeze([n1, n2, n3]);
    const intervals = deepFreeze(
      intervalSequence([
        {startTimeMs: 1, endTimeMs: 2},
        {startTimeMs: 2, endTimeMs: 3},
        {startTimeMs: 3, endTimeMs: 4},
        {startTimeMs: 4, endTimeMs: 5},
      ])
    );
    const periods = [deepFreeze({startTimeMs: 2, weight: 0.5})];
    it("converts the address and periods correctly", () => {
      const policy = {address: n2, periods};
      const intervalStarts = intervals.map((i) => i.startTimeMs);
      const intervalWeights = _alignPeriodsToIntervals(periods, intervalStarts);
      const actual = processBonusPolicy(policy, nodeOrder, intervals);
      const expected = {nodeIndex: 1, intervalWeights};
      expect(actual).toEqual(expected);
    });
    it("errors if the node address isn't in the ordering", () => {
      const policy = {address: nx, periods};
      const thunk = () => processBonusPolicy(policy, nodeOrder, intervals);
      expect(thunk).toThrowError("address not in nodeOrder");
    });
  });
});
