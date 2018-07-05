// @flow

import {pagerank} from "./pagerank";
import {NodeAddress} from "../graph";
import {advancedGraph} from "../graphTestUtil";

function snapshotPagerankResult(result) {
  const prTotal = Array.from(result.values()).reduce((a, b) => a + b, 0);
  expect(prTotal).toBeCloseTo(1.0, 1e-9);
  const partsToProbability = [];
  const sortedKeys = Array.from(result.keys()).sort();
  for (const key of sortedKeys) {
    const probability = result.get(key);
    const parts = NodeAddress.toParts((key: any));
    partsToProbability.push({parts, probability});
  }
  expect(partsToProbability).toMatchSnapshot();
}

describe("core/attribution/pagerank", () => {
  function edgeWeight(_unused_edge) {
    return {toWeight: 1, froWeight: 0};
  }
  it("snapshots as expected on the advanced graph", () => {
    const pagerankResult = pagerank(advancedGraph().graph1(), edgeWeight);
    snapshotPagerankResult(pagerankResult);
  });
  it("respects explicit arguments", () => {
    const pagerankResult = pagerank(advancedGraph().graph1(), edgeWeight, {
      maxIterations: 0,
    });
    snapshotPagerankResult(pagerankResult);
  });
});
