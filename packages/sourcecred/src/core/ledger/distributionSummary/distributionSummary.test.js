// @flow

import {random as randomUuid} from "../../../util/uuid";
import type {IdentityId} from "../../identity";
import * as G from "../grain";
import {
  formatCenter,
  getTotalDistributed,
  type DistributionBalances,
} from "./distributionSummary";

describe("core/ledger/distributionSummary/distributionSummary", () => {
  describe("formatCenter", () => {
    it("returns the same string when len == str.length", () => {
      expect(formatCenter("test", 4)).toEqual("test");
    });

    it("returns the same string when len < str.length", () => {
      expect(formatCenter("test", 0)).toEqual("test");
    });

    it("adds whitespace right if cannot evenly wrap on both sides", () => {
      expect(formatCenter("test", 5)).toEqual("test ");
    });

    it("wraps evenly on both sides when len - str.length is even", () => {
      expect(formatCenter("test", 8)).toEqual("  test  ");
    });
  });

  describe("getTotalDistributed", () => {
    it("sums balances correctly", () => {
      const distributionBalances: DistributionBalances = new Map<
        IdentityId,
        G.Grain
      >();
      distributionBalances.set(randomUuid(), G.fromInteger(15));
      distributionBalances.set(randomUuid(), G.fromFloatString("30.002"));
      distributionBalances.set(randomUuid(), G.fromFloatString("100.002"));
      expect(getTotalDistributed(distributionBalances)).toEqual(
        G.fromFloatString("145.004")
      );
    });
  });
});
