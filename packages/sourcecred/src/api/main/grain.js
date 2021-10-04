// @flow

import {CredGraph} from "../../core/credrank/credGraph";
import {Ledger} from "../../core/ledger/ledger";
import type {CurrencyDetails} from "../currencyConfig";
import {type GrainConfig} from "../grainConfig";
import type {Distribution} from "../../core/ledger/distribution";
import {applyDistributions} from "../../core/ledger/applyDistributions";
import {type TimestampMs} from "../../util/timestamp";
import {
  executeGrainIntegration,
  type GrainIntegrationOutput,
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

// Similar to GrainIntegrationResult but excludes the ledger
// since only the most recent ledger is relevant
export type GrainIntegrationMultiResult = {|
  output?: GrainIntegrationOutput,
  distributionCredTimestamp: TimestampMs,
|};

export type GrainIntegrationResults = {|
  +results: $ReadOnlyArray<GrainIntegrationMultiResult>,
  // A top-level pointer to the most recently updated Ledger instance
  +ledger: Ledger,
|};

/**
  A primary SourceCred API that combines the given inputs into a list of
  grain distributions.

  May mutate the ledger that is passed in.
 */
export async function grain(input: GrainInput): Promise<GrainOutput> {
  const distributions = applyDistributions(
    input.grainConfig,
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
      const {output, distributionCredTimestamp, ledger: nextLedger} = result;
      ledgerResult = nextLedger;
      results.push({output, distributionCredTimestamp});
    });
  }
  return {ledger: ledgerResult, results};
}
