// @flow

import {type CurrencyDetails} from "../../../api/currencyConfig";
import * as NullUtil from "../../../util/null";
import sortBy from "../../../util/sortBy";
import {toISO, type TimestampMs} from "../../../util/timestamp";
import {type IdentityId} from "../../identity";
import {type Distribution} from "../distribution";
import * as G from "../grain";
import {Ledger} from "../ledger";

export function distributionMarkdownSummary(
  distribution: Distribution,
  ledger: Ledger,
  currencyDetails: CurrencyDetails
): string {
  const {name: currencyName, suffix: currencySuffix} = currencyDetails;
  const distributionBalances: DistributionBalances =
    getDistributionBalances(distribution);
  const totalDistributed: G.Grain = getTotalDistributed(distributionBalances);

  const columnHeaders = `|          name          |    total    |     %     |`;
  const divider = `| ---------------------- | ----------- | --------- |`;

  return [
    title(currencyName),
    timeStamp(distribution.credTimestamp),
    total(totalDistributed, currencySuffix),
    policyAmounts(distribution, currencySuffix),
    columnHeaders,
    divider,
    sortedIds(distributionBalances).map(row).join(`\n`),
  ].join(`\n`);

  function row(id: IdentityId) {
    const {name} = ledger.account(id).identity;
    const nameFormatted = formatCenter(name, 22);

    const total = NullUtil.orElse(distributionBalances.get(id), G.ZERO);
    const totalFormatted = formatCenter(G.format(total, 3, ""), 11);

    const percentage = 100 * G.toFloatRatio(total, totalDistributed);
    const percentageFormatted = formatCenter(percentage.toFixed(2) + "%", 9);

    return `| ${nameFormatted} | ${totalFormatted} | ${percentageFormatted} |`;
  }
}

function title(currencyName: string): string {
  return `## ${currencyName.toUpperCase()} Distribution`;
}

function timeStamp(credTimeStamp: TimestampMs): string {
  return `### ${toISO(credTimeStamp)}`;
}

function total(total: G.Grain, currencySuffix: string): string {
  return `#### Total Distributed: ${G.formatAndTrim(total, currencySuffix)}`;
}

function policyAmounts(
  distribution: Distribution,
  currencySuffix: string
): string {
  return distribution.allocations
    .map(({policy}) => {
      const {policyType, budget} = policy;
      return `#### ${policyType}: ${G.formatAndTrim(budget, currencySuffix)}`;
    })
    .join(`\n`);
}

/**
 * Return ids sorted by balance.
 */
function sortedIds(
  distributionBalances: DistributionBalances
): $ReadOnlyArray<IdentityId> {
  return sortBy(
    Array.from(distributionBalances.keys()),
    (id) => -Number(distributionBalances.get(id))
  );
}

/**
 * Center string in some whitespace for total length {len}.
 */
export function formatCenter(str: string, len: number): string {
  return str.length >= len
    ? str
    : str.length < len - 1
    ? formatCenter(` ${str} `, len)
    : formatCenter(`${str} `, len);
}

/**
 * Given some distribution, return the total allocated to id across
 * all allocation policies.
 */
export type DistributionBalances = Map<IdentityId, G.Grain>;
export function getDistributionBalances(
  distribution: Distribution
): DistributionBalances {
  const distributionBalances = new Map<IdentityId, G.Grain>();

  distribution.allocations.map(({receipts}) => {
    receipts.map(({amount, id}) => {
      const existing = NullUtil.orElse(distributionBalances.get(id), G.ZERO);
      distributionBalances.set(id, G.add(amount, existing));
    });
  });

  return distributionBalances;
}

/**
 * Given DistributionBalances, return total grain distributed
 * across participants.
 */
export function getTotalDistributed(
  distributionBalances: DistributionBalances
): G.Grain {
  let total: G.Grain = G.ZERO;
  distributionBalances.forEach((amount) => {
    total = G.add(total, amount);
  });
  return total;
}
