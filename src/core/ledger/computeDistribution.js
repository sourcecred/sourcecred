// @flow

import * as uuid from "../../util/uuid";
import {type TimestampMs} from "../../util/timestamp";
import {
  type AllocationPolicy,
  type AllocationIdentity,
  computeAllocation,
} from "./grainAllocation";
import {type CredAccountData} from "./credAccounts";
import {type Distribution} from "./distribution";

/**
 * Compute a single Distribution using CredAccountData.
 *
 * The distribution will include the provided policies.
 * It will be computed using only Cred intervals that are finished as of the
 * effectiveTimestamp.
 *
 * Note: This method is untested as it is just a bit of plubming; flow gives me
 * confidence that the semantics are correct. The helper method
 * _allocationIdentities is tested, as it handles some naunces e.g. slicing
 * down the cred interval data.
 */
export function computeDistribution(
  policies: $ReadOnlyArray<AllocationPolicy>,
  accountsData: CredAccountData,
  effectiveTimestamp: TimestampMs
): Distribution {
  const allocationIdentities = _allocationIdentities(
    accountsData,
    effectiveTimestamp
  );
  const allocations = policies.map((p) =>
    computeAllocation(p, allocationIdentities)
  );
  const distribution = {
    id: uuid.random(),
    allocations,
    credTimestamp: effectiveTimestamp,
  };
  return distribution;
}

export function _allocationIdentities(
  accountsData: CredAccountData,
  effectiveTimestamp: TimestampMs
): $ReadOnlyArray<AllocationIdentity> {
  const activeAccounts = accountsData.accounts.filter(
    ({account}) => account.active
  );
  const allocationIdentities = activeAccounts.map((x) => ({
    id: x.account.identity.id,
    paid: x.account.paid,
    cred: x.cred,
  }));
  const numIntervals = accountsData.intervals.filter(
    (x) => x.endTimeMs <= effectiveTimestamp
  ).length;
  const timeSlicedAllocationIdentities = allocationIdentities.map((x) => ({
    id: x.id,
    paid: x.paid,
    cred: x.cred.slice(0, numIntervals),
  }));
  return timeSlicedAllocationIdentities;
}
