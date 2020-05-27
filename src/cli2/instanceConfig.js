// @flow

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

type JsonObject =
  | string
  | number
  | boolean
  | null
  | JsonObject[]
  | {[string]: JsonObject};

export function parse(raw: JsonObject): InstanceConfig {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("bad config: " + JSON.stringify(raw));
  }
  const {bundledPlugins: rawBundledPlugins} = raw;
  if (!Array.isArray(rawBundledPlugins)) {
    console.warn(JSON.stringify(raw));
    throw new Error(
      "bad bundled plugins: " + JSON.stringify(rawBundledPlugins)
    );
  }
  const allBundledPlugins = getAllBundledPlugins();
  const bundledPlugins = new Map();
  for (const name of rawBundledPlugins) {
    if (typeof name !== "string") {
      throw new Error("bad bundled plugin: " + JSON.stringify(name));
    }
    const plugin = allBundledPlugins[name];
    if (plugin == null) {
      throw new Error("bad bundled plugin: " + JSON.stringify(name));
    }
    bundledPlugins.set(name, plugin);
  }
  const result = {bundledPlugins};
  return result;
}
