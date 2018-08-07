// @flow

import type {StaticPluginAdapter} from "./pluginAdapter";
import {StaticPluginAdapter as GitAdapter} from "../plugins/git/pluginAdapter";
import {StaticPluginAdapter as GithubAdapter} from "../plugins/github/pluginAdapter";

export function defaultStaticAdapters(): $ReadOnlyArray<StaticPluginAdapter> {
  return [new GitAdapter(), new GithubAdapter()];
}
