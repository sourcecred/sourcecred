// @flow

import * as P from "../util/combo";
import {Plugin} from "./plugin";
import {bundledPlugins as getAllBundledPlugins} from "./bundledPlugins";
import {rawParser, type RawInstanceConfig} from "./rawInstanceConfig";
import * as pluginId from "./pluginId";

export type InstanceConfig = {|
  +bundledPlugins: Map<pluginId.PluginId, Plugin>,
|};

function upgrade(raw: RawInstanceConfig): InstanceConfig {
  const allBundledPlugins = getAllBundledPlugins();
  const bundledPlugins = new Map();
  for (const id of raw.bundledPlugins) {
    const plugin = allBundledPlugins[id];
    if (plugin == null) {
      throw new Error("bad bundled plugin: " + JSON.stringify(id));
    }
    bundledPlugins.set(id, plugin);
  }
  return {bundledPlugins};
}

export const parser: P.Parser<InstanceConfig> = P.fmap(rawParser, upgrade);
