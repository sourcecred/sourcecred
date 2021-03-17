// @flow

import path from "path";
import fs from "fs-extra";
import globby from "globby";
import {type URL} from "../../core/references";
import {type NodeAddressT} from "../../core/graph";
import * as Timestamp from "../../util/timestamp";
import {normalizeEdgeSpec} from "./edgeSpec";
import {
  type ReferenceDetector,
  MappedReferenceDetector,
} from "../../core/references";
import {
  type Initiative,
  type InitiativeRepository,
  addressFromId,
} from "./initiative";
import {
  type InitiativeFile,
  initiativeFileURL,
  initiativeFileId,
} from "./initiativeFile";
import {loadJson} from "../../util/disk";
import {DiskStorage} from "../../core/storage/disk";
import {parser as initiativeParser} from "./parseInitiative";

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

/**
 * Loads a given InitiativesDirectory.
 */
export async function loadDirectory(
  dir: InitiativesDirectory
): Promise<LoadedInitiativesDirectory> {
  // Validate input.
  const remoteUrl = _validateUrl(dir.remoteUrl);
  const localPath = await _validatePath(dir.localPath);
  const validatedDir: InitiativesDirectory = {remoteUrl, localPath};

  // Load data.
  const fileNames = await _findFiles(localPath);
  const fileMap = await _readFiles(localPath, fileNames);
  const initiatives = _convertToInitiatives(validatedDir, fileMap);
  const refMap = _createReferenceMap(initiatives);

  // Create output types.
  const repository = ({initiatives: () => initiatives}: InitiativeRepository);
  const referenceDetector = new MappedReferenceDetector(refMap);
  return {
    initiatives: repository,
    referenceDetector,
  };
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

  // Sorting to be careful about predictability.
  // The eventual output of $ReadOnlyArray<Initiative> is ordered, so we'll see
  // the order matters for equality throughout the system.
  const sortedFileNames = [...fileNames].sort();
  for (const fileName of sortedFileNames) {
    const storage = new DiskStorage(localPath);
    const initiativeFile = await loadJson(storage, fileName, initiativeParser);
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
    const {
      timestampIso,
      champions,
      contributions,
      dependencies,
      references,
      ...partialInitiativeFile
    } = initiativeFile;

    const timestampMs = Timestamp.fromISO(timestampIso);

    const initiative: Initiative = {
      ...partialInitiativeFile,
      id: initiativeFileId(directory, fileName),
      timestampMs,
      champions: champions || [],
      contributions: normalizeEdgeSpec(contributions, timestampMs),
      dependencies: normalizeEdgeSpec(dependencies, timestampMs),
      references: normalizeEdgeSpec(references, timestampMs),
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
