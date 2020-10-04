// @flow

import {_chooseDistributionIntervals} from "./applyDistributions";
import {intervalSequence} from "../core/interval";

describe("ledger/applyDistributions", () => {
  describe("_chooseDistributionIntervals", () => {
    it("handles a case where we want to distribute for every interval except latest", () => {
      const credIntervals = intervalSequence([
        {startTimeMs: 0, endTimeMs: 100},
        {startTimeMs: 100, endTimeMs: 200},
        {startTimeMs: 200, endTimeMs: 300},
      ]);
      const lastDistributionTimestamp = -Infinity;
      const maxSimultaneousDistributions = Infinity;
      const expected = [
        {startTimeMs: 0, endTimeMs: 100},
        {startTimeMs: 100, endTimeMs: 200},
      ];
      expect(
        _chooseDistributionIntervals(
          credIntervals,
          lastDistributionTimestamp,
          299,
          maxSimultaneousDistributions
        )
      ).toEqual(expected);
    });
    it("handles the case where maxSimultaneousDistributions === 0", () => {
      const credIntervals = intervalSequence([
        {startTimeMs: 0, endTimeMs: 100},
        {startTimeMs: 100, endTimeMs: 200},
        {startTimeMs: 200, endTimeMs: 300},
      ]);
      const lastDistributionTimestamp = -Infinity;
      const maxSimultaneousDistributions = 0;
      const expected = [];
      expect(
        _chooseDistributionIntervals(
          credIntervals,
          lastDistributionTimestamp,
          299,
          maxSimultaneousDistributions
        )
      ).toEqual(expected);
    });
    it("handles the case where we've already distributed for the finished intervals", () => {
      const credIntervals = intervalSequence([
        {startTimeMs: 0, endTimeMs: 100},
        {startTimeMs: 100, endTimeMs: 200},
        {startTimeMs: 200, endTimeMs: 300},
      ]);
      const lastDistributionTimestamp = 2;
      const maxSimultaneousDistributions = 0;
      const expected = [];
      expect(
        _chooseDistributionIntervals(
          credIntervals,
          lastDistributionTimestamp,
          299,
          maxSimultaneousDistributions
        )
      ).toEqual(expected);
    });
    it("handles the case where we're limited by maxSimultaneousDistributions", () => {
      const credIntervals = intervalSequence([
        {startTimeMs: 0, endTimeMs: 100},
        {startTimeMs: 100, endTimeMs: 200},
        {startTimeMs: 200, endTimeMs: 300},
      ]);
      const lastDistributionTimestamp = -Infinity;
      const maxSimultaneousDistributions = 1;
      const expected = [{startTimeMs: 100, endTimeMs: 200}];
      expect(
        _chooseDistributionIntervals(
          credIntervals,
          lastDistributionTimestamp,
          299,
          maxSimultaneousDistributions
        )
      ).toEqual(expected);
    });
    it("handles the case where the latest interval is complete", () => {
      const credIntervals = intervalSequence([
        {startTimeMs: 0, endTimeMs: 100},
        {startTimeMs: 100, endTimeMs: 200},
        {startTimeMs: 200, endTimeMs: 300},
      ]);
      const lastDistributionTimestamp = -Infinity;
      const maxSimultaneousDistributions = 1;
      const expected = [{startTimeMs: 200, endTimeMs: 300}];
      expect(
        _chooseDistributionIntervals(
          credIntervals,
          lastDistributionTimestamp,
          300,
          maxSimultaneousDistributions
        )
      ).toEqual(expected);
    });
  });
});
