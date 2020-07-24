// @flow

import {_chooseDistributionIntervals} from "./applyDistributions";

describe("ledger/applyDistributions", () => {
  describe("_chooseDistributionIntervals", () => {
    it("handles a case where we want to distribute for every interval except latest", () => {
      const credIntervals = [1, 2, 3];
      const lastDistributionTimestamp = -Infinity;
      const maxSimultaneousDistributions = Infinity;
      const expected = [1, 2];
      expect(
        _chooseDistributionIntervals(
          credIntervals,
          lastDistributionTimestamp,
          maxSimultaneousDistributions
        )
      ).toEqual(expected);
    });
    it("handles the case where maxSimultaneousDistributions === 0", () => {
      const credIntervals = [1, 2, 3];
      const lastDistributionTimestamp = -Infinity;
      const maxSimultaneousDistributions = 0;
      const expected = [];
      expect(
        _chooseDistributionIntervals(
          credIntervals,
          lastDistributionTimestamp,
          maxSimultaneousDistributions
        )
      ).toEqual(expected);
    });
    it("handles the case where we've already distributed for the finished intervals", () => {
      const credIntervals = [1, 2, 3];
      const lastDistributionTimestamp = 2;
      const maxSimultaneousDistributions = 0;
      const expected = [];
      expect(
        _chooseDistributionIntervals(
          credIntervals,
          lastDistributionTimestamp,
          maxSimultaneousDistributions
        )
      ).toEqual(expected);
    });
    it("handles the case where we're limited by maxSimultaneousDistributions", () => {
      const credIntervals = [1, 2, 3];
      const lastDistributionTimestamp = -Infinity;
      const maxSimultaneousDistributions = 1;
      const expected = [2];
      expect(
        _chooseDistributionIntervals(
          credIntervals,
          lastDistributionTimestamp,
          maxSimultaneousDistributions
        )
      ).toEqual(expected);
    });
  });
});
