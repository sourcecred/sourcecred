// @flow

import {computeCredData, compressByThreshold} from "./credData";
import type {TimelineCredScores} from "../core/algorithm/distributionToCred";
import type {BonusPolicy} from "../core/bonusMinting";
import {NodeAddress} from "../core/graph";
import {IDENTITY_PREFIX} from "../core/identity";
import {intervalSequence} from "../core/interval";

describe("src/analysis/credData", () => {
  it("handles empty scores correctly", () => {
    expect(computeCredData([], [], [])).toEqual({
      nodeSummaries: [],
      nodeOverTime: [],
      edgeSummaries: [],
      edgeOverTime: [],
      intervals: [],
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
      intervals: [
        {startTimeMs: 0, endTimeMs: 100},
        {startTimeMs: 100, endTimeMs: 200},
      ],
      nodeSummaries: [
        {
          cred: 14,
          seedFlow: 0,
          syntheticLoopFlow: 0.2,
          dependencyMintedCred: 0,
        },
        {cred: 6, seedFlow: 2, syntheticLoopFlow: 0, dependencyMintedCred: 0},
      ],
      nodeOverTime: [
        {
          cred: [4, 10],
          seedFlow: [0, 0],
          syntheticLoopFlow: [0.1, 0.1],
          dependencyMintedCred: [0, 0],
        },
        {
          cred: [5, 1],
          seedFlow: [1, 1],
          syntheticLoopFlow: [0, 0],
          dependencyMintedCred: [0, 0],
        },
      ],
      edgeSummaries: [
        {
          forwardFlow: 2,
          backwardFlow: 2,
        },
      ],
      edgeOverTime: [{forwardFlow: [1, 1], backwardFlow: [2, 0]}],
    };
    const nodeOrder = [
      NodeAddress.fromParts(["foo"]),
      NodeAddress.fromParts(["bar"]),
    ];
    expect(computeCredData(scores, nodeOrder, [])).toEqual(expected);
  });
  it("handles dependency minting properly", () => {
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
    const bonusPolicies: BonusPolicy[] = [
      {
        address: IDENTITY_PREFIX,
        periods: [{weight: 0.5, startTimeMs: -Infinity}],
      },
    ];
    const expected = {
      intervals: [
        {startTimeMs: 0, endTimeMs: 100},
        {startTimeMs: 100, endTimeMs: 200},
      ],
      nodeSummaries: [
        {
          // 14 base + 2 from interval1 + 5 from interval2
          cred: 21,
          seedFlow: 0,
          syntheticLoopFlow: 0.2,
          dependencyMintedCred: 7,
        },
        {cred: 6, seedFlow: 2, syntheticLoopFlow: 0, dependencyMintedCred: 0},
      ],
      nodeOverTime: [
        {
          cred: [4 + 2, 10 + 5],
          seedFlow: [0, 0],
          syntheticLoopFlow: [0.1, 0.1],
          dependencyMintedCred: [2, 5],
        },
        {
          cred: [5, 1],
          seedFlow: [1, 1],
          syntheticLoopFlow: [0, 0],
          dependencyMintedCred: [0, 0],
        },
      ],
      edgeSummaries: [
        {
          forwardFlow: 2,
          backwardFlow: 2,
        },
      ],
      edgeOverTime: [{forwardFlow: [1, 1], backwardFlow: [2, 0]}],
    };
    // Only the first node address is a participant, so we mint
    // based on its Cred alone.
    const nodeOrder = [IDENTITY_PREFIX, NodeAddress.empty];
    expect(computeCredData(scores, nodeOrder, bonusPolicies)).toEqual(expected);
  });
  it("compresses by threshold correctly", () => {
    const intervals = intervalSequence([
      {startTimeMs: 0, endTimeMs: 100},
      {startTimeMs: 100, endTimeMs: 200},
    ]);
    const nodeSummaries = [
      {cred: 14, seedFlow: 0, syntheticLoopFlow: 0.2, dependencyMintedCred: 0},
      {cred: 20, seedFlow: 20, syntheticLoopFlow: 0, dependencyMintedCred: 0},
      {cred: 1, seedFlow: 1, syntheticLoopFlow: 0, dependencyMintedCred: 0},
    ];
    const nodeOverTime = [
      {
        cred: [4, 10],
        seedFlow: [0, 0],
        syntheticLoopFlow: [0.1, 0.1],
        dependencyMintedCred: [0, 0],
      },
      {
        cred: [10, 10],
        seedFlow: [10, 10],
        syntheticLoopFlow: [0, 0],
        dependencyMintedCred: [0, 0],
      },
      {
        cred: [5, 0],
        seedFlow: [0, 0],
        syntheticLoopFlow: [0, 0],
        dependencyMintedCred: [0, 0],
      },
    ];
    const edgeSummaries = [
      {forwardFlow: 20, backwardFlow: 2},
      {
        forwardFlow: 10,
        backwardFlow: 10,
      },
      {forwardFlow: 1, backwardFlow: 1},
    ];
    const edgeOverTime = [
      {forwardFlow: [19, 1], backwardFlow: [2, 0]},
      {forwardFlow: [5, 5], backwardFlow: [9, 1]},
      {forwardFlow: [1, 0], backwardFlow: [0, 1]},
    ];
    const input = {
      intervals,
      nodeSummaries,
      nodeOverTime,
      edgeSummaries,
      edgeOverTime,
    };
    const expected = {
      intervals,
      nodeSummaries,
      nodeOverTime: [
        {
          cred: [4, 10],
          seedFlow: null,
          syntheticLoopFlow: null,
          dependencyMintedCred: null,
        },
        {
          cred: [10, 10],
          seedFlow: [10, 10],
          syntheticLoopFlow: null,
          dependencyMintedCred: null,
        },
        null,
      ],
      edgeSummaries,
      edgeOverTime: [
        {forwardFlow: [19, 1], backwardFlow: null},
        {forwardFlow: [5, 5], backwardFlow: [9, 1]},
        null,
      ],
    };
    const result = compressByThreshold(input, 10);
    expect(result).toEqual(expected);
    // Check that it's idempotent too.
    expect(compressByThreshold(result, 10)).toEqual(result);
  });
});
