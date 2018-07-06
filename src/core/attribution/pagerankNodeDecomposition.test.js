// @flow

import {EdgeAddress, Graph, NodeAddress, edgeToStrings} from "../graph";
import {
  distributionToPagerankResult,
  createContributions,
  createOrderedSparseMarkovChain,
} from "./graphToMarkovChain";
import {findStationaryDistribution} from "./markovChain";
import {decompose} from "./pagerankNodeDecomposition";
import * as MapUtil from "../../util/map";

import {advancedGraph} from "../graphTestUtil";

/**
 * Format a decomposition to be shown in a snapshot. This converts
 * addresses and edges to strings to avoid NUL characters.
 */
function formatDecomposition(d) {
  return MapUtil.mapEntries(d, (key, {score, scoredContributions}) => [
    NodeAddress.toString(key),
    {
      score,
      scoredContributions: scoredContributions.map(
        ({contribution, source, sourceScore, contributionScore}) => ({
          contribution: {
            contributor: formatContributor(contribution.contributor),
            weight: contribution.weight,
          },
          source: NodeAddress.toString(source),
          sourceScore,
          contributionScore,
        })
      ),
    },
  ]);
  function formatContributor(contributor) {
    switch (contributor.type) {
      case "SYNTHETIC_LOOP":
        return {type: "SYNTHETIC_LOOP"};
      case "IN_EDGE":
        return {type: "IN_EDGE", edge: edgeToStrings(contributor.edge)};
      case "OUT_EDGE":
        return {type: "OUT_EDGE", edge: edgeToStrings(contributor.edge)};
      default:
        throw new Error((contributor.type: empty));
    }
  }
}

/**
 * Perform basic sanity checks on a decomposition. This ensures that
 * every node's score is the sum of its contributions' scores, that the
 * scores of the decomposition sum to 1, and that each node's
 * contributions are listed in non-increasing order of score.
 */
function validateDecomposition(decomposition) {
  const epsilon = 1e-6;

  // Check that each node's score is the sum of its subscores.
  for (const [key, {score, scoredContributions}] of decomposition.entries()) {
    const totalSubscore = scoredContributions
      .map((sc) => sc.contributionScore)
      .reduce((a, b) => a + b, 0);
    const delta = totalSubscore - score;
    if (Math.abs(delta) > epsilon) {
      const message = [
        `for node ${NodeAddress.toString(key)}: `,
        `expected total score (${score}) to equal `,
        `sum of contribution scores (${totalSubscore}) `,
        `within ${epsilon}, but the difference is ${delta}`,
      ].join("");
      throw new Error(message);
    }
  }

  // Check that the total score is 1.
  {
    const totalScore = Array.from(decomposition.values())
      .map((node) => node.score)
      .reduce((a, b) => a + b, 0);
    const delta = totalScore - 1;
    if (Math.abs(delta) > epsilon) {
      const message = [
        `expected total score of all nodes (${totalScore}) to equal 1.0 `,
        `within ${epsilon}, but the difference is ${delta}`,
      ].join("");
      throw new Error(message);
    }
  }

  // Check that each node's contributions are in score-descending order.
  for (const {scoredContributions} of decomposition.values()) {
    scoredContributions.forEach((current, index) => {
      if (index === 0) {
        return;
      }
      const previous = scoredContributions[index - 1];
      if (current.contributionScore > previous.contributionScore) {
        const message = [
          `expected contribution score to be non-increasing, but `,
          `element at index ${index} has score ${current.contributionScore}, `,
          `higher than that of its predecessor (${previous.contributionScore})`,
        ].join("");
        throw new Error(message);
      }
    });
  }
}

describe("core/attribution/contributions", () => {
  describe("decompose", () => {
    it("has the expected output on a simple asymmetric chain", () => {
      const n1 = NodeAddress.fromParts(["n1"]);
      const n2 = NodeAddress.fromParts(["n2"]);
      const n3 = NodeAddress.fromParts(["sink"]);
      const e1 = {src: n1, dst: n2, address: EdgeAddress.fromParts(["e1"])};
      const e2 = {src: n2, dst: n3, address: EdgeAddress.fromParts(["e2"])};
      const e3 = {src: n1, dst: n3, address: EdgeAddress.fromParts(["e3"])};
      const e4 = {src: n3, dst: n3, address: EdgeAddress.fromParts(["e4"])};
      const g = new Graph()
        .addNode(n1)
        .addNode(n2)
        .addNode(n3)
        .addEdge(e1)
        .addEdge(e2)
        .addEdge(e3)
        .addEdge(e4);
      const edgeWeight = () => ({toWeight: 6.0, froWeight: 3.0});
      const contributions = createContributions(g, edgeWeight, 1.0);
      const osmc = createOrderedSparseMarkovChain(contributions);
      const pi = findStationaryDistribution(osmc.chain, {
        verbose: false,
        convergenceThreshold: 1e-6,
        maxIterations: 255,
      });
      const pr = distributionToPagerankResult(osmc.nodeOrder, pi);
      const result = decompose(pr, contributions);
      expect(formatDecomposition(result)).toMatchSnapshot();
      validateDecomposition(result);
    });

    it("is valid on the example graph", () => {
      const g = advancedGraph().graph1();
      const edgeWeight = () => ({toWeight: 6.0, froWeight: 3.0});
      const contributions = createContributions(g, edgeWeight, 1.0);
      const osmc = createOrderedSparseMarkovChain(contributions);
      const pi = findStationaryDistribution(osmc.chain, {
        verbose: false,
        convergenceThreshold: 1e-6,
        maxIterations: 255,
      });
      const pr = distributionToPagerankResult(osmc.nodeOrder, pi);
      const result = decompose(pr, contributions);
      validateDecomposition(result);
    });
  });
});
