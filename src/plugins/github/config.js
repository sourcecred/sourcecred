// @flow

import * as Combo from "../../util/combo";
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

const parser: Combo.Parser<GithubConfig> = (() => {
  const C = Combo;
  return C.object({
    repoIds: C.rename(
      "repositories",
      C.array(C.fmap(C.string, stringToRepoId))
    ),
  });
})();

export function parse(raw: Combo.JsonObject): GithubConfig {
  return parser.parseOrThrow(raw);
}
