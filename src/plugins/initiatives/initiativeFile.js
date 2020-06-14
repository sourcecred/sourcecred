// @flow

import {type URL} from "../../core/references";
import {type TimestampISO} from "../../util/timestamp";
import {type NodeAddressT, NodeAddress} from "../../core/graph";
import {type Compatible, fromCompat, toCompat} from "../../util/compat";
import {type InitiativeWeight, type InitiativeId, createId} from "./initiative";
import {type InitiativesDirectory} from "./initiativesDirectory";
import {type EdgeSpecJson} from "./edgeSpec";
import {initiativeNodeType} from "./declaration";
import {type NodeEntryJson} from "./nodeEntry";

export const INITIATIVE_FILE_SUBTYPE = "INITIATIVE_FILE";

/**
 * Represents a single Initiative using a file as source.
 *
 * Note: The file name will be used to derive the InitiativeId. So it doesn't
 * make sense to use this outside of the context of an InitiativesDirectory.
 */
export type InitiativeFile = InitiativeFileV020;

/**
 * Stored inside a initiatives.json db file with other initiatives.
 * presently the `id` prop is used as the key inside the db file
 */
export type InitiativeFileV100 = {|
  id: string, // json file name right now. probably not needed if this is stored in side a json db file
  // Compat info is usually stored within a header object, but in the db file parsing is more
  // straightforward if it's folded inside the primary data object
  type: string,
  version: string,
  title: string,
  timestampIso: TimestampISO,
  weight: InitiativeWeight,
  completed: boolean,
  // should be user nodes: may need a a more specific type
  champions: ?$ReadOnlyArray<NodeAddressT>,
  dependencies: ?$ReadOnlyArray<NodeAddressT>,
  // should be an activity node. Will be more difficult to specify this
  references: ?$ReadOnlyArray<NodeAddressT>,
  contributions: ?$ReadOnlyArray<NodeEntryJson>,
|};

export type InitiativeFileV020 = {|
  +title: string,
  +timestampIso: TimestampISO,
  +weight: InitiativeWeight,
  +completed: boolean,
  +contributions?: EdgeSpecJson,
  +dependencies?: EdgeSpecJson,
  +references?: EdgeSpecJson,
  +champions?: $ReadOnlyArray<URL>,
|};

const upgradeFrom010 = (file: InitiativeFileV010): InitiativeFileV020 => ({
  ...file,
  contributions: {urls: file.contributions},
  dependencies: {urls: file.dependencies},
  references: {urls: file.references},
});

export type InitiativeFileV010 = {|
  +title: string,
  +timestampIso: TimestampISO,
  +weight: InitiativeWeight,
  +completed: boolean,
  +dependencies: $ReadOnlyArray<URL>,
  +references: $ReadOnlyArray<URL>,
  +contributions: $ReadOnlyArray<URL>,
  +champions: $ReadOnlyArray<URL>,
|};

const upgrades = {
  "0.1.0": upgradeFrom010,
};

const COMPAT_INFO = {type: "sourcecred/initiativeFile", version: "0.2.0"};

export function fromJSON(j: Compatible<any>): InitiativeFile {
  return fromCompat(COMPAT_INFO, j, upgrades);
}

export function toJSON(m: InitiativeFile): Compatible<InitiativeFile> {
  return toCompat(COMPAT_INFO, m);
}

/**
 * When provided with the initiative NodeAddressT of an InitiativeFile this extracts
 * the URL from it. Or null when the address is not for an InitiativeFile.
 */
export function initiativeFileURL(address: NodeAddressT): string | null {
  const initiativeFilePrefix = NodeAddress.append(
    initiativeNodeType.prefix,
    INITIATIVE_FILE_SUBTYPE
  );

  if (!NodeAddress.hasPrefix(address, initiativeFilePrefix)) {
    return null;
  }

  const parts = NodeAddress.toParts(address);
  const remoteUrl = parts[4];
  const fileName = parts[5];
  return `${remoteUrl}/${fileName}`;
}

// Creates the InitiativeId for an InitiativeFile.
export function initiativeFileId(
  {remoteUrl}: InitiativesDirectory,
  fileName: string
): InitiativeId {
  return createId(INITIATIVE_FILE_SUBTYPE, remoteUrl, fileName);
}
