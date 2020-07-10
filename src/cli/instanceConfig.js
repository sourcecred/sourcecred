// @flow

import * as P from "../util/combo";
import {CliPlugin} from "./cliPlugin";
import {bundledPlugins as getAllBundledPlugins} from "./bundledPlugins";
import * as pluginId from "../api/pluginId";

export type InstanceConfig = {|
  +bundledPlugins: Map<pluginId.PluginId, CliPlugin>,
|};

type RawInstanceConfig = {|
  // Plugin identifier, like `sourcecred/identity`. Version number is
  // implicit from the SourceCred version. This is a stopgap until we have
  // a plugin system that admits external, dynamically loaded
  // dependencies.
  +bundledPlugins: $ReadOnlyArray<pluginId.PluginId>,
|};

const rawParser: P.Parser<RawInstanceConfig> = P.object({
  bundledPlugins: P.array(pluginId.parser),
});

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
