// @flow

import {exampleGraph, exampleRelationalView} from "./example/example";
import {empty as emptyWeights} from "../../core/weights";
import {createGraph} from "./createGraph";
import * as N from "./nodes";

describe("plugins/github/createGraph", () => {
  it("example graph matches snapshot", () => {
    expect(exampleGraph().graph).toMatchSnapshot();
  });
  it("example weights matches snapshot", () => {
    expect(exampleGraph().weights).toMatchSnapshot();
  });
  it("sets weight to 0 for un-merged PRs", () => {
    const view = exampleRelationalView();
    const unmergedPrs = Array.from(view.pulls()).filter(
      (x) => x.mergedAs() == null
    );
    const mergedPrs = Array.from(view.pulls()).filter(
      (x) => x.mergedAs() != null
    );
    expect(unmergedPrs).not.toHaveLength(0);
    expect(mergedPrs).not.toHaveLength(0);

    const expectedWeights = emptyWeights();
    for (const unmerged of unmergedPrs) {
      const addr = N.toRaw(unmerged.address());
      expectedWeights.nodeWeights.set(addr, 0);
    }
    const {weights} = createGraph(view);
    expect(weights).toEqual(expectedWeights);
  });
});
