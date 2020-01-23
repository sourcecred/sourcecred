// @flow

import {type Weights as WeightsT, type WeightsJSON} from "../../core/weights";
import * as Weights from "../../core/weights";

/**
 * Parameters for computing TimelineCred
 *
 * The parameters are intended to be user-configurable.
 */
export type TimelineCredParameters = {|
  // Determines how quickly cred returns to the PageRank seed vector. If alpha
  // is high, then cred will tend to "stick" to nodes that are seeded, e.g.
  // issues and pull requests. Alpha should be between 0 and 1.
  +alpha: number,
  // Determines how quickly cred decays. The decay is 1, then cred never
  // decays, and old nodes and edges will retain full weight forever. (This
  // would result in cred that is highly biased towards old contributions, as
  // they would continue earning cred in every timeslice, forever.) If the
  // decay is 0, then weights go to zero the first week after their node/edge
  // was created. Should be between 0 and 1.
  +intervalDecay: number,
  // The weights. This determines how much cred is assigned based on different
  // node types, how cred flows across various edge types, and can specify
  // manual weights directly on individual nodes. See the docs in
  // `analysis/weights` for details.
  +weights: WeightsT,
|};

export const DEFAULT_ALPHA = 0.2;
export const DEFAULT_INTERVAL_DECAY = 0.5;

export type TimelineCredParametersJSON = {|
  +alpha: number,
  +intervalDecay: number,
  +weights: WeightsJSON,
|};

export function paramsToJSON(
  p: TimelineCredParameters
): TimelineCredParametersJSON {
  return {
    alpha: p.alpha,
    intervalDecay: p.intervalDecay,
    weights: Weights.toJSON(p.weights),
  };
}

export function paramsFromJSON(
  p: TimelineCredParametersJSON
): TimelineCredParameters {
  return {
    alpha: p.alpha,
    intervalDecay: p.intervalDecay,
    weights: Weights.fromJSON(p.weights),
  };
}

/**
 * Exports the default TimelineCredParameters.
 *
 * End consumers of SourceCred will not need to depend on this; it's
 * provided for implementation of SourceCred's APIs.
 */
export function defaultParams(): TimelineCredParameters {
  return {
    alpha: DEFAULT_ALPHA,
    intervalDecay: DEFAULT_INTERVAL_DECAY,
    weights: Weights.empty(),
  };
}

/**
 * Fill in default values for timeline cred parameters.
 */
export function partialParams(
  partial: $Shape<TimelineCredParameters>
): TimelineCredParameters {
  return {...defaultParams(), ...partial};
}
