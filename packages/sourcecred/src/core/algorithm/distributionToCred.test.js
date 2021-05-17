// @flow

import {NodeAddress} from "../graph";
import {distributionToCred} from "./distributionToCred";

describe("src/core/algorithm/distributionToCred", () => {
  const na = (...parts) => NodeAddress.fromParts(parts);
  describe("distributionToCred", () => {
    it("works in a case where all nodes are scoring", () => {
      const ds = [
        {
          interval: {startTimeMs: 0, endTimeMs: 10},
          intervalWeight: 2,
          distribution: new Float64Array([0.5, 0.5]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([0.5, 0.5]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
        {
          interval: {startTimeMs: 10, endTimeMs: 20},
          intervalWeight: 10,
          distribution: new Float64Array([0.9, 0.1]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([0.9, 0.1]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
      ];
      const nodeOrder = [na("foo"), na("bar")];
      const actual = distributionToCred(ds, nodeOrder, [NodeAddress.empty]);
      const expected = [
        {
          interval: {startTimeMs: 0, endTimeMs: 10},
          cred: new Float64Array([1, 1]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([1, 1]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
        {
          interval: {startTimeMs: 10, endTimeMs: 20},
          cred: new Float64Array([9, 1]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([9, 1]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
      ];
      expect(expected).toEqual(actual);
    });
    it("correctly handles multiple scoring prefixes", () => {
      const ds = [
        {
          interval: {startTimeMs: 0, endTimeMs: 10},
          intervalWeight: 2,
          distribution: new Float64Array([0.5, 0.5]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([0.5, 0.5]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
        {
          interval: {startTimeMs: 10, endTimeMs: 20},
          intervalWeight: 10,
          distribution: new Float64Array([0.9, 0.1]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([0.9, 0.1]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
      ];
      const nodeOrder = [na("foo"), na("bar")];
      const actual = distributionToCred(ds, nodeOrder, [na("foo"), na("bar")]);
      const expected = [
        {
          interval: {startTimeMs: 0, endTimeMs: 10},
          cred: new Float64Array([1, 1]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([1, 1]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
        {
          interval: {startTimeMs: 10, endTimeMs: 20},
          cred: new Float64Array([9, 1]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([9, 1]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
      ];
      expect(expected).toEqual(actual);
    });
    it("works in a case where some nodes are scoring", () => {
      const ds = [
        {
          interval: {startTimeMs: 0, endTimeMs: 10},
          intervalWeight: 2,
          distribution: new Float64Array([0.5, 0.5]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([0.5, 0.5]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
        {
          interval: {startTimeMs: 10, endTimeMs: 20},
          intervalWeight: 10,
          distribution: new Float64Array([0.9, 0.1]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([0.9, 0.1]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
      ];
      const nodeOrder = [na("foo"), na("bar")];
      const actual = distributionToCred(ds, nodeOrder, [na("bar")]);
      const expected = [
        {
          interval: {startTimeMs: 0, endTimeMs: 10},
          cred: new Float64Array([2, 2]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([2, 2]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
        {
          interval: {startTimeMs: 10, endTimeMs: 20},
          cred: new Float64Array([90, 10]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([90, 10]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
      ];
      expect(expected).toEqual(actual);
    });
    it("handles the case where no nodes are scoring", () => {
      const ds = [
        {
          interval: {startTimeMs: 0, endTimeMs: 10},
          intervalWeight: 2,
          distribution: new Float64Array([0.5, 0.5]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([2, 2]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
      ];
      const nodeOrder = [na("foo"), na("bar")];
      const actual = distributionToCred(ds, nodeOrder, []);
      const expected = [
        {
          interval: {startTimeMs: 0, endTimeMs: 10},
          cred: new Float64Array([0, 0]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([0, 0]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
      ];
      expect(actual).toEqual(expected);
    });

    it("handles the case where all nodes' cred sums to zero", () => {
      const ds = [
        {
          interval: {startTimeMs: 0, endTimeMs: 10},
          intervalWeight: 2,
          distribution: new Float64Array([1, 0]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([1, 0]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
      ];
      const nodeOrder = [na("foo"), na("bar")];
      const actual = distributionToCred(ds, nodeOrder, [na("bar")]);
      const expected = [
        {
          interval: {startTimeMs: 0, endTimeMs: 10},
          cred: new Float64Array([0, 0]),
          backwardFlow: new Float64Array([]),
          forwardFlow: new Float64Array([]),
          seedFlow: new Float64Array([0, 0]),
          syntheticLoopFlow: new Float64Array([0, 0]),
        },
      ];
      expect(actual).toEqual(expected);
    });

    it("re-normalizes all of the flows consistently", () => {
      const ds = [
        {
          interval: {startTimeMs: 0, endTimeMs: 10},
          intervalWeight: 2,
          distribution: new Float64Array([0.5, 0.5]),
          backwardFlow: new Float64Array([0.1, 0.2, 0.3]),
          forwardFlow: new Float64Array([0.3, 0.2, 0.1]),
          seedFlow: new Float64Array([0.5, 0.5]),
          syntheticLoopFlow: new Float64Array([0.1, 0.2]),
        },
        {
          interval: {startTimeMs: 10, endTimeMs: 20},
          intervalWeight: 10,
          distribution: new Float64Array([0.9, 0.1]),
          backwardFlow: new Float64Array([0.5, 0.2, 0.1]),
          forwardFlow: new Float64Array([0, 0.2, 0.1]),
          seedFlow: new Float64Array([0.9, 0.1]),
          syntheticLoopFlow: new Float64Array([0.01, 0.05]),
        },
      ];
      const nodeOrder = [na("foo"), na("bar")];
      const actual = distributionToCred(ds, nodeOrder, [NodeAddress.empty]);
      const expected = [
        {
          interval: {startTimeMs: 0, endTimeMs: 10},
          cred: new Float64Array([1, 1]),
          backwardFlow: new Float64Array([0.2, 0.4, 0.6]),
          forwardFlow: new Float64Array([0.6, 0.4, 0.2]),
          seedFlow: new Float64Array([1, 1]),
          syntheticLoopFlow: new Float64Array([0.2, 0.4]),
        },
        {
          interval: {startTimeMs: 10, endTimeMs: 20},
          cred: new Float64Array([9, 1]),
          backwardFlow: new Float64Array([5, 2, 1]),
          forwardFlow: new Float64Array([0, 2, 1]),
          seedFlow: new Float64Array([9, 1]),
          syntheticLoopFlow: new Float64Array([0.1, 0.5]),
        },
      ];
      expect(expected).toEqual(actual);
    });

    it("returns empty CredScores if no intervals are present", () => {
      expect(distributionToCred([], [], [])).toEqual([]);
    });
  });
});
