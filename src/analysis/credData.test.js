// @flow

import {computeCredData} from "./credData";
import type {TimelineCredScores} from "../core/algorithm/distributionToCred";

describe("src/analysis/credData", () => {
  it("handles empty scores correctly", () => {
    expect(computeCredData([])).toEqual({
      nodeSummaries: [],
      nodeOverTime: [],
      edgeSummaries: [],
      edgeOverTime: [],
      intervalEnds: [],
    });
  });
  it("handles non-empty scores correctly", () => {
    const scores: TimelineCredScores = [
      {
        interval: {startTimeMs: 0, endTimeMs: 100},
        cred: new Float64Array([4, 5]),
        forwardFlow: new Float64Array([1]),
        backwardFlow: new Float64Array([2]),
        seedFlow: new Float64Array([0, 1]),
        syntheticLoopFlow: new Float64Array([0.1, 0]),
      },
      {
        interval: {startTimeMs: 100, endTimeMs: 200},
        cred: new Float64Array([10, 1]),
        forwardFlow: new Float64Array([1]),
        backwardFlow: new Float64Array([0]),
        seedFlow: new Float64Array([0, 1]),
        syntheticLoopFlow: new Float64Array([0.1, 0]),
      },
    ];
    const expected = {
      intervalEnds: [100, 200],
      nodeSummaries: [
        {cred: 14, seedFlow: 0, syntheticLoopFlow: 0.2},
        {cred: 6, seedFlow: 2, syntheticLoopFlow: 0},
      ],
      nodeOverTime: [
        {cred: [4, 10], seedFlow: [0, 0], syntheticLoopFlow: [0.1, 0.1]},
        {cred: [5, 1], seedFlow: [1, 1], syntheticLoopFlow: [0, 0]},
      ],
      edgeSummaries: [
        {
          forwardFlow: 2,
          backwardFlow: 2,
        },
      ],
      edgeOverTime: [{forwardFlow: [1, 1], backwardFlow: [2, 0]}],
    };
    expect(computeCredData(scores)).toEqual(expected);
  });
});
