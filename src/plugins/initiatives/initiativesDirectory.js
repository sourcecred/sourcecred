// @flow

import path from "path";
import fs from "fs-extra";
import globby from "globby";
import {type ReferenceDetector} from "../../core/references";
import {type NodeAddressT, NodeAddress} from "../../core/graph";
import {type Compatible, fromCompat, toCompat} from "../../util/compat";
import {compatReader} from "../../backend/compatIO";
import {initiativeNodeType} from "./declaration";
import {
  type Initiative,
  type InitiativeId,
  type InitiativeRepository,
  type URL,
  createId,
  addressFromId,
} from "./initiative";

export const INITIATIVE_FILE_SUBTYPE = "INITIATIVE_FILE";

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
export function _initiativeFileId(
  {remoteUrl}: InitiativesDirectory,
  fileName: string
): InitiativeId {
  return createId(INITIATIVE_FILE_SUBTYPE, remoteUrl, fileName);
}

// Checks the path exists and is a directory.
// Returns the absolute path or throws.
export async function _validatePath(localPath: string): Promise<string> {
  const absPath = path.resolve(localPath);
  if (!(await fs.exists(absPath))) {
    throw new Error(
      `Provided initiatives directory does not exist at: ${absPath}`
    );
  }
  if (!(await fs.lstat(absPath)).isDirectory()) {
    throw new Error(
      `Provided initiatives directory is not a directory at: ${absPath}`
    );
  }
  return absPath;
}

// Gets all *.json filenames in the given directory.
export async function _findFiles(
  localPath: string
): Promise<$ReadOnlyArray<string>> {
  const absoluteFileNames = await globby(path.join(localPath, "*.json"));
  return absoluteFileNames.map((a) => path.basename(a));
}

type NamesToInitiativeFiles = Map<string, InitiativeFile>;

// Reads all given filenames in the given directory, validating them as compat.
export async function _readFiles(
  localPath: string,
  fileNames: $ReadOnlyArray<string>
): Promise<NamesToInitiativeFiles> {
  const map: NamesToInitiativeFiles = new Map();
  const readInitiativeFile = compatReader(fromJSON, "Initiative");

  // Sorting to be careful about predictability.
  // The eventual output of $ReadOnlyArray<Initiative> is ordered, so we'll see
  // the order matters for equality throughout the system.
  const sortedFileNames = [...fileNames].sort();
  for (const fileName of sortedFileNames) {
    const filePath = path.join(localPath, fileName);
    const initiativeFile = await readInitiativeFile(filePath);
    map.set(fileName, initiativeFile);
  }

  return map;
}

// Checks the provided URL will parse and has no trailing slashes, search or hash.
// Returns the validated URL without trailing slashes or throws.
export function _validateUrl(remoteUrl: string): string {
  try {
    const url = new global.URL(remoteUrl);
    if (url.search) {
      throw `URL should not have a search component: ${url.search}`;
    }
    if (url.hash) {
      throw `URL should not have a hash component: ${url.hash}`;
    }
    return url.toString().replace(/\/+$/, "");
  } catch (e) {
    throw new Error(
      `Provided initiatives directory URL was invalid: ${remoteUrl}\n${e}`
    );
  }
}

// Converts the InitiativeFiles we've read to Initiatives.
export function _convertToInitiatives(
  directory: InitiativesDirectory,
  map: NamesToInitiativeFiles
): $ReadOnlyArray<Initiative> {
  const initiatives = [];
  for (const [fileName, initiativeFile] of map.entries()) {
    const {timestampIso, ...partialInitiativeFile} = initiativeFile;
    const initiative: Initiative = {
      ...partialInitiativeFile,
      id: _initiativeFileId(directory, fileName),
      timestampMs: Date.parse(timestampIso),
    };
    initiatives.push(initiative);
  }
  return initiatives;
}

// Creates a reference map using `initiativeFileURL`.
export function _createReferenceMap(
  initiatives: $ReadOnlyArray<Initiative>
): Map<URL, NodeAddressT> {
  const refs = new Map();
  for (const {id} of initiatives) {
    const address = addressFromId(id);
    const url = initiativeFileURL(address);
    if (!url) {
      throw new Error("BUG: Initiative doesn't return an initiativeFileURL");
    }
    refs.set(url, address);
  }
  return refs;
}
