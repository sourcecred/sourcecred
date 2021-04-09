// @flow

import {CredGraph} from "../../core/credrank/credGraph";
import {Ledger} from "../../core/ledger/ledger";
import {type CurrencyDetails} from "../currencyConfig";
import {type GrainConfig, toDistributionPolicy} from "../grainConfig";
import {type Distribution} from "../../core/ledger/distribution";
import {applyDistributions} from "../../core/ledger/applyDistributions";
import findLastIndex from "lodash.findlastindex";

export type GrainInput = {|
  +credGraph: CredGraph,
  +ledger: Ledger,
  +grainConfig: GrainConfig,
  +currencyDetails: CurrencyDetails,
  allowLastDistributionOverwrite?: boolean,
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
    +Date.now()
  );
  if (input.allowLastDistributionOverwrite && !distributions.length) {
    const newEventLog = input.ledger.eventLog().slice();
    newEventLog.splice(
      findLastIndex(
        input.ledger.eventLog(),
        (event) => event.action.type === "DISTRIBUTE_GRAIN"
      ),
      1
    );
    const ledgerWithoutLastDistribution = Ledger.fromEventLog(newEventLog);
    const distributionsWithOverwrite = applyDistributions(
      distributionPolicy,
      input.credGraph,
      ledgerWithoutLastDistribution,
      +Date.now()
    );
    return {
      distributions: distributionsWithOverwrite,
      ledger: ledgerWithoutLastDistribution,
    };
  }
  return {distributions, ledger: input.ledger};
}
