// @flow

/**
 * This module outputs aggregated data that combines Cred Scores with Ledger
 * Account data.
 *
 * We use this internally when creating Grain distributions using a Ledger and
 * a Cred View. It's also an experimental output format which gives overall
 * information on the cred in an instance. We may remove it or make breaking
 * changes to it in the future.
 */
import {sum} from "d3-array";
import {Ledger, type Account} from "./ledger";
import {CredView} from "../../analysis/credView";
import {NodeAddress, type NodeAddressT} from "../graph";
import {type IntervalSequence} from "../interval";
import {type Alias} from "../identity";

export type Cred = $ReadOnlyArray<number>;

export type CredAccount = {|
  +cred: Cred,
  +totalCred: number,
  +account: Account,
|};

export type UnclaimedAlias = {|
  +alias: Alias,
  +totalCred: number,
  +cred: Cred,
|};

export type CredAccountData = {|
  // Regular accounts: an identity with Cred, and potentially Grain
  +accounts: $ReadOnlyArray<CredAccount>,
  // Unclaimed aliases: An account on some platform that hasn't yet been
  // connected to any SourceCred identity
  +unclaimedAliases: $ReadOnlyArray<UnclaimedAlias>,
  // For interpreting the Cred data associated with cred accounts and
  // unclaimed accounts.
  +intervals: IntervalSequence,
|};

export function computeCredAccounts(
  ledger: Ledger,
  credView: CredView
): CredAccountData {
  const grainAccounts = ledger.accounts();
  const userlikeInfo = new Map();
  for (const {address, credOverTime, description} of credView.userNodes()) {
    if (credOverTime == null) {
      throw new Error(
        `userlike ${NodeAddress.toString(address)} does not have detailed cred`
      );
    }
    userlikeInfo.set(address, {cred: credOverTime.cred, description});
  }
  const intervals = credView.intervals();
  return _computeCredAccounts(grainAccounts, userlikeInfo, intervals);
}

export function _computeCredAccounts(
  grainAccounts: $ReadOnlyArray<Account>,
  userlikeInfo: Map<NodeAddressT, {|+cred: Cred, +description: string|}>,
  intervals: IntervalSequence
): CredAccountData {
  const aliasAddresses: Set<NodeAddressT> = new Set();
  const accountAddresses: Set<NodeAddressT> = new Set();

  const accounts = [];
  const unclaimedAliases = [];

  for (const account of grainAccounts) {
    accountAddresses.add(account.identity.address);
    for (const alias of account.identity.aliases) {
      aliasAddresses.add(alias.address);
    }
    const info = userlikeInfo.get(account.identity.address);
    if (info == null) {
      throw new Error(
        `cred sync error: no info for account ${account.identity.name}`
      );
    }
    const {cred} = info;
    const credAccount = {account, cred, totalCred: sum(cred)};
    accounts.push(credAccount);
  }

  for (const [address, info] of userlikeInfo.entries()) {
    if (accountAddresses.has(address)) {
      // This userlike actually has an explicit account
      continue;
    }
    const {cred, description} = info;
    if (aliasAddresses.has(address)) {
      throw new Error(
        `cred sync error: alias ${NodeAddress.toString(
          address
        )} (aka ${description}) included in Cred scores`
      );
    }
    unclaimedAliases.push({
      alias: {address, description},
      cred,
      totalCred: sum(cred),
    });
  }
  return {accounts, unclaimedAliases, intervals};
}
