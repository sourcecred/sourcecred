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
import {CredView} from "../analysis/credView";
import {type TimestampMs} from "../util/timestamp";
import {NodeAddress, type NodeAddressT} from "../core/graph";

export type Cred = $ReadOnlyArray<number>;

export type CredAccount = {|
  +cred: Cred,
  +totalCred: number,
  +account: Account,
|};

export type UnclaimedAlias = {|
  +address: NodeAddressT,
  // We include the description for convenience in figuring out who this user is,
  // rendering in a UI, etc. This is just the description from the Graph.
  +description: string,
  +totalCred: number,
  +cred: Cred,
|};

export type CredAccountData = {|
  // Regular accounts: an identity with Cred, and potentially Grain
  +accounts: $ReadOnlyArray<CredAccount>,
  // Unclaimed aliases: An account on some platform that hasn't yet been
  // connected to any SourceCred identity
  +unclaimedAliases: $ReadOnlyArray<UnclaimedAlias>,
  // The timestamps demarcating the ends of the Cred intervals.
  // For interpreting the Cred data associated with cred accounts and
  // unclaimed accounts.
  +intervalEndpoints: $ReadOnlyArray<TimestampMs>,
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
  const intervalEndpoints = credView.credResult().credData.intervalEnds;
  return _computeCredAccounts(grainAccounts, userlikeInfo, intervalEndpoints);
}

export function _computeCredAccounts(
  grainAccounts: $ReadOnlyArray<Account>,
  userlikeInfo: Map<NodeAddressT, {|+cred: Cred, +description: string|}>,
  intervalEndpoints: $ReadOnlyArray<TimestampMs>
): CredAccountData {
  const aliases: Set<NodeAddressT> = new Set();
  const accountAddresses: Set<NodeAddressT> = new Set();

  const accounts = [];
  const unclaimedAliases = [];

  for (const account of grainAccounts) {
    accountAddresses.add(account.identity.address);
    for (const alias of account.identity.aliases) {
      aliases.add(alias);
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

  for (const [userAddress, info] of userlikeInfo.entries()) {
    if (accountAddresses.has(userAddress)) {
      // This userlike actually has an explicit account
      continue;
    }
    if (aliases.has(userAddress)) {
      throw new Error(
        `cred sync error: alias ${NodeAddress.toString(
          userAddress
        )} included in Cred scores`
      );
    }
    const {cred, description} = info;
    unclaimedAliases.push({
      address: userAddress,
      cred,
      totalCred: sum(cred),
      description,
    });
  }
  return {accounts, unclaimedAliases, intervalEndpoints};
}
