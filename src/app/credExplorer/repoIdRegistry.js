// @flow

// The repoIdRegistry is written by the CLI load command (src/cli/load.js)
// and is read by the RepositorySelect component
// (src/app/credExplorer/RepositorySelect.js)
import deepEqual from "lodash.isequal";
import {toCompat, fromCompat, type Compatible} from "../../util/compat";
import type {RepoId} from "../../core/repoId";

export const REPO_ID_REGISTRY_FILE = "repositoryRegistry.json";
export const REPO_ID_REGISTRY_API = "/api/v1/data/repositoryRegistry.json";

const REPO_ID_REGISTRY_COMPAT = {type: "REPO_ID_REGISTRY", version: "0.1.0"};

export type RepoIdRegistry = $ReadOnlyArray<RepoId>;
export type RepoIdRegistryJSON = Compatible<RepoIdRegistry>;

export function toJSON(r: RepoIdRegistry): RepoIdRegistryJSON {
  return toCompat(REPO_ID_REGISTRY_COMPAT, r);
}

export function fromJSON(j: RepoIdRegistryJSON): RepoIdRegistry {
  return fromCompat(REPO_ID_REGISTRY_COMPAT, j);
}

export function addRepoId(r: RepoId, reg: RepoIdRegistry): RepoIdRegistry {
  return [...reg.filter((x) => !deepEqual(x, r)), r];
}

export function emptyRegistry(): RepoIdRegistry {
  return [];
}
