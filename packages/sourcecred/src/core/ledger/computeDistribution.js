// @flow

import * as uuid from "../../util/uuid";
import {type TimestampMs} from "../../util/timestamp";
import {type AllocationIdentity, computeAllocation} from "./grainAllocation";
import {type AllocationPolicy} from "./policies";
import {type CredGrainView} from "../credGrainView";
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
  credGrainView: CredGrainView,
  effectiveTimestamp: TimestampMs
): Distribution {

  const allocationIdentities = _allocationIdentities(
    credGrainView,
    effectiveTimestamp
  );

  // As of now the balanced policy uses credGrainView and effective Timestamp
  // but other policies are still using allocationIdentities.
  // when all policies are converted to credGrainView, we won't need
  // allocationIdentities, but for the time being, we need both.

  const allocations = policies.map((p) =>
    computeAllocation(p, allocationIdentities, credGrainView, effectiveTimestamp)
  );
  const distribution = {
    id: uuid.random(),
    allocations,
    credTimestamp: effectiveTimestamp,
  };
  return distribution;
}

export function _allocationIdentities(
  credGrainView: CredGrainView,
  effectiveTimestamp: TimestampMs
): $ReadOnlyArray<AllocationIdentity> {
  const timeSlicedActiveParticipants = credGrainView
    .withTimeScope(0, effectiveTimestamp)
    .participants()
    .filter((participant) => participant.active);

  return timeSlicedActiveParticipants.map((x) => ({
    id: x.identity.id,
    paid: x.grainEarned,
    cred: x.credPerInterval,
  }));
}
