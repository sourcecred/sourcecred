// @flow

import {type RepoId, repoIdToString} from "./repoId";

/**
 * A derived ID to reference a cache layer.
 */
export opaque type CacheId: string = string;

/**
 * Derives the CacheId for a RepoId.
 *
 * Returned `CacheId`s will be:
 * - Deterministic
 * - Unique for this plugin
 * - Lowercase
 * - Safe to use for filenames
 * - Distinct for semantically distinct inputs (input IDs that differ
 *   only in case may map to the same output, because GitHub does not
 *   permit collisions-modulo-case)
 */
export function cacheIdForRepoId(repoId: RepoId): CacheId {
  // GitHub owner (user/organization) and repository names may be in
  // mixed case, but GitHub prevents mixed-case collisions: e.g., if
  // `foo` is a user then `Foo` cannot also be a user, and likewise for
  // repositories. GitHub login names are DNS-safe (`[0-9A-Za-z-]` only)
  // and so are filename-safe. Repository names have a slightly larger
  // character set, including underscore, but are also filename-safe.
  // Because login may not contain an underscore, it thus suffices to
  // use an underscore as the delimiter. The resulting filename uses
  // only `[0-9A-Za-z_.-]` and so is valid on all major filesystems.
  const owner = repoId.owner.toLowerCase();
  const name = repoId.name.toLowerCase();
  if (owner.includes("_")) {
    throw new Error(
      "unexpected underscore in GitHub owner name would be ambiguous: " +
        repoIdToString(repoId)
    );
  }
  return `github_${owner}_${name}`;
}
