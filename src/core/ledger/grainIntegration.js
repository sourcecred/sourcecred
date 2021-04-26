// @flow

import {Ledger, type PayoutAddress, type CurrencyId} from "./ledger";
import {type Distribution} from "./distribution";
import {getDistributionBalances} from "./distributionSummary/distributionSummary.js";
import {type Currency} from "./currency.js";
import {type IdentityId} from "../identity";
import * as G from "./grain";

type Transfer = {|
  amount: G.Grain,
  memo: string,
|};

export type AccountDistributions = Map<PayoutAddress, G.Grain>;
export type PayoutAddressToId = Map<PayoutAddress, IdentityId>;
export type TransferredGrain = Map<PayoutAddress, Transfer>;

export type IntegrationResult = {|
  // Amounts that are actually distributed by the integration.
  // If Grain is still not tracked offchain, these can be recorded as transfers
  // in the ledger to the "sink" Identity.
  transferredGrain: TransferredGrain,
|};

export type IntegrationConfig = {|
  // This determines whether contemporary grain balances are tracked by the ledger.
  // `true` is effectively the current state of the ledger.
  // `false` sets all grain balances to zero and disables transfers. This
  // is utilized to enforce the exististence of token balances outside of the
  // ledger. Importantly, Grain Receipts from allocations are still tracked,
  // because some grain distribution strategies rely on this information.
  accountingEnabled: boolean,
  // This enables a new ledger event where all distributions after this
  // config is enabled should have a matching "Integration" event. If not,
  // an interface should prompt admin interface users that they haven't
  // distributed funds via a configured integration
  processDistributions: boolean,
|};

/**
 * This function definition is implemented by Grain Integrations.
 * Grain integrations allow distributions to be executed programmatically
 * beyond the ledger. However, an integration might have some side-effects
 * that require the ledger to be updated, and it therefore has the option of
 * returning a list of of ledger operations. The ledger will update the ledger
 * if accounting is enabled. Otherwise, grain balances will be tracked
 * elsewhere.
 */
export type grainIntegration = (
  AccountDistributions,
  Currency
) => ?IntegrationResult;

///////////////////
// Helper functions
///////////////////

// TODO @topocount: Refactor interface using instance/config properties
// after grainConfig is updated to include The payout currency details and
// sink identity
export function executeGrainIntegration(
  ledger: Ledger,
  integration: grainIntegration,
  distribution: Distribution,
  currency: Currency,
  accountingEnabled: boolean,
  processDistributions: boolean,
  sink?: IdentityId
): Ledger {
  const {distributions, payoutAddressToId} = buildDistributionIndexes(
    ledger,
    distribution,
    JSON.stringify(currency)
  );
  // Need to receive actual allocations so users don't lose funds if
  // decimals are truncated in L2 or in some other environment that must modify
  // the fixed-point amount for some reason.
  let result;
  try {
    result = integration(distributions, currency);
    if (processDistributions) ledger.runIntegration(distribution.id);
  } catch (e) {
    throw new Error(`Grain Integration failed: ${e}`);
  }
  if (result && sink && accountingEnabled && processDistributions) {
    const {transferredGrain} = result;
    for (const [address, {amount, memo}] of transferredGrain.entries()) {
      const recipientId = payoutAddressToId.get(address);
      if (!recipientId)
        throw new Error(`Invalid recipient address: ${address}`);
      ledger.transferGrain({
        from: recipientId,
        to: sink,
        amount,
        memo: `Integrated Distribution: ${memo}`,
      });
    }
  }
  return ledger;
}

export function buildDistributionIndexes(
  ledger: Ledger,
  distribution: Distribution,
  currencyId: CurrencyId
): {distributions: AccountDistributions, payoutAddressToId: PayoutAddressToId} {
  const distributions = new Map();
  const payoutAddressToId = new Map();
  const balances = getDistributionBalances(distribution);
  for (const [id, amount] of balances.entries()) {
    const {payoutAddresses, identity} = ledger.account(id);
    const address = payoutAddresses.get(currencyId);
    if (!address) continue;
    // need to allow for identities that have since been merged to still claim
    // funds if accounts are merged between a grain distribution a
    // grainIntegration call.
    const total = distributions.get(address) ?? G.ZERO;
    distributions.set(address, G.add(amount, total));
    payoutAddressToId.set(address, identity.id);
  }

  return {distributions, payoutAddressToId};
}
