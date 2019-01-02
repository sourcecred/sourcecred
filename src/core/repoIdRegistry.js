// @flow

// The repoIdRegistry is written by the CLI load command (src/cli/load.js)
// and is read by the RepositorySelect component
// (src/app/credExplorer/RepositorySelect.js)
import deepEqual from "lodash.isequal";
import {toCompat, fromCompat, type Compatible} from "../util/compat";
import type {RepoId} from "../core/repoId";

export const REPO_ID_REGISTRY_FILE = "repositoryRegistry.json";
export const REPO_ID_REGISTRY_API = "/api/v1/data/repositoryRegistry.json";

const REPO_ID_REGISTRY_COMPAT = {type: "REPO_ID_REGISTRY", version: "0.2.0"};

export type RegistryEntry = {|
  +repoId: RepoId,
  +timestamp: Date,
|};
export type RepoIdRegistry = $ReadOnlyArray<RegistryEntry>;
export type RepoIdRegistryJSON = Compatible<RepoIdRegistry>;

export function toJSON(r: RepoIdRegistry): RepoIdRegistryJSON {
  return toCompat(REPO_ID_REGISTRY_COMPAT, r);
}

export function fromJSON(j: RepoIdRegistryJSON): RepoIdRegistry {
  return fromCompat(REPO_ID_REGISTRY_COMPAT, j);
}

export function addRepoId(
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

export function emptyRegistry(): RepoIdRegistry {
  return [];
}
