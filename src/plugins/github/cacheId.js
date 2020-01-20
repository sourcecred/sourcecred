// @flow

import {type RepoId, repoIdToString} from "./repoId";

/**
 * A derived ID to reference a cache layer.
 */
export opaque type CacheId: string = string;

/**
 * Derives the CacheId for a RepoId.
 * Returned CacheId's will be:
 * - Deterministic
 * - Unique for this plugin
 * - Lowercase
 * - Safe to use for filenames
 */
export function cacheIdForRepoId(repoId: RepoId): CacheId {
  const repoString = repoIdToString(repoId);
  const repoStringHex = Buffer.from(repoString).toString("hex");
  return `github_${repoStringHex}`.toLowerCase();
}
