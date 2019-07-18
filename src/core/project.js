// @flow

import base64 from "base-64";
import {type RepoId} from "../core/repoId";
import {toCompat, fromCompat, type Compatible} from "../util/compat";

export type ProjectId = string;

/**
 * A project represents a scope for cred analysis.
 *
 * Right now it has an `id` (which should be unique across a user's projects)
 * and an array of GitHub RepoIds.
 *
 * In the future, we will add support for more plugins (and remove the
 * hardcoded GitHub support).
 *
 * We may add more fields (e.g. a description) to this object in the futre.
 *
 * We may create a complimentary object with load/cache info for the project in
 * the future (e.g. showing the last update time for each of the project's data
 * dependencies).
 */
export type Project = {|
  +id: ProjectId,
  +repoIds: $ReadOnlyArray<RepoId>,
|};

const COMPAT_INFO = {type: "sourcecred/project", version: "0.1.0"};

export type ProjectJSON = Compatible<Project>;

export function projectToJSON(p: Project): ProjectJSON {
  return toCompat(COMPAT_INFO, p);
}

export function projectFromJSON(j: ProjectJSON): Project {
  return fromCompat(COMPAT_INFO, j);
}

/**
 * Encode the project ID so it can be stored on the filesystem,
 * or retrieved via XHR from the frontend.
 */
export function encodeProjectId(id: ProjectId): string {
  return base64.encode(id);
}
