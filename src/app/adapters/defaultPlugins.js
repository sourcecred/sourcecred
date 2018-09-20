// @flow

import {StaticAdapterSet} from "./adapterSet";
import {StaticPluginAdapter as GithubAdapter} from "../../plugins/github/pluginAdapter";
import {StaticPluginAdapter as GitAdapter} from "../../plugins/git/pluginAdapter";

export function defaultStaticAdapters(): StaticAdapterSet {
  return new StaticAdapterSet([new GithubAdapter(), new GitAdapter()]);
}
