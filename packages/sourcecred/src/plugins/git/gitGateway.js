// @flow

import type {RepoId} from "../../plugins/github/repoId";
import type {Hash} from "./types";

export type URL = string;

// Interface for adapting to a Git hosting provider, e.g. GitHub
export interface GitGateway {
  // URL to permalink to an individual commit
  commitUrl(repo: RepoId, hash: Hash): URL;
}
