// @flow

import {paramsToJSON, paramsFromJSON} from "./params";
import {defaultWeights} from "../weights";
import {NodeAddress} from "../../core/graph";

describe("analysis/timeline/params", () => {
  it("JSON round trip", () => {
    const weights = defaultWeights();
    // Ensure it works with non-default weights
    weights.nodeManualWeights.set(NodeAddress.empty, 33);
    const p = {alpha: 0.5, intervalDecay: 0.5, weights};
    const j = paramsToJSON(p);
    const p_ = paramsFromJSON(j);
    const j_ = paramsToJSON(p_);
    expect(j).toEqual(j_);
    expect(p).toEqual(p_);
  });
});
