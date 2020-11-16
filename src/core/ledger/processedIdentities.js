// @flow

import {type IdentityId} from "../identity";
import * as G from "./grain";
import {type AllocationIdentity} from "./grainAllocation";

// ProcessedIdentities type has the following guarantees:
// - no Cred is negative
// - no Paid is negative
// - total Cred is positive
// - all cred arrays have same length
export opaque type ProcessedIdentities: $ReadOnlyArray<{|
  +paid: G.Grain,
  +id: IdentityId,
  +cred: $ReadOnlyArray<number>,
  +lifetimeCred: number,
  +mostRecentCred: number,
|}> = $ReadOnlyArray<{|
  +paid: G.Grain,
  +id: IdentityId,
  +cred: $ReadOnlyArray<number>,
  +lifetimeCred: number,
  +mostRecentCred: number,
|}>;
export function processIdentities(
  items: $ReadOnlyArray<AllocationIdentity>
): ProcessedIdentities {
  if (items.length === 0) {
    throw new Error(`must have at least one identity to allocate grain to`);
  }
  let hasPositiveCred = false;
  const credLength = items[0].cred.length;
  const results = items.map((i) => {
    const {cred, id, paid} = i;
    if (G.lt(paid, G.ZERO)) {
      throw new Error(`negative paid: ${paid}`);
    }
    if (credLength !== cred.length) {
      throw new Error(
        `inconsistent cred length: ${credLength} vs ${cred.length}`
      );
    }
    let lifetimeCred = 0;
    for (const c of cred) {
      if (c < 0 || !isFinite(c)) {
        throw new Error(`invalid cred: ${c}`);
      }
      if (c > 0) {
        hasPositiveCred = true;
      }
      lifetimeCred += c;
    }
    return {
      id,
      paid,
      cred,
      lifetimeCred,
      mostRecentCred: cred[cred.length - 1],
    };
  });
  if (!hasPositiveCred) {
    throw new Error("cred is zero");
  }
  return results;
}
