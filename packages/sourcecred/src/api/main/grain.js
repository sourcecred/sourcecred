// @flow

import {CredGraph} from "../../core/credrank/credGraph";
import {Ledger} from "../../core/ledger/ledger";
import {type CurrencyDetails} from "../currencyConfig";
import {type GrainConfig, toDistributionPolicy} from "../grainConfig";
import {type Distribution} from "../../core/ledger/distribution";
import {applyDistributions} from "../../core/ledger/applyDistributions";
import {
  executeGrainIntegration,
  type GrainIntegrationResult,
} from "../../core/ledger/grainIntegration";

export type GrainInput = {|
  +credGraph: CredGraph,
  +ledger: Ledger,
  +grainConfig: GrainConfig,
  +currencyDetails: CurrencyDetails,
  allowMultipleDistributionsPerInterval?: boolean,
|};

export type GrainOutput = {|
  +distributions: $ReadOnlyArray<Distribution>,
  +ledger: Ledger,
|};

/**
  A primary SourceCred API that combines the given inputs into a list of
  grain distributions.

  May mutate the ledger that is passed in.
 */
export async function grain(input: GrainInput): Promise<GrainOutput> {
  const distributionPolicy = toDistributionPolicy(input.grainConfig);
  const distributions = applyDistributions(
    distributionPolicy,
    input.credGraph,
    input.ledger,
    +Date.now(),
    input.allowMultipleDistributionsPerInterval || false
  );
  return {distributions, ledger: input.ledger};
}

/**
 * Marshall grainInput from a Grain Configuration file for use with
 * executeGrainIntegration function
 */
export function executeGrainIntegrationsFromGrainInput(
  grainInput: GrainInput,
  ledger: Ledger,
  distributions: $ReadOnlyArray<Distribution>
): $ReadOnlyArray<GrainIntegrationResult> {
  const integrationCurrency = grainInput.currencyDetails.integrationCurrency;
  const grainIntegration = grainInput.grainConfig.integration;
  const results = [];
  if (integrationCurrency && grainIntegration) {
    distributions.forEach((distribution) => {
      const result = executeGrainIntegration(
        ledger,
        grainIntegration.function,
        distribution,
        integrationCurrency,
        false
      );
      results.push(result);
    });
  }
  return results;
}
