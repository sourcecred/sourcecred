// @flow

import {CredGraph} from "../../core/credrank/credGraph";
import {CredGrainView} from "../../core/credGrainView";
import {
  type WeightedGraph,
  merge,
  overrideWeights,
} from "../../core/weightedGraph";
import {
  ensureIdentityExists,
  toBonusPolicy,
  type DependenciesConfig,
} from "../../api/dependenciesConfig";
import {Ledger} from "../../core/ledger/ledger";
import {computeBonusMinting, createBonusGraph} from "../../core/bonusMinting";
import {applyBudget, type Budget} from "../../core/mintBudget";
import {type WeightsT} from "../../core/weights";
import {contractions as identityContractions} from "../../core/identity";
import {credrank as computeCredrank} from "../../core/credrank/compute";
import {
  type PersonalAttributionsConfig,
  updatePersonalAttributionsConfig,
  toPersonalAttributions,
} from "../config/personalAttributionsConfig";

export type CredrankInput = {|
  +pluginGraphs: $ReadOnlyArray<WeightedGraph>,
  +ledger: Ledger,
  +dependencies: DependenciesConfig,
  +weightOverrides: WeightsT,
  +pluginsBudget: Budget | null,
  +personalAttributions: PersonalAttributionsConfig,
|};

export type CredrankOutput = {|
  +credGraph: CredGraph,
  +credGrainView: CredGrainView,
  +ledger: Ledger,
  +dependencies: DependenciesConfig,
  +personalAttributions: PersonalAttributionsConfig,
|};

/**
  A primary SourceCred API that combines the given inputs into a single
  WeightedGraph and then runs the CredRank algorithm on it to create a CredGraph
  containing the cred scores of nodes/participants.

  Might mutate the ledger that is passed in.
 */
export async function credrank(input: CredrankInput): Promise<CredrankOutput> {
  let weightedGraph = overrideWeights(
    merge(input.pluginGraphs),
    input.weightOverrides
  );

  // important that this happens before identity contractions
  const dependenciesWithIds = input.dependencies.map((d) =>
    // This mutates the ledger, adding new identities when needed.
    ensureIdentityExists(d, input.ledger)
  );
  const identities = input.ledger.accounts().map((a) => a.identity);
  const contractedGraph = weightedGraph.graph.contractNodes(
    identityContractions(identities)
  );
  weightedGraph = {
    graph: contractedGraph,
    weights: weightedGraph.weights,
  };
  if (input.pluginsBudget) {
    weightedGraph = applyBudget(weightedGraph, input.pluginsBudget);
  }

  const dependencyBonuses = dependenciesWithIds.map((d) =>
    toBonusPolicy(d, input.ledger)
  );
  const bonusGraph = createBonusGraph(
    computeBonusMinting(weightedGraph, dependencyBonuses)
  );
  weightedGraph = merge([weightedGraph, bonusGraph]);

  const updatedPersonalAttributionsConfig = updatePersonalAttributionsConfig(
    input.personalAttributions,
    input.ledger
  );

  const credGraph = await computeCredrank(
    weightedGraph,
    input.ledger,
    toPersonalAttributions(updatedPersonalAttributionsConfig)
  );
  return {
    credGraph,
    credGrainView: CredGrainView.fromCredGraphAndLedger(
      credGraph,
      input.ledger
    ),
    ledger: input.ledger,
    dependencies: dependenciesWithIds,
    personalAttributions: updatedPersonalAttributionsConfig,
  };
}
