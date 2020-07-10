// @flow

import {
  paramsToJSON,
  paramsFromJSON,
  defaultParams,
  partialParams,
  type TimelineCredParameters,
  DEFAULT_ALPHA,
  DEFAULT_INTERVAL_DECAY,
  parser,
} from "./params";

describe("analysis/timeline/params", () => {
  it("JSON round trip", () => {
    const p: TimelineCredParameters = {
      alpha: 0.1337,
      intervalDecay: 0.31337,
    };
    const j = paramsToJSON(p);
    const p_ = paramsFromJSON(j);
    const j_ = paramsToJSON(p_);
    expect(j).toEqual(j_);
    expect(p).toEqual(p_);
  });
  it("defaultParams", () => {
    const expected: TimelineCredParameters = {
      alpha: DEFAULT_ALPHA,
      intervalDecay: DEFAULT_INTERVAL_DECAY,
    };
    expect(defaultParams()).toEqual(expected);
  });
  describe("partialParams", () => {
    it("uses default values if no overrides provided", () => {
      const params = partialParams({});
      expect(params).toEqual(defaultParams());
    });
    it("accepts an alpha override", () => {
      const params = partialParams({alpha: 0.99});
      expect(params.alpha).toEqual(0.99);
      expect(params.intervalDecay).toEqual(DEFAULT_INTERVAL_DECAY);
    });
    it("accepts intervalDecay override", () => {
      const params = partialParams({intervalDecay: 0.1});
      expect(params.alpha).toEqual(DEFAULT_ALPHA);
      expect(params.intervalDecay).toEqual(0.1);
    });
  });

  describe("parser", () => {
    it("works on a full object", () => {
      const params: TimelineCredParameters = {alpha: 0.34, intervalDecay: 0.1};
      expect(parser.parseOrThrow(params)).toEqual(params);
    });
    it("works on a partial object", () => {
      expect(parser.parseOrThrow({})).toEqual(defaultParams());
    });
    it("rejects bad params", () => {
      expect(() => parser.parseOrThrow({alpha: "foo"})).toThrowError("string");
    });
  });
});
