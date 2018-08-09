// @flow

import type {StaticPluginAdapter} from "./pluginAdapter";
import {StaticPluginAdapter as GithubAdapter} from "../plugins/github/pluginAdapter";

export function defaultStaticAdapters(): $ReadOnlyArray<StaticPluginAdapter> {
  return [new GithubAdapter()];
}
