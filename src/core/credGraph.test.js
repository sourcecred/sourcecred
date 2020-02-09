// @flow

import deepFreeze from "deep-freeze";
import {NodeAddress} from "./graph";
import * as CredGraph from "./credGraph";
import * as WeightedGraph from "./weightedGraph";
import {weekIntervals} from "./interval";

describe("core/credGraph", () => {
  const scoreAddress = NodeAddress.fromParts(["score"]);
  const exampleParams = deepFreeze({
    alpha: 0.5,
    intervalDecay: 0,
    scoringNodePrefixes: [NodeAddress.empty],
  });
  function expectScoresClose(
    as: $ReadOnlyArray<Float64Array>,
    bs: $ReadOnlyArray<Float64Array>
  ) {
    expect(as.length).toEqual(bs.length);
    for (let i = 0; i < as.length; i++) {
      expect(as[i].length).toEqual(bs[i].length);
      for (let j = 0; j < as[i].length; j++) {
        expect(as[i][j]).toBeCloseTo(bs[i][j]);
      }
    }
  }

  it("is an error to manually construct a CredGraph", () => {
    const weightedGraph = WeightedGraph.empty();
    const timelineCredScores = {intervals: [], intervalCredScores: []};
    const params = {alpha: 0.5, intervalDecay: 0.3, scoringNodePrefixes: []};
    // $ExpectFlowError
    const _unused_credGraph: CredGraphT = {
      weightedGraph,
      timelineCredScores,
      params,
    };
  });

  // compute has smoke testing -- it is a lightweight composition of other highly-tested
  // components, so we don't try to hit all the edge cases here.
  describe("compute", () => {
    it("produces an empty CredGraph for an empty WeightedGraph", async () => {
      const empty = WeightedGraph.empty();
      const result = await CredGraph.compute(empty, exampleParams);
      expect(result.weightedGraph).toEqual(empty);
      expect(result.params).toEqual(exampleParams);
      expect(result.timelineCredScores).toEqual({
        intervals: [],
        intervalCredScores: [],
      });
    });
    it("produces a valid CredGraph for a single-node graph", async () => {
      const wg = WeightedGraph.empty();
      wg.graph.addNode({
        address: scoreAddress,
        timestampMs: 0,
        description: "node",
      });
      wg.weights.nodeWeights.set(scoreAddress, 1337);
      const credGraph = await CredGraph.compute(wg, exampleParams);
      expect(credGraph.weightedGraph).toEqual(wg);
      expect(credGraph.params).toEqual(exampleParams);
      const {intervals, intervalCredScores} = credGraph.timelineCredScores;
      expect(intervals).toEqual(weekIntervals(0, 0));
      expectScoresClose(intervalCredScores, [new Float64Array([1337])]);
    });
    it("produces a valid CredGraph for a multi-node, multi-interval graph", async () => {
      const ts0 = 0;
      // Get a timestamp in the next week
      const ts1 = weekIntervals(0, 0)[0].endTimeMs + 100;
      const wg = WeightedGraph.empty();
      const otherAddress = NodeAddress.fromParts(["other"]);
      wg.graph.addNode({
        address: scoreAddress,
        timestampMs: ts0,
        description: "node",
      });
      wg.graph.addNode({
        address: otherAddress,
        timestampMs: ts1,
        description: "node",
      });
      wg.weights.nodeWeights.set(scoreAddress, 1337);
      wg.weights.nodeWeights.set(otherAddress, 420);
      const credGraph = await CredGraph.compute(wg, exampleParams);
      expect(credGraph.weightedGraph).toEqual(wg);
      expect(credGraph.params).toEqual(exampleParams);
      const {intervals, intervalCredScores} = credGraph.timelineCredScores;
      const expectedIntervals = weekIntervals(ts0, ts1);
      expect(intervals).toEqual(expectedIntervals);
      const expectedCredScores = [
        new Float64Array([0, 1337]),
        new Float64Array([420, 0]),
      ];
      expectScoresClose(intervalCredScores, expectedCredScores);
    });
  });
});
