// @flow

/**
 * The RepoIdRegistry is a small JSON file that SourceCred uses to track which
 * RepoIds have been loaded.
 *
 * The registry consists of Entries. The entry contains the RepoId of the
 * loaded repository, and may contain additional metadata (e.g. the last-loaded
 * timestamp).
 */
import deepEqual from "lodash.isequal";
import {toCompat, fromCompat, type Compatible} from "../util/compat";
import type {RepoId} from "../core/repoId";
import fs from "fs";
import path from "path";
import stringify from "json-stable-stringify";

export const REPO_ID_REGISTRY_FILE = "repositoryRegistry.json";
export const REPO_ID_REGISTRY_API = "/api/v1/data/repositoryRegistry.json";

const REPO_ID_REGISTRY_COMPAT = {type: "REPO_ID_REGISTRY", version: "0.2.0"};

export type RegistryEntry = {|
  +repoId: RepoId,
|};
export type RepoIdRegistry = $ReadOnlyArray<RegistryEntry>;
export type RepoIdRegistryJSON = Compatible<RepoIdRegistry>;

/**
 * Adds a new entry to an existing RepoIdRegistry.
 */
export function addEntry(
  registry: RepoIdRegistry,
  entry: RegistryEntry
): RepoIdRegistry {
  return [
    ...registry.filter(
      (x: RegistryEntry) => !deepEqual(x.repoId, entry.repoId)
    ),
    entry,
  ];
}

/**
 * Get an entry from a RepoIdRegistry, using the RepoId as a key.
 *
 * Returns `undefined` if there is no corresponding entry.
 */
export function getEntry(
  registry: RepoIdRegistry,
  repoId: RepoId
): RegistryEntry | typeof undefined {
  return registry.find((entry) => deepEqual(entry.repoId, repoId));
}

/**
 * Create a new, empty RepoIdRegistry.
 */
export function emptyRegistry(): RepoIdRegistry {
  return [];
}

/**
 * Load the RepoIdRegistry from its conventional location within the
 * provided sourcecredDirectory.
 *
 * The conventional location is the REPO_ID_REGISTRY_FILE within
 * the sourcecred directory.
 *
 * If no registry file is present, an empty registry will be returned
 * (but not written to disk).
 */
export function getRegistry(sourcecredDirectory: string): RepoIdRegistry {
  const registryFile = path.join(sourcecredDirectory, REPO_ID_REGISTRY_FILE);
  if (fs.existsSync(registryFile)) {
    const contents = fs.readFileSync(registryFile);
    const registryJSON: RepoIdRegistryJSON = JSON.parse(contents.toString());
    return fromJSON(registryJSON);
  } else {
    return emptyRegistry();
  }
}

/**
 * Write the RepoIdRegistry to its conventional location within the
 * provided sourcecredDirectory.
 *
 * The conventional location is the REPO_ID_REGISTRY_FILE within
 * the sourcecred directory.
 *
 * If a registry is already present, it will be overwritten.
 */
export function writeRegistry(
  registry: RepoIdRegistry,
  sourcecredDirectory: string
) {
  const registryFile = path.join(sourcecredDirectory, REPO_ID_REGISTRY_FILE);
  fs.writeFileSync(registryFile, stringify(toJSON(registry)));
}

/**
 * Convert a RepoIdRegistry to JSON.
 * Exported for testing purposes.
 */
export function toJSON(r: RepoIdRegistry): RepoIdRegistryJSON {
  return toCompat(REPO_ID_REGISTRY_COMPAT, r);
}

/**
 * Convert a RepoIdRegistryJSON to a RepoIdRegistry.
 * Exported for testing purposes.
 */
export function fromJSON(j: RepoIdRegistryJSON): RepoIdRegistry {
  return fromCompat(REPO_ID_REGISTRY_COMPAT, j);
}
