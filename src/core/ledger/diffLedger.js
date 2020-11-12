// @flow

import {Ledger} from "./ledger";
import type {LedgerEvent} from "./ledger";
import diffBy from "lodash.differenceby";

export type LedgerDiff = $ReadOnlyArray<LedgerEvent>;

/**
 * Returns an array of ledger events that exist in ledger "a" but not in "b".
 * An event is considered equal to another if it has the same uuid.
 *
 * This will not return any events from "b" that don't exist in "a", so the
 * order of the params matters.
 *
 * Example 1:
 *  - Ledger A: [1, 2, 3]
 *  - Ledger B: [1, 3, 4, 5]
 *  - Returns: [2]
 *
 * Example 2:
 *  - Ledger A: [1, 3, 4, 5]
 *  - Ledger B: [1, 2, 3]
 *  - Returns: [4, 5]
 */
export function diffLedger(a: Ledger, b: Ledger): LedgerDiff {
  return diffBy(a.eventLog(), b.eventLog(), "uuid");
}
