// @flow

import deepFreeze from "deep-freeze";
import {fromApproximateFloat, ONE, ZERO} from "./grain";
import {loginAddress as githubAddress} from "../plugins/github/nodes";
import {identityAddress} from "../plugins/identity/identity";
import {userAddress as discourseAddress} from "../plugins/discourse/address";
import {
  convertLegacyDistribution,
  convertLegacyTransfer,
  zipperEvents,
  convertLegacyEvents,
} from "./legacyConverter";

describe("src/grain/legacyConverter", () => {
  const exampleUrl = "https://example.com";
  const githubFoo = githubAddress("foo");
  const sourcecredBar = identityAddress("bar");
  const discourseZod = discourseAddress(exampleUrl, "zod");

  const legacyDistribution = deepFreeze({
    interval: {startTimeMs: 123, endTimeMs: 456},
    payments: [
      {alias: "github/foo", fast: 100, slow: 200},
      {alias: "sourcecred/bar", fast: 500, slow: 0},
    ],
  });
  const expectedImmediate = deepFreeze({
    type: "DISTRIBUTION",
    strategy: {
      type: "IMMEDIATE",
      budget: fromApproximateFloat(6),
      version: 1,
    },
    version: 1,
    timestampMs: 456,
    receipts: [
      {address: githubFoo, amount: fromApproximateFloat(1)},
      {address: sourcecredBar, amount: fromApproximateFloat(5)},
    ],
  });
  const expectedLifetime = deepFreeze({
    type: "DISTRIBUTION",
    strategy: {
      type: "LIFETIME",
      budget: fromApproximateFloat(2),
      version: 1,
    },
    version: 1,
    timestampMs: 456,
    receipts: [{address: githubFoo, amount: fromApproximateFloat(2)}],
  });
  const legacyTransfer = deepFreeze({
    from: "sourcecred/bar",
    to: "discourse/zod",
    amount: 100,
    timestamp: 555,
    references: ["hello there", "my friend"],
  });
  const expectedTransfer = deepFreeze({
    sender: sourcecredBar,
    recipient: discourseZod,
    amount: ONE,
    timestampMs: 555,
    memo: "hello there, my friend",
    type: "TRANSFER",
    version: 1,
  });
  describe("convertLegacyDistribution", function () {
    it("should work on a representative case", function () {
      expect(
        convertLegacyDistribution(legacyDistribution, exampleUrl)
      ).toEqual([expectedImmediate, expectedLifetime]);
    });
  });
  describe("convertLegacyTransfer", function () {
    it("should work on a representative case", () => {
      expect(convertLegacyTransfer(legacyTransfer, exampleUrl)).toEqual(
        expectedTransfer
      );
    });
  });
  describe("zipperEvents", () => {
    function dx(timestampMs: number) {
      return deepFreeze({
        type: "DISTRIBUTION",
        version: 1,
        receipts: [],
        strategy: {type: "IMMEDIATE", budget: ZERO, version: 1},
        timestampMs,
      });
    }
    function tx(timestampMs: number) {
      return deepFreeze({
        type: "TRANSFER",
        version: 1,
        recipient: sourcecredBar,
        sender: sourcecredBar,
        amount: ZERO,
        timestampMs,
        memo: "",
      });
    }
    const d1 = dx(1);
    const d2 = dx(2);
    const d3 = dx(3);
    const t2 = tx(2);
    const t3 = tx(3);

    it("should work on empty events", function () {
      expect(zipperEvents([], [])).toEqual([]);
    });
    it("should work when there are only distributions", function () {
      expect(zipperEvents([d1], [])).toEqual([d1]);
    });
    it("should work when there are only transfers", function () {
      expect(zipperEvents([], [t2])).toEqual([t2]);
    });
    it("should merge in timestamp order, with distributions first", function () {
      expect(zipperEvents([d1, d2, d3], [t2, t3])).toEqual([
        d1,
        d2,
        t2,
        d3,
        t3,
      ]);
    });
  });
  describe("convertLegacyEvents", () => {
    it("works on a representative case", () => {
      expect(
        convertLegacyEvents([legacyDistribution], [legacyTransfer], exampleUrl)
      ).toEqual([expectedImmediate, expectedLifetime, expectedTransfer]);
    });
  });
});
