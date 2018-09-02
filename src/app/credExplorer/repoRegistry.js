// @flow

// The repoRegistry is written by the CLI load command (src/cli/load.js)
// and is read by the RepositorySelect component
// (src/app/credExplorer/RepositorySelect.js)
import deepEqual from "lodash.isequal";
import {toCompat, fromCompat, type Compatible} from "../../util/compat";
import type {Repo} from "../../core/repo";

export const REPO_REGISTRY_FILE = "repositoryRegistry.json";
export const REPO_REGISTRY_API = "/api/v1/data/repositoryRegistry.json";

const REPO_REGISTRY_COMPAT = {type: "REPO_REGISTRY", version: "0.1.0"};

export type RepoRegistry = $ReadOnlyArray<Repo>;
export type RepoRegistryJSON = Compatible<RepoRegistry>;

export function toJSON(r: RepoRegistry): RepoRegistryJSON {
  return toCompat(REPO_REGISTRY_COMPAT, r);
}

export function fromJSON(j: RepoRegistryJSON): RepoRegistry {
  return fromCompat(REPO_REGISTRY_COMPAT, j);
}

export function addRepo(r: Repo, reg: RepoRegistry): RepoRegistry {
  return [...reg.filter((x) => !deepEqual(x, r)), r];
}

export function emptyRegistry(): RepoRegistry {
  return [];
}
