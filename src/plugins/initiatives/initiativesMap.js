// @flow

import {type Compatible, fromCompat, toCompat} from "../../util/compat";
import {type URL} from "./initiative";

const COMPAT_INFO = {type: "sourcecred/initiatives", version: "0.1.0"};

/**
 * JSON (compat) representation of an Initiative.
 *
 * Major difference is that instead of using tracker addresses, we use object
 * keys as an ID, and derive the tracker address from that.
 */
export type InitiativesMap = {[entryKey: string]: InitiativeEntry};

type InitiativeEntry = {|
  +title: string,
  +timestampMs: number,
  +completed: boolean,
  +dependencies: $ReadOnlyArray<URL>,
  +references: $ReadOnlyArray<URL>,
  +contributions: $ReadOnlyArray<URL>,
  +champions: $ReadOnlyArray<URL>,
|};

export function fromJSON(j: Compatible<any>): InitiativesMap {
  return fromCompat(COMPAT_INFO, j);
}

export function toJSON(m: InitiativesMap): Compatible<InitiativesMap> {
  return toCompat(COMPAT_INFO, m);
}
