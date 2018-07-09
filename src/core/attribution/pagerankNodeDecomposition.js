// @flow

import sortBy from "lodash.sortby";

import type {NodeAddressT} from "../graph";
import {
  type Contribution,
  type NodeToContributions,
  contributorSource,
} from "./graphToMarkovChain";
import type {NodeDistribution} from "./pagerank";
import * as MapUtil from "../../util/map";
import * as NullUtil from "../../util/null";

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
  pr: NodeDistribution,
  contributions: NodeToContributions
): PagerankNodeDecomposition {
  return MapUtil.mapValues(contributions, (target, contributions) => {
    const score = NullUtil.get(pr.get(target));
    const scoredContributions = sortBy(
      contributions.map(
        (contribution): ScoredContribution => {
          const source = contributorSource(target, contribution.contributor);
          const sourceScore = NullUtil.get(pr.get(source));
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
