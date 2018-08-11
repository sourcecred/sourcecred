// @flow

import {StaticAdapterSet} from "./adapterSet";
import {StaticPluginAdapter as GitAdapter} from "../../plugins/git/pluginAdapter";
import {StaticPluginAdapter as GithubAdapter} from "../../plugins/github/pluginAdapter";

export function defaultStaticAdapters(): StaticAdapterSet {
  return new StaticAdapterSet([new GitAdapter(), new GithubAdapter()]);
}
