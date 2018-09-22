// @flow

import {type RepoId} from "../../core/repoId";
import type {Hash} from "../git/types";
import type {GitGateway, URL} from "../git/gitGateway";

export class GithubGitGateway implements GitGateway {
  commitUrl(repoId: RepoId, hash: Hash): URL {
    return `https://github.com/${repoId.owner}/${repoId.name}/commit/${hash}`;
  }
}
