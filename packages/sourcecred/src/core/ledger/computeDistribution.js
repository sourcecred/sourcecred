// @flow

import * as uuid from "../../util/uuid";
import {type TimestampMs} from "../../util/timestamp";
import {computeAllocation} from "./grainAllocation";
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
 * confidence that the semantics are correct.
 **/
export function computeDistribution(
  policies: $ReadOnlyArray<AllocationPolicy>,
  credGrainView: CredGrainView,
  effectiveTimestamp: TimestampMs
): Distribution {
  const allocations = policies.map((p) =>
    computeAllocation(p, credGrainView, effectiveTimestamp)
  );
  const distribution = {
    id: uuid.random(),
    allocations,
    credTimestamp: effectiveTimestamp,
  };
  return distribution;
}
