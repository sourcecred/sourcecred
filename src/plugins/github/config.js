// @flow

import {type RepoId, stringToRepoId} from "./repoId";

export type GithubConfig = {|
  +repoIds: $ReadOnlyArray<RepoId>,
|};

// eslint-disable-next-line no-unused-vars
type SerializedGithubConfig = {|
  +repositories: $ReadOnlyArray<string>,
|};
// (^ for documentation purposes)

type JsonObject =
  | string
  | number
  | boolean
  | null
  | JsonObject[]
  | {[string]: JsonObject};

export function parse(raw: JsonObject): GithubConfig {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("bad config: " + JSON.stringify(raw));
  }
  const {repositories} = raw;
  if (!Array.isArray(repositories)) {
    throw new Error("bad repositories: " + JSON.stringify(repositories));
  }
  const repoIds = repositories.map((x) => {
    if (typeof x !== "string") {
      throw new Error("bad repository: " + JSON.stringify(x));
    }
    return stringToRepoId(x);
  });
  return {repoIds};
}
