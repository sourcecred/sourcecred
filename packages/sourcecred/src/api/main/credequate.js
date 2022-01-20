// @flow

import type {ContributionsByTarget} from "../../core/credequate/contribution";
import {
  type ScoredContribution,
  scoreContributions,
} from "../../core/credequate/scoredContribution";
import {type PluginId} from "../pluginId";
import type {RawInstanceConfig} from "../rawInstanceConfig";

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
      throw new Error(`CredEquate configurations not found for plugin ${plugin.pluginId}`);
    for (const target of Object.keys(plugin.contributionsByTarget)) {
      if (!configs[target])
        throw new Error(
          `CredEquate configuration not found for plugin ${plugin.pluginId} and target ${target}`
        );
      const iterable = scoreContributions(
        plugin.contributionsByTarget[target],
        configs[target]
      );
      for (const scoredContribution of iterable) {
        yield scoredContribution;
      }
    }
  }
}
