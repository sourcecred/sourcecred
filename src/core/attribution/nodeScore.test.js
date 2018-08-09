// @flow

import {NodeAddress} from "../graph";
import {scoreByMaximumProbability} from "./nodeScore";
describe("core/attribution/nodeScore", () => {
  const foo = NodeAddress.fromParts(["foo"]);
  const bar = NodeAddress.fromParts(["bar"]);
  const zod = NodeAddress.fromParts(["zod"]);
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
