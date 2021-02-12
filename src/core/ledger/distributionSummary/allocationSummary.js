// @flow

import sortBy from "../../../util/sortBy";
import * as NullUtil from "../../../util/null";
import {type IdentityId} from "../../identity";
import {type Distribution} from "../distribution";
import * as G from "../grain";
import {type Allocation, type GrainReceipt} from "../grainAllocation";
import {Ledger} from "../ledger";
import {toString} from "../policies";
import {formatCenter} from "./distributionSummary";

export function allocationMarkdownSummary(
  distribution: Distribution,
  allocation: Allocation,
  ledger: Ledger
): string {
  const {receipts} = allocation;
  const totalDistributed: G.Grain = getTotalDistributed(receipts);

  const columnHeaders = `|          name          |    total    |     %     |`;
  const divider = `| ---------------------- | ----------- | --------- |`;

  return [
    toString(allocation.policy),
    columnHeaders,
    divider,
    sortedReceipts(receipts)
      .map(({amount, id}) => row(amount, id))
      .join(`\n`),
  ].join(`\n`);

  function row(amount: G.Grain, id: IdentityId) {
    const {name} = ledger.account(id).identity;
    const nameFormatted = formatCenter(name, 22);

    const total = NullUtil.orElse(amount, G.ZERO);
    const totalFormatted = formatCenter(G.format(total, 3, ""), 11);

    const percentage = 100 * G.toFloatRatio(total, totalDistributed);
    const percentageFormatted = formatCenter(percentage.toFixed(2) + "%", 9);

    return `| ${nameFormatted} | ${totalFormatted} | ${percentageFormatted} |`;
  }
}

/**
 * Given {allocationBalances}, return the total Grain distributed across ids.
 */
export function getTotalDistributed(
  receipts: $ReadOnlyArray<GrainReceipt>
): G.Grain {
  return receipts.reduce((sum, {amount}) => G.add(sum, amount), G.ZERO);
}

function sortedReceipts(
  receipts: $ReadOnlyArray<GrainReceipt>
): $ReadOnlyArray<GrainReceipt> {
  return sortBy(receipts, (receipt) => -Number(receipt.amount));
}
