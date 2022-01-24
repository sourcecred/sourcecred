// @flow

import * as P from "../util/combo";
import {Plugin} from "./plugin";
import {getPlugin} from "./bundledPlugins";
import {rawParser, type RawInstanceConfig} from "./rawInstanceConfig";
import * as pluginId from "./pluginId";
import type {ConfigsByTarget} from "../core/credequate/config";

export type InstanceConfig = {|
  +bundledPlugins: Map<pluginId.PluginId, Plugin>,
  +credEquatePlugins: $ReadOnlyArray<{|
    id: pluginId.PluginId,
    configsByTarget: ConfigsByTarget,
    plugin: Plugin,
  |}>,
|};

function upgrade(raw: RawInstanceConfig): InstanceConfig {
  const bundledPlugins = new Map();
  for (const id of raw.bundledPlugins) {
    const plugin = getPlugin(id);
    if (plugin == null) {
      throw new Error("bad bundled plugin: " + JSON.stringify(id));
    }
    bundledPlugins.set(id, plugin);
  }
  const credEquatePlugins = raw.credEquatePlugins.map((p) => {
    const plugin = getPlugin(p.id);
    if (plugin == null) {
      throw new Error("bad bundled plugin: " + JSON.stringify(p.id));
    }
    return {...p, plugin};
  });
  return {bundledPlugins, credEquatePlugins};
}

export const parser: P.Parser<InstanceConfig> = rawParser.fmap(upgrade);
