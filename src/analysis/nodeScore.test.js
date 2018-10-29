// @flow

import {NodeAddress} from "../core/graph";
import {scoreByMaximumProbability, scoreByConstantTotal} from "./nodeScore";

describe("analysis/nodeScore", () => {
  const foo = NodeAddress.fromParts(["foo"]);
  const bar = NodeAddress.fromParts(["bar"]);
  const zod = NodeAddress.fromParts(["zod"]);
  const foobar = NodeAddress.fromParts(["foo", "bar"]);
  describe("scoreByMaximumProbability", () => {
    it("works on a simple case", () => {
      const distribution = new Map();
      distribution.set(foo, 0.5);
      distribution.set(bar, 0.3);
      distribution.set(zod, 0.2);
      const result = scoreByMaximumProbability(distribution, 100);
      expect(result.get(foo)).toEqual(100);
      expect(result.get(bar)).toEqual(60);
      expect(result.get(zod)).toEqual(40);
    });
    it("normalizes to the maxScore argument", () => {
      const distribution = new Map();
      distribution.set(foo, 0.5);
      distribution.set(bar, 0.3);
      distribution.set(zod, 0.2);
      const result = scoreByMaximumProbability(distribution, 1000);
      expect(result.get(foo)).toEqual(1000);
      expect(result.get(bar)).toEqual(600);
      expect(result.get(zod)).toEqual(400);
    });
    it("handles a case with only a single node", () => {
      const distribution = new Map();
      distribution.set(foo, 1.0);
      const result = scoreByMaximumProbability(distribution, 1000);
      expect(result.get(foo)).toEqual(1000);
    });
    it("errors if maxScore <= 0", () => {
      const distribution = new Map();
      distribution.set(foo, 1.0);
      const result = () => scoreByMaximumProbability(distribution, 0);
      expect(result).toThrowError("Invalid argument");
    });
    it("throws an error rather than divide by 0", () => {
      const distribution = new Map();
      distribution.set(foo, 0.0);
      const result = () => scoreByMaximumProbability(distribution, 1000);
      expect(result).toThrowError("Invariant violation");
    });
  });
  describe("scoreByConstantTotal", () => {
    it("works on a simple case", () => {
      const distribution = new Map();
      distribution.set(foo, 0.5);
      distribution.set(bar, 0.3);
      distribution.set(zod, 0.2);
      const result = scoreByConstantTotal(distribution, 100, NodeAddress.empty);
      expect(result.get(foo)).toEqual(50);
      expect(result.get(bar)).toEqual(30);
      expect(result.get(zod)).toEqual(20);
    });
    it("normalizes based on the totalScore argument", () => {
      const distribution = new Map();
      distribution.set(foo, 0.5);
      distribution.set(bar, 0.3);
      distribution.set(zod, 0.2);
      const result = scoreByConstantTotal(
        distribution,
        1000,
        NodeAddress.empty
      );
      expect(result.get(foo)).toEqual(500);
      expect(result.get(bar)).toEqual(300);
      expect(result.get(zod)).toEqual(200);
    });
    it("normalizes based on which nodes match the filter", () => {
      const distribution = new Map();
      distribution.set(foo, 0.5);
      distribution.set(foobar, 0.5);
      distribution.set(bar, 0.3);
      distribution.set(zod, 0.2);
      const result = scoreByConstantTotal(distribution, 1000, foo);
      expect(result.get(foo)).toEqual(500);
      expect(result.get(foobar)).toEqual(500);
      expect(result.get(bar)).toEqual(300);
      expect(result.get(zod)).toEqual(200);
    });
    it("handles a case with only a single node", () => {
      const distribution = new Map();
      distribution.set(foo, 1.0);
      const result = scoreByConstantTotal(
        distribution,
        1000,
        NodeAddress.empty
      );
      expect(result.get(foo)).toEqual(1000);
    });
    it("errors if maxScore <= 0", () => {
      const distribution = new Map();
      distribution.set(foo, 1.0);
      const result = () => scoreByConstantTotal(distribution, 0, foo);
      expect(result).toThrowError("Invalid argument");
    });
    it("throws an error rather than divide by 0", () => {
      const distribution = new Map();
      distribution.set(foo, 1.0);
      const result = () => scoreByConstantTotal(distribution, 1000, bar);
      expect(result).toThrowError(
        "Tried to normalize based on nodes with no score"
      );
    });
  });
});
