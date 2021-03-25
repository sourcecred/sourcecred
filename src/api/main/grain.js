// @flow

import {CredGraph} from "../../core/credrank/credGraph";
import {Ledger} from "../../core/ledger/ledger";
import {type CurrencyDetails} from "../currencyConfig";
import {type GrainConfig, toDistributionPolicy} from "../grainConfig";
import {type Distribution} from "../../core/ledger/distribution";
import {applyDistributions} from "../../core/ledger/applyDistributions";

export type GrainInput = {|
  +credGraph: CredGraph,
  +ledger: Ledger,
  +grainConfig: GrainConfig,
  +currencyDetails: CurrencyDetails,
|};

export type GrainOutput = {|
  +distributions: $ReadOnlyArray<Distribution>,
  +ledger: Ledger,
|};

/**
  A primary SourceCred API that combines the given inputs into a list of
  grain distributions.

  Mutates the ledger that is passed in.
 */
export async function grain(input: GrainInput): Promise<GrainOutput> {
  const distributionPolicy = toDistributionPolicy(input.grainConfig);
  const distributions = applyDistributions(
    distributionPolicy,
    input.credGraph,
    input.ledger,
    +Date.now()
  );
  return {distributions, ledger: input.ledger};
}
