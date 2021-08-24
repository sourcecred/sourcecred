// @flow

import {CredGraph} from "../../core/credrank/credGraph";
import {Ledger} from "../../core/ledger/ledger";
import type {CurrencyDetails} from "../currencyConfig";
import {type GrainConfig, toDistributionPolicy} from "../grainConfig";
import type {Distribution} from "../../core/ledger/distribution";
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

export type GrainIntegrationResults = {|
  +results: $ReadOnlyArray<GrainIntegrationResult>,
  // A top-level pointer to the most recently updated Ledger instance
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
): GrainIntegrationResults {
  const integrationCurrency = grainInput.currencyDetails.integrationCurrency;
  const grainIntegration = grainInput.grainConfig.integration;
  const results = [];
  // track the latest ledger in the for-loop for the purposes of returning it
  // at the top level, observing that any function may deep-copy
  // the ledger (thus creating a new reference we'll need to track) and also
  // supporting the case where the distributions parameter is an empty array
  let ledgerResult = ledger;
  if (integrationCurrency && grainIntegration) {
    distributions.forEach((distribution) => {
      const result = executeGrainIntegration(
        ledgerResult,
        grainIntegration.function,
        distribution,
        integrationCurrency,
        false
      );
      ledgerResult = result.ledger;
      results.push(result);
    });
  }
  return {ledger: ledgerResult, results};
}
