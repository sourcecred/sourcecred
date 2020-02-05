// @flow

import {type NodeAddressT, NodeAddress} from "../../core/graph";
import {type Compatible, fromCompat, toCompat} from "../../util/compat";
import type {Initiative, URL} from "./initiative";

const trackerPrefix = NodeAddress.fromParts(["sourcecred", "initiativesMap"]);

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

/**
 * Creates Initiatives from a InitiativesMap.
 */
export function mapToInitiatives(
  initiativesMap: InitiativesMap
): $ReadOnlyArray<Initiative> {
  const initiatives = [];
  for (const entryKey in initiativesMap) {
    const addr = _trackerAddress(entryKey);
    initiatives.push({
      ...initiativesMap[entryKey],
      tracker: addr,
    });
  }
  return initiatives;
}

export function _trackerAddress(entryKey: string): NodeAddressT {
  return NodeAddress.append(trackerPrefix, entryKey);
}

/**
 * Creates an InitiativesMap from Initiatives. Warning: this is a lossy
 * operation, as the original tracker address will be dropped!
 *
 * You might use this to take Initiatives from a different source, like an
 * editor, and format the Initiatives to be stored in a file.
 */
export function initiativesToMap(
  initiatives: $ReadOnlyArray<Initiative>
): InitiativesMap {
  const map: InitiativesMap = {};

  for (const initiative of initiatives) {
    const [baseKey, entry] = _initiativeToEntry(initiative);

    let i = 1;
    let key = baseKey;
    const maxAttempts = 100;
    while (map[key] && i < maxAttempts) {
      i++;
      key = `${baseKey}-${i}`;
    }

    if (map[key]) {
      throw new Error(
        `Couldn't generate an appropriate key in ${maxAttempts} attempts ` +
          `for initiative "${initiative.title}" (${isoDate(
            initiative.timestampMs
          )})`
      );
    }

    map[key] = entry;
  }

  return map;
}

export function _initiativeToEntry(
  initiative: Initiative
): [string, InitiativeEntry] {
  const entry = ({...initiative}: Object);
  delete entry.tracker;
  return [_keySlug(initiative), entry];
}

/**
 * Creates a normalized key in a "yyyy-mm-dd_initiative-title-here" format.
 * Note: these are URL friendly.
 */
export function _keySlug(initiative: Initiative): string {
  const titleSlug = initiative.title
    .toLowerCase()
    .replace(/\s/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  return `${isoDate(initiative.timestampMs)}_${titleSlug}`;
}

function isoDate(timestampMs: number): string {
  const [isoDate, _] = new Date(timestampMs).toISOString().split("T");
  return isoDate;
}
