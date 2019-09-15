// @flow

import {
  paramsToJSON,
  paramsFromJSON,
  defaultParams,
  partialParams,
  type TimelineCredParameters,
  DEFAULT_ALPHA,
  DEFAULT_INTERVAL_DECAY,
} from "./params";
import {defaultWeights} from "../weights";
import {NodeAddress} from "../../core/graph";

describe("analysis/timeline/params", () => {
  const customWeights = () => {
    const weights = defaultWeights();
    // Ensure it works with non-default weights
    weights.nodeManualWeights.set(NodeAddress.empty, 33);
    return weights;
  };
  it("JSON round trip", () => {
    const p: TimelineCredParameters = {
      alpha: 0.1337,
      intervalDecay: 0.31337,
      weights: customWeights(),
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
      weights: defaultWeights(),
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
      expect(params.weights).toEqual(defaultWeights());
      expect(params.alpha).toEqual(0.99);
      expect(params.intervalDecay).toEqual(DEFAULT_INTERVAL_DECAY);
    });
    it("accepts weights override", () => {
      const weights = customWeights();
      const params = partialParams({weights});
      expect(params.weights).toEqual(weights);
      expect(params.alpha).toEqual(DEFAULT_ALPHA);
      expect(params.intervalDecay).toEqual(DEFAULT_INTERVAL_DECAY);
    });
    it("accepts intervalDecay override", () => {
      const params = partialParams({intervalDecay: 0.1});
      expect(params.weights).toEqual(defaultWeights());
      expect(params.alpha).toEqual(DEFAULT_ALPHA);
      expect(params.intervalDecay).toEqual(0.1);
    });
  });
});
