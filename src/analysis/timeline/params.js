// @flow

import * as C from "../../util/combo";
import * as N from "../../util/numerics";

/**
 * Parameters for computing TimelineCred
 *
 * The parameters are intended to be user-configurable.
 */
export type TimelineCredParameters = {|
  // Determines how quickly cred returns to the PageRank seed vector. If alpha
  // is high, then cred will tend to "stick" to nodes that are seeded, e.g.
  // issues and pull requests. Alpha should be between 0 and 1.
  +alpha: N.Proportion,
  // Determines how quickly cred decays. The decay is 1, then cred never
  // decays, and old nodes and edges will retain full weight forever. (This
  // would result in cred that is highly biased towards old contributions, as
  // they would continue earning cred in every timeslice, forever.) If the
  // decay is 0, then weights go to zero the first week after their node/edge
  // was created. Should be between 0 and 1.
  +intervalDecay: N.Proportion,
|};

export const DEFAULT_ALPHA = N.proportion(0.2);
export const DEFAULT_INTERVAL_DECAY = N.proportion(0.5);

export type TimelineCredParametersJSON = {|
  +alpha: number,
  +intervalDecay: number,
|};

export function paramsToJSON(
  p: TimelineCredParameters
): TimelineCredParametersJSON {
  return {
    alpha: p.alpha,
    intervalDecay: p.intervalDecay,
  };
}

export function paramsFromJSON(
  p: TimelineCredParametersJSON
): TimelineCredParameters {
  return {
    alpha: N.proportion(p.alpha),
    intervalDecay: N.proportion(p.intervalDecay),
  };
}

const partialParser: C.Parser<$Shape<TimelineCredParameters>> = C.shape({
  alpha: N.proportionParser,
  intervalDecay: N.proportionParser,
});

export const parser: C.Parser<TimelineCredParameters> = C.fmap(
  partialParser,
  partialParams
);

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
  };
}

/**
 * Fill in default values for timeline cred parameters.
 */
export function partialParams(
  partial: $Shape<TimelineCredParameters> | null
): TimelineCredParameters {
  return {...defaultParams(), ...partial};
}
