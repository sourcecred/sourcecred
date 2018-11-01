// @flow

import {StaticAdapterSet} from "./adapterSet";
import {StaticAppAdapter as GithubAdapter} from "../../plugins/github/appAdapter";
import {StaticAppAdapter as GitAdapter} from "../../plugins/git/appAdapter";
import {GithubGitGateway} from "../../plugins/github/githubGitGateway";

export function defaultStaticAdapters(): StaticAdapterSet {
  return new StaticAdapterSet([
    new GithubAdapter(),
    new GitAdapter(new GithubGitGateway()),
  ]);
}
