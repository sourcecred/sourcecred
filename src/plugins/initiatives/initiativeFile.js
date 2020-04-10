// @flow

import {type URL} from "../../core/references";
import {type TimestampISO} from "../../util/timestamp";
import {type NodeAddressT, NodeAddress} from "../../core/graph";
import {type Compatible, fromCompat, toCompat} from "../../util/compat";
import {initiativeNodeType} from "./declaration";
import {type InitiativeWeight, type InitiativeId, createId} from "./initiative";
import {type InitiativesDirectory} from "./initiativesDirectory";

export const INITIATIVE_FILE_SUBTYPE = "INITIATIVE_FILE";

/**
 * Represents a single Initiative using a file as source.
 *
 * Note: The file name will be used to derive the InitiativeId. So it doesn't
 * make sense to use this outside of the context of an InitiativesDirectory.
 */
export type InitiativeFile = {|
  +title: string,
  +timestampIso: TimestampISO,
  +weight: InitiativeWeight,
  +completed: boolean,
  +dependencies: $ReadOnlyArray<URL>,
  +references: $ReadOnlyArray<URL>,
  +contributions: $ReadOnlyArray<URL>,
  +champions: $ReadOnlyArray<URL>,
|};

const COMPAT_INFO = {type: "sourcecred/initiativeFile", version: "0.1.0"};

export function fromJSON(j: Compatible<any>): InitiativeFile {
  return fromCompat(COMPAT_INFO, j);
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
