// @flow

import {
  type DistributionV1,
  type ImmediateV1,
  type LifetimeV1,
} from "./distribution";
import {type TransferV1} from "./ledger";
import {type Alias, resolveAlias} from "../plugins/identity/alias";
import type {LedgerEvent} from "./ledger";
import {type Grain, ONE, ZERO} from "./grain";

type LegacyInterval = {|+startTimeMs: number, +endTimeMs: number|};
type LegacyPayment = {|+alias: string, +fast: number, +slow: number|};
type LegacyDistribution = {|
  +interval: LegacyInterval,
  +payments: $ReadOnlyArray<LegacyPayment>,
|};
type LegacyTransfer = {|
  +from: Alias,
  +to: Alias,
  +amount: number,
  +timestamp: number,
  +references: $ReadOnlyArray<string>,
|};

export function convertLegacyEvents(
  legacyDistributions: $ReadOnlyArray<LegacyDistribution>,
  legacyTransfers: $ReadOnlyArray<LegacyTransfer>,
  discourseUrl: string
): $ReadOnlyArray<LedgerEvent> {
  const distributionPairs = legacyDistributions.map((x) =>
    convertLegacyDistribution(x, discourseUrl)
  );
  const distributions = [].concat(...distributionPairs);
  const transactions = legacyTransfers.map((x) =>
    convertLegacyTransfer(x, discourseUrl)
  );
  return zipperEvents(distributions, transactions);
}

export function zipperEvents(
  distributions: $ReadOnlyArray<DistributionV1>,
  transfers: $ReadOnlyArray<TransferV1>
): LedgerEvent[] {
  let dIndex = 0;
  let tIndex = 0;
  const result = [];
  while (dIndex < distributions.length || tIndex < transfers.length) {
    const pushTx =
      dIndex === distributions.length ||
      (tIndex < transfers.length &&
        // if the transaction and distribution have equal timestamp, then
        // we conservatively push the distribution first.
        transfers[tIndex].timestampMs < distributions[dIndex].timestampMs);
    if (pushTx) {
      result.push(transfers[tIndex]);
      tIndex++;
    } else {
      result.push(distributions[dIndex]);
      dIndex++;
    }
  }
  return result;
}

function convertLegacyGrainRepresentation(x: number): Grain {
  // The legacy variant tracks grain as integer centi-grain, so we can
  // multiply it by the full grain representation and then divide by 100.
  // $ExpectFlowError
  return (BigInt(x) * ONE) / 100n;
}

// Convert a legacy distribution event into two new-style distribution
// events. One weird property of this is that the budget will be the
// actual amount distributed, not the intended budget, i.e. if due to rounding
// we distributed 4999 grain off a 5000 budget, we'll retroactively see the
// budget as having been 4999. I don't think this is a problem.
export function convertLegacyDistribution(
  x: LegacyDistribution,
  discourseUrl: string | null
): [DistributionV1, DistributionV1] {
  const timestampMs = x.interval.endTimeMs;
  const immediateReceipts = [];
  let immediateBudget = ZERO;
  const lifetimeReceipts = [];
  let lifetimeBudget = ZERO;
  for (const {alias, fast, slow} of x.payments) {
    const address = resolveAlias(alias, discourseUrl);
    const immediate = convertLegacyGrainRepresentation(fast);
    const lifetime = convertLegacyGrainRepresentation(slow);
    immediateBudget += immediate;
    lifetimeBudget += lifetime;
    if (immediate > ZERO) {
      immediateReceipts.push({address, amount: immediate});
    }
    if (lifetime > ZERO) {
      lifetimeReceipts.push({address, amount: lifetime});
    }
  }
  const immediateStrategy: ImmediateV1 = {
    type: "IMMEDIATE",
    version: 1,
    budget: immediateBudget,
  };
  const lifetimeStrategy: LifetimeV1 = {
    type: "LIFETIME",
    version: 1,
    budget: lifetimeBudget,
  };
  const immediateDistribution: DistributionV1 = {
    type: "DISTRIBUTION",
    timestampMs,
    version: 1,
    strategy: immediateStrategy,
    receipts: immediateReceipts,
  };
  const lifetimeDistribution: DistributionV1 = {
    type: "DISTRIBUTION",
    timestampMs,
    version: 1,
    strategy: lifetimeStrategy,
    receipts: lifetimeReceipts,
  };
  return [immediateDistribution, lifetimeDistribution];
}

export function convertLegacyTransfer(
  x: LegacyTransfer,
  discourseUrl: string | null
): TransferV1 {
  const memo = x.references.join(", ");
  const sender = resolveAlias(x.from, discourseUrl);
  const recipient = resolveAlias(x.to, discourseUrl);
  const amount = convertLegacyGrainRepresentation(x.amount);
  return {
    type: "TRANSFER",
    version: 1,
    sender,
    recipient,
    amount,
    timestampMs: x.timestamp,
    memo,
  };
}
