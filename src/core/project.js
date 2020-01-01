// @flow

import base64url from "base64url";
import {type RepoId} from "../core/repoId";
import {toCompat, fromCompat, type Compatible} from "../util/compat";
import {type Identity} from "../plugins/identity/identity";
import {type DiscourseServer} from "../plugins/discourse/loadDiscourse";

export type ProjectId = string;

/**
 * A project represents a scope for cred analysis.
 *
 * Right now it has an `id` (which should be unique across a user's projects)
 * and an array of GitHub RepoIds.
 *
 * In the future, instead of hardcoding support for plugins like GitHub and Discourse,
 * we will have a generic system for storing plugin-specific config, keyed by plugin
 * identifier.
 *
 * We may add more fields (e.g. a description) to this object in the future.
 *
 * We may create a complimentary object with load/cache info for the project in
 * the future (e.g. showing the last update time for each of the project's data
 * dependencies).
 */
export type Project = Project_v040;
export type SupportedProject = Project_v030 | Project_v031 | Project_v040;

type Project_v040 = {|
  +id: ProjectId,
  +repoIds: $ReadOnlyArray<RepoId>,
  +discourseServer: DiscourseServer | null,
  +identities: $ReadOnlyArray<Identity>,
|};

const COMPAT_INFO = {type: "sourcecred/project", version: "0.4.0"};

export type ProjectJSON = Compatible<Project>;

export function projectToJSON(p: Project): ProjectJSON {
  return toCompat(COMPAT_INFO, p);
}

export function projectFromJSON(j: ProjectJSON): Project {
  return fromCompat(COMPAT_INFO, j, upgrades);
}

/**
 * Encode the project ID so it can be stored on the filesystem,
 * or retrieved via XHR from the frontend.
 */
export function encodeProjectId(id: ProjectId): string {
  return base64url.encode(id);
}

const upgradeFrom030 = (p: Project_v031 | Project_v030) => ({
  ...p,
  discourseServer:
    p.discourseServer != null ? {serverUrl: p.discourseServer.serverUrl} : null,
});

type Project_v031 = {|
  +id: ProjectId,
  +repoIds: $ReadOnlyArray<RepoId>,
  +discourseServer: {|
    +serverUrl: string,
    +apiUsername?: string,
  |} | null,
  +identities: $ReadOnlyArray<Identity>,
|};

type Project_v030 = {|
  +id: ProjectId,
  +repoIds: $ReadOnlyArray<RepoId>,
  +discourseServer: {|
    +serverUrl: string,
    +apiUsername: string,
  |} | null,
  +identities: $ReadOnlyArray<Identity>,
|};

const upgrades = {
  "0.3.0": upgradeFrom030,
  "0.3.1": upgradeFrom030,
};
