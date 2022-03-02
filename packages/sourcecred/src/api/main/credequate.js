// @flow

import type {ContributionsByTarget} from "../../core/credequate/contribution";
import {configsByTargetParser} from "../../core/credequate/config";
import {
  type ScoredContribution,
  scoreContributions,
} from "../../core/credequate/scoredContribution";
import {type PluginId} from "../pluginId";
import type {RawInstanceConfig} from "../rawInstanceConfig";
import {
  ensureIdentityExists,
  toBonusPolicy,
  type DependenciesConfig,
} from "../../api/dependenciesConfig";
import {Ledger} from "../../core/ledger/ledger";
import {computeBonusMintingByIntervals} from "../../core/bonusMinting";
import {CredGrainView} from "../../core/credGrainView";

export type CredequateInput = {|
  +pluginContributions: Iterable<{|
    +pluginId: PluginId,
    +contributionsByTarget: ContributionsByTarget,
  |}>,
  +rawInstanceConfig: RawInstanceConfig,
|};

export type CredequateOutput = {|
  +scoredContributions: Iterable<ScoredContribution>,
|};

/**
  A primary SourceCred API that runs the CredEquate algorithm on the given
  inputs to create ScoredContributions containing info on the cred scores of
  contributions and the cred earned by participants in each contribution.
 */
export function credequate(input: CredequateInput): CredequateOutput {
  return {scoredContributions: credequateGenerator(input)};
}

function* credequateGenerator(
  input: CredequateInput
): Iterable<ScoredContribution> {
  for (const plugin of input.pluginContributions) {
    const configs = input.rawInstanceConfig.credEquatePlugins.find(
      (p) => p.id === plugin.pluginId
    )?.configsByTarget;
    if (!configs)
      throw new Error(
        `CredEquate configurations not found for plugin ${plugin.pluginId}`
      );
    const parsedConfigsByTarget = configsByTargetParser.parseOrThrow(configs);
    for (const target of Object.keys(plugin.contributionsByTarget)) {
      if (!configs[target])
        throw new Error(
          `CredEquate configuration not found for plugin ${plugin.pluginId} and target ${target}`
        );
      const iterable = scoreContributions(
        plugin.contributionsByTarget[target],
        parsedConfigsByTarget[target]
      );
      for (const scoredContribution of iterable) {
        yield scoredContribution;
      }
    }
  }
}

export type DependenciesInput = {|
  +credGrainView: CredGrainView,
  +ledger: Ledger,
  +dependencies: DependenciesConfig,
|};

export type DependenciesOutput = {|
  /** The input CredGrainView merged with information from the generated
  scoredContributions */
  +credGrainView: CredGrainView,
  +ledger: Ledger,
  +dependencies: DependenciesConfig,
  /** Scored contributions for the dependencies. 1 per week per dependency. */
  +scoredDependencyContributions: $ReadOnlyArray<ScoredContribution>,
|};

/**
A SourceCred API that generates ScoredContributions to give bonus cred to
organizations and projects that the instance depends on or supports.

May mutate the ledger and the dependencies inputs. Will return a new 
CredGrainView with dependencies included.
 */
export function dependencies(input: DependenciesInput): DependenciesOutput {
  const dependenciesWithIds = input.dependencies.map((d) =>
    // This mutates the ledger, adding new identities when needed.
    ensureIdentityExists(d, input.ledger)
  );
  const bonusPolicies = dependenciesWithIds.map((d) =>
    toBonusPolicy(d, input.ledger)
  );
  const mintIntervals = input.credGrainView
    .totalCredPerInterval()
    .map((cred, index) => ({
      totalMint: cred,
      interval: input.credGrainView.intervals()[index],
    }));
  const bonusIntervalsByRecipient = computeBonusMintingByIntervals(
    mintIntervals,
    bonusPolicies
  );
  const scoredDependencyContributions: $ReadOnlyArray<ScoredContribution> = bonusIntervalsByRecipient.flatMap(
    ({recipient, bonusIntervals}) => {
      return bonusIntervals.map(({amount, interval}) => ({
        id: `${recipient} / ${interval.startTimeMs}`,
        expression: {
          score: amount,
          operator: "ADD",
          description: "stubbed expression stucture for dependencies",
          weightOperands: [],
          expressionOperands: [],
        },
        plugin: "DependenciesConfig",
        type: "Dependency",
        timestampMs: interval.startTimeMs,
        participants: [
          {
            id: recipient,
            score: amount,
            shares: [],
          },
        ],
      }));
    }
  );
  const dependencyCredGrainView = CredGrainView.fromScoredContributionsAndLedger(
    scoredDependencyContributions,
    input.ledger,
    mintIntervals[0].interval.startTimeMs
  );
  const mergedCredGrainView = CredGrainView.fromCredGrainViews(
    input.credGrainView,
    dependencyCredGrainView
  );
  return {
    credGrainView: mergedCredGrainView,
    ledger: input.ledger,
    dependencies: dependenciesWithIds,
    scoredDependencyContributions,
  };
}
