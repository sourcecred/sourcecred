// @flow

import {Ledger} from "../core/ledger/ledger";
import {type Distribution} from "../core/ledger/distribution";
import {type AllocationPolicyType} from "../core/ledger/policies";
import * as G from "../core/ledger/grain";
import sortBy from "../util/sortBy";
import {type IdentityId} from "../core/identity";
import * as NullUtil from "../util/null";

export function distributionMarkdownSummary(
  distribution: Distribution,
  ledger: Ledger,
  currencySuffix: string,
  currencyName: string
) {
  /**
   * Store the user balances across each policy type.
   */
  const allocationBalances: Map<
    IdentityId,
    Map<AllocationPolicyType, G.Grain>
  > = new Map();
  distribution.allocations.map(({policy, receipts}) => {
    receipts.map(({amount, id}) => {
      const existing = NullUtil.orElse(allocationBalances.get(id), new Map());
      const updated = existing.set(policy.policyType, amount);
      allocationBalances.set(id, updated);
    });
  });

  const ids = Array.from(allocationBalances.keys());
  const countIdentities = ids.length;
  let totalDistributed = G.ZERO;
  allocationBalances.forEach((_, id) => {
    const userTotal = NullUtil.orElse(getUserTotal(id), G.ZERO);
    totalDistributed = G.add(totalDistributed, userTotal);
  });
  console.log(
    `## ${currencyName || G.DEFAULT_NAME.toUpperCase()} Distribution`
  );
  console.log(
    `#### Distributed ${G.format(
      totalDistributed,
      0,
      currencySuffix
    )} to ${countIdentities} identities`
  );

  // Print the policies and budgets that make up this distribution.
  distribution.allocations.forEach(({policy}) => {
    const {policyType, budget} = policy;
    console.log(`#### ${policyType}: ${G.format(budget, 0, currencySuffix)}`);
  });

  console.log();
  console.log(
    `|          name          |   total   |     %     |  immediate  |   recent    |  balanced   |`
  );
  console.log(
    `| ---------------------- | --------- | --------- | ----------- | ----------- | ----------- |`
  );

  // Sort the accounts by total allocated before printing them in that order.
  const sortedIds: $ReadOnlyArray<IdentityId> = sortBy(
    ids,
    (id) => -Number(getUserTotal(id))
  );
  Array.from(sortedIds.map((id) => console.log(row(id))));
  console.log();

  /**
   * Given an IdentityId, get the total allocated in this distribution
   * using the allocationBalances Map.
   */
  function getUserTotal(id: IdentityId): G.Grain {
    let sum = G.ZERO;
    const balances = NullUtil.orElse(allocationBalances.get(id), false);
    if (balances) {
      balances.forEach((amount) => {
        sum = G.add(sum, amount);
      });
    }
    return sum;
  }

  function row(id: IdentityId) {
    const {name} = ledger.account(id).identity;
    const nameFormatted = format(name, 22);
    const total = NullUtil.orElse(getUserTotal(id), G.ZERO);
    const totalFormatted = format(G.toFloatRatio(total, G.ONE).toFixed(0), 9);
    const percentage = 100 * G.toFloatRatio(total, totalDistributed);
    const percentageFormatted = format(percentage.toFixed(2) + "%", 9);

    const policyBalances = NullUtil.orElse(
      allocationBalances.get(id),
      new Map()
    );
    let cols = "";
    policyBalances.forEach((amount) => {
      cols += `${format(G.toFloatRatio(amount, G.ONE).toFixed(0), 13)}|`;
    });

    return `| ${nameFormatted} | ${totalFormatted} | ${percentageFormatted} |${cols}`;

    // Center string in some length len.
    function format(str: string, len: number): string {
      return str.length >= len
        ? str
        : str.length < len - 1
        ? format(` ${str} `, len)
        : format(`${str} `, len);
    }
  }
}
