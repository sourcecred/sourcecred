// @flow

import * as Combo from "../util/combo";
import {CliPlugin} from "./cliPlugin";
import {bundledPlugins as getAllBundledPlugins} from "./bundledPlugins";

type PluginName = string;

export type InstanceConfig = {|
  +bundledPlugins: Map<PluginName, CliPlugin>,
|};

export type RawInstanceConfig = {|
  +bundledPlugins: $ReadOnlyArray<BundledPluginSpec>,
|};

// Plugin identifier, like `sourcecred/identity`. Version number is
// implicit from the SourceCred version. This is a stopgap until we have
// a plugin system that admits external, dynamically loaded
// dependencies.
export type BundledPluginSpec = string;

const parser: Combo.Parser<InstanceConfig> = (() => {
  const C = Combo;
  function makePluginMap(bundledPluginNames) {
    const allBundledPlugins = getAllBundledPlugins();
    const bundledPlugins = new Map();
    for (const name of bundledPluginNames) {
      const plugin = allBundledPlugins[name];
      if (plugin == null) {
        throw new Error("bad bundled plugin: " + JSON.stringify(name));
      }
      bundledPlugins.set(name, plugin);
    }
    return bundledPlugins;
  }
  return C.object({
    bundledPlugins: C.fmap(C.array(C.string), makePluginMap),
  });
})();

export function parse(raw: Combo.JsonObject): InstanceConfig {
  return parser.parseOrThrow(raw);
}
