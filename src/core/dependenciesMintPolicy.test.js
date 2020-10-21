// @flow

import deepFreeze from "deep-freeze";
import {NodeAddress} from "./graph";
import {
  _alignPeriodsToIntervals,
  processMintPolicy,
} from "./dependenciesMintPolicy";
import {intervalSequence} from "./interval";
import * as uuid from "../util/uuid";

describe("core/dependenciesMintPolicy", () => {
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

  describe("processMintPolicy", () => {
    const id = uuid.fromString("YVZhbGlkVXVpZEF0TGFzdA");
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
      const policy = {
        address: n2,
        periods,
        id,
      };
      const intervalStarts = intervals.map((i) => i.startTimeMs);
      const intervalWeights = _alignPeriodsToIntervals(periods, intervalStarts);
      const actual = processMintPolicy(policy, nodeOrder, intervals);
      const expected = {nodeIndex: 1, intervalWeights};
      expect(actual).toEqual(expected);
    });
    it("errors if the node address isn't in the ordering", () => {
      const policy = {address: nx, periods, id};
      const thunk = () => processMintPolicy(policy, nodeOrder, intervals);
      expect(thunk).toThrowError("address not in nodeOrder");
    });
  });
});
