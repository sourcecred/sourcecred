// @flow

import sortBy from "lodash.sortby";

import {type NodeAddressT, NodeAddress} from "../graph";
import {
  type Contribution,
  type NodeToContributions,
  contributorSource,
} from "./graphToMarkovChain";
import type {PagerankResult} from "./pagerank";
import * as MapUtil from "../../util/map";

export type ScoredContribution = {|
  +contribution: Contribution,
  +source: NodeAddressT,
  +sourceScore: number,
  +contributionScore: number,
|};

export type PagerankNodeDecomposition = Map<
  NodeAddressT,
  {|
    +score: number,
    // Contributions are sorted by `contributorScore` descending,
    // breaking ties in a deterministic (but unspecified) order.
    +scoredContributions: $ReadOnlyArray<ScoredContribution>,
  |}
>;

export function decompose(
  pr: PagerankResult,
  contributions: NodeToContributions
): PagerankNodeDecomposition {
  return MapUtil.mapValues(contributions, (target, contributions) => {
    const score = pr.get(target);
    if (score == null) {
      throw new Error("missing target: " + NodeAddress.toString(target));
    }
    const scoredContributions = sortBy(
      contributions.map(
        (contribution): ScoredContribution => {
          const source = contributorSource(target, contribution.contributor);
          const sourceScore = pr.get(source);
          if (sourceScore == null) {
            throw new Error("missing source: " + NodeAddress.toString(source));
          }
          const contributionScore = contribution.weight * sourceScore;
          return {contribution, source, sourceScore, contributionScore};
        }
      ),
      (x) => -x.contributionScore,
      // The following should be called rarely and on small objects.
      (x) => JSON.stringify(x.contribution.contributor)
    );
    return {score, scoredContributions};
  });
}
