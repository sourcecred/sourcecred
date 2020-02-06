// @flow

import {type ReferenceDetector} from "../../core/references";
import {type Compatible, fromCompat, toCompat} from "../../util/compat";
import {type InitiativeRepository, type URL} from "./initiative";

/**
 * Represents an Initiatives directory.
 *
 * Initiative directories contain a set of InitiativeFiles in a `*.json` pattern.
 * Where the file name is the ID of that Initiative.
 * Additionally we require a `remoteUrl` for this directory. We expect this directory
 * to be something you can browse online. This allows us to create a ReferenceDetector.
 */
export type InitiativesDirectory = {|
  +localPath: string,
  +remoteUrl: string,
|};

/**
 * Opaque because we only want this file's functions to create these load results.
 * However we do allow anyone to consume it's properties.
 */
export opaque type LoadedInitiativesDirectory: {|
  +referenceDetector: ReferenceDetector,
  +initiatives: InitiativeRepository,
|} = {|
  +referenceDetector: ReferenceDetector,
  +initiatives: InitiativeRepository,
|};

// Adding below signature to help clarity of this commit.
// TODO: @beanow will implement this in a follow-up.
type _unused_loadDirectoryFunction = (InitiativesDirectory) => Promise<LoadedInitiativesDirectory>;

/**
 * Represents a single Initiative using a file as source.
 *
 * Note: The file name will be used to derive the InitiativeId. So it doesn't
 * make sense to use this outside of the context of an InitiativesDirectory.
 */
export type InitiativeFile = {|
  +title: string,
  +timestampIso: ISOTimestamp,
  +completed: boolean,
  +dependencies: $ReadOnlyArray<URL>,
  +references: $ReadOnlyArray<URL>,
  +contributions: $ReadOnlyArray<URL>,
  +champions: $ReadOnlyArray<URL>,
|};

// Note: setting this to opaque forces us to convert it to timestampMs.
opaque type ISOTimestamp = string;

const COMPAT_INFO = {type: "sourcecred/initiativeFile", version: "0.1.0"};

export function fromJSON(j: Compatible<any>): InitiativeFile {
  return fromCompat(COMPAT_INFO, j);
}

export function toJSON(m: InitiativeFile): Compatible<InitiativeFile> {
  return toCompat(COMPAT_INFO, m);
}
