// @flow

import {StaticAdapterSet} from "./adapterSet";
import {StaticPluginAdapter as GithubAdapter} from "../../plugins/github/pluginAdapter";

export function defaultStaticAdapters(): StaticAdapterSet {
  return new StaticAdapterSet([new GithubAdapter()]);
}
